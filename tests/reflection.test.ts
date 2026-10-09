import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyReflection,
  encodeReflection,
  decodeReflection,
  publicReflection,
  structureReflection,
  reflectionModelInput,
} from "../src/lib/domain/reflection";
import { emptyReport } from "../src/lib/domain/monthly";

const sample = () => ({
  ...emptyReflection(),
  events: "新しい講座を開講し、運営体制を見直しました。",
  revenueReason: "既存顧客の追加契約が売上の増加につながりました。",
  profitReason: "採用費用が一時的に増えました。",
  risksAndActions: "問い合わせ対応の遅れに対し、担当者を追加します。",
  aiImpact: "動画制作にAIを試用中です。削減時間は未計測です。",
  outlook: "来月は継続率を確認する予定です。",
  hypotheses: "広告改善の寄与も考えられますが、未検証です。",
  privateNotes: "機密：個人名や交渉条件は公開しない。",
});

test("reflection round trips through admin notes; old free text remains editable", () => {
  assert.deepEqual(decodeReflection(encodeReflection(sample())), sample());
  assert.equal(
    decodeReflection("以前に保存した振り返りです。").events,
    "以前に保存した振り返りです。",
  );
  assert.equal(decodeReflection("").privateNotes, "");
  assert.throws(() =>
    encodeReflection({ ...sample(), events: "あ".repeat(12000) }),
  );
});

test("private memo never enters shareholder draft or AI input; unknown financials stay absent", () => {
  const reflection = sample();
  const report = emptyReport("2026-10", "company");
  const input = reflectionModelInput(
    report.period,
    reflection,
    report.content.financial,
  );
  for (const value of [
    publicReflection(reflection),
    input,
    structureReflection(report.period, reflection),
  ]) {
    assert.ok(!JSON.stringify(value).includes(reflection.privateNotes));
    assert.ok(!JSON.stringify(value).includes("privateNotes"));
  }
  assert.equal(input.financial, null);
  const draft = structureReflection(report.period, reflection);
  assert.ok(draft.financialAnalysis.includes(reflection.revenueReason));
  assert.ok(draft.financialAnalysis.includes("未検証の見立て"));
  assert.ok(draft.financialAnalysis.includes("未計測"));
  assert.equal(draft.summary.outlook, `見通し・予定：${reflection.outlook}`);
  assert.ok(!draft.summary.text.includes(reflection.outlook));
  assert.ok(!draft.summary.text.includes(reflection.hypotheses));
});

test("private-only drafts can be saved but cannot generate a public report", () => {
  const privateOnly = {
    ...emptyReflection(),
    privateNotes: "管理者だけが見る非公開メモです。",
  };
  assert.equal(
    decodeReflection(encodeReflection(privateOnly)).privateNotes,
    privateOnly.privateNotes,
  );
  assert.throws(() => structureReflection("2026-10", privateOnly), /10文字/);
  assert.throws(() => reflectionModelInput("2026-10", privateOnly), /10文字/);
});

test("AI context uses explicit monthly financial facts and excludes unrelated document metadata", () => {
  const financial = emptyReport("2026-10", "company").content.financial;
  financial.available = true;
  financial.revenue.current = 123;
  financial.revenue.previous = 100;
  const input = reflectionModelInput("2026-10", sample(), financial);
  assert.equal(input.financial?.revenue.current, 123);
  assert.equal(input.financial?.revenue.previous, 100);
  assert.equal(input.financial?.comparison, "前年同月");
  assert.ok(!JSON.stringify(input).includes(financial.id));
  assert.throws(
    () => reflectionModelInput("2026-09", sample(), financial),
    /対象月/,
  );
});
