import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { saveOwnership } from "../src/lib/server/ownership";
import {
  getAdminReport,
  listPublishedReports,
} from "../src/lib/server/repository";
import { getReportPreparation } from "../src/lib/server/mock-repository";
import type { Actor } from "../src/lib/domain/types";

test("株主構成は管理者の下書きへ保存され、投資家・公開版・古い更新を保護する", async () => {
  const oldEnv = process.env.PRORIUM_ENV,
    oldStore = process.env.MOCK_STORE_PATH;
  const dir = await mkdtemp(path.join(tmpdir(), "ownership-test-"));
  process.env.PRORIUM_ENV = "mock";
  process.env.MOCK_STORE_PATH = dir;
  const admin: Actor = {
    id: "demo-admin",
    role: "admin",
    companyId: "prorium",
  };
  const investor: Actor = {
    id: "demo-investor",
    role: "investor",
    companyId: "prorium",
  };
  const input = {
    asOf: "2026-08-31",
    basis: "issued-shares",
    display: "grouped",
    issuedShares: 1000,
    sourceLabel: "PRIVATE-DRAFT-CANARY",
    notes: "",
    rows: [
      { group: "founder", name: "", shareClass: "普通株式", shares: 1000 },
    ],
  };
  try {
    const before = await getAdminReport("report-2026-09-v1-0", admin);
    assert.ok(before);
    const finance = JSON.stringify(before.content.financial);
    await assert.rejects(
      saveOwnership(before.id, investor, before.revision, input),
      /管理者/,
    );
    await assert.rejects(getReportPreparation(investor), /Admin|管理者/);
    const saved = await saveOwnership(before.id, admin, before.revision, input);
    assert.equal(saved.state, "draft");
    assert.equal(saved.approvedBy, null);
    assert.equal(JSON.stringify(saved.content.financial), finance);
    assert.equal(
      JSON.stringify(await listPublishedReports(investor)).includes(
        "PRIVATE-DRAFT-CANARY",
      ),
      false,
    );
    await assert.rejects(
      saveOwnership(saved.id, admin, before.revision, input),
      /別の更新/,
    );
    const published = await getAdminReport("report-2026-08-v1-0", admin);
    assert.ok(published);
    await assert.rejects(
      saveOwnership(published.id, admin, published.revision, input),
      /下書き/,
    );
  } finally {
    if (oldEnv === undefined) delete process.env.PRORIUM_ENV;
    else process.env.PRORIUM_ENV = oldEnv;
    if (oldStore === undefined) delete process.env.MOCK_STORE_PATH;
    else process.env.MOCK_STORE_PATH = oldStore;
    await rm(dir, { recursive: true, force: true });
  }
});
