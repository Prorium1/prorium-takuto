import test from "node:test";
import assert from "node:assert/strict";
import { contentHash } from "../src/lib/domain/workflow";
import { augustReport } from "../src/lib/mock/seed";
import {
  ownershipSchema,
  ownershipRows,
  latestOwnershipReport,
} from "../src/lib/domain/ownership";

const snapshot = () => ({
  asOf: "2026-08-31",
  basis: "issued-shares" as const,
  display: "grouped" as const,
  issuedShares: 1000,
  sourceLabel: "Mockの確認用名簿",
  notes: "架空データ",
  rows: [
    {
      group: "founder" as const,
      name: "",
      shareClass: "普通株式",
      shares: 550,
    },
    { group: "fund" as const, name: "", shareClass: "普通株式", shares: 450 },
  ],
});
test("発行済株式数と内訳を照合し、端数を持つ比率を計算する", () => {
  const s = ownershipSchema.parse(snapshot());
  assert.deepEqual(
    ownershipRows(s).map((r) => Number(r.ratio.toFixed(2))),
    [55, 45],
  );
  assert.equal(
    ownershipSchema.safeParse({ ...s, issuedShares: 1001 }).success,
    false,
  );
  assert.equal(
    ownershipSchema.safeParse({ ...s, rows: [{ ...s.rows[0], shares: -1 }] })
      .success,
    false,
  );
});
test("区分別表示に個人名や連絡先を紛れ込ませない", () => {
  const s = snapshot();
  s.rows[0].name = "PRIVATE-CANARY";
  assert.equal(ownershipSchema.safeParse(s).success, false);
  assert.equal(
    ownershipSchema.safeParse({
      ...snapshot(),
      email: "private@example.invalid",
    }).success,
    false,
  );
});
test("株主構成は公開版のみを基準日の順で選び、未登録や不正な株式数を0へ変換しない", () => {
  const report = structuredClone(augustReport);
  report.content.ownership = snapshot();
  const draft = structuredClone(report);
  draft.state = "draft";
  draft.content.ownership!.asOf = "2026-10-01";
  assert.equal(latestOwnershipReport([draft, report])?.id, report.id);
  report.content.ownership!.issuedShares = 1;
  assert.equal(latestOwnershipReport([draft, report]), null);
  assert.equal(
    ownershipSchema.safeParse({ ...snapshot(), asOf: "2099-01-01" }).success,
    false,
  );
});

test("株主構成を変更すると公開承認の対象ハッシュが変わる", () => {
  const content = structuredClone(augustReport.content);
  const before = contentHash(content);
  (content as unknown as Record<string, unknown>).ownership = {
    asOf: "2026-08-31",
    issuedShares: 1000,
    rows: [{ group: "founder", shares: 1000 }],
  };
  assert.notEqual(contentHash(content), before);
});

test("基準日を訂正した改訂版は同じ月の旧版に優先する", () => {
  const old = structuredClone(augustReport);
  old.content.ownership = snapshot();
  old.createdAt = "2026-09-01T00:00:00Z";
  const correction = structuredClone(old);
  correction.id = "mock-correction";
  correction.version = "v1.1";
  correction.createdAt = "2026-09-02T00:00:00Z";
  correction.content.ownership!.asOf = "2026-08-01";
  assert.equal(latestOwnershipReport([old, correction])?.id, correction.id);
  correction.content.ownership = null;
  assert.equal(latestOwnershipReport([old, correction]), null);
});
