import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyReflection,
  structureReflection,
  reflectionModelInput,
} from "../src/lib/domain/reflection";
import { emptyReport, monthlySummarySchema } from "../src/lib/domain/monthly";
import { augustReport } from "../src/lib/mock/seed";
import { priorityRisk, summaryReview } from "../src/lib/domain/summary-quality";

test("long positive progress cannot crowd risks and AI measurement status out of the editorial draft", () => {
  const reflection = {
    ...emptyReflection(),
    events: "新講座の準備が進みました。".repeat(150),
    revenueReason: "追加契約が寄与しました。",
    profitReason: "外注費が増加しました。",
    risksAndActions: "納期が遅延。工程を見直し来月確認します。",
    aiImpact: "AIを試用中。削減時間は未計測です。",
    privateNotes: "PRIVATE_CANARY",
  };
  const draft = structureReflection("2026-08", reflection);
  monthlySummarySchema.parse(draft.summary);
  for (const body of [draft.summary.text, draft.summary.points.join("\n")]) {
    assert.match(body, /納期が遅延/);
    assert.match(body, /未計測/);
    assert.match(body, /経営者の説明/);
    assert.doesNotMatch(body, /PRIVATE_CANARY/);
  }
});

test("future-only or hypothesis-only input is never presented as current performance", () => {
  for (const field of ["outlook", "hypotheses"] as const) {
    const draft = structureReflection("2026-08", {
      ...emptyReflection(),
      [field]: "新しい法人契約が増える可能性があります。",
    });
    assert.match(draft.summary.text, /実績・進捗は未入力/);
    assert.match(
      draft.summary.points[0],
      field === "outlook" ? /見通し・予定/ : /未検証の見立て/,
    );
  }
});

test("AI receives deterministic year-on-year calculations and undefined percentage remains null", () => {
  const f = structuredClone(augustReport.content.financial);
  f.operatingProfit.previous = -1_000_000;
  const input = reflectionModelInput(
    "2026-08",
    { ...emptyReflection(), events: "架空の当月の業務改善を進めました。" },
    f,
  );
  assert.equal(input.financial?.revenue.percent, 31.6);
  assert.equal(input.financial?.operatingProfit.percent, null);
  assert.equal(input.financial?.operatingProfit.delta, 9_420_000);
});

test("editorial guidance does not certify truth and distinguishes missing risk from no risk", () => {
  const c = emptyReport("2026-08", "company").content;
  assert.deepEqual(
    summaryReview(c).map((c) => c.id),
    ["message", "financial", "why", "risk", "outlook"],
  );
  c.summary.text = "あ".repeat(401);
  assert.ok(summaryReview(c).some((c) => c.id === "length"));
});

test("the overview prioritizes declared impact without mutating the published snapshot", () => {
  const risks = [
    {
      id: "low",
      title: "Low",
      impact: "低" as const,
      description: "",
      action: "",
      owner: "",
      due: "",
    },
    {
      id: "high",
      title: "High",
      impact: "高" as const,
      description: "",
      action: "",
      owner: "",
      due: "",
    },
  ];
  const before = JSON.stringify(risks);
  assert.equal(priorityRisk(risks)?.id, "high");
  assert.equal(JSON.stringify(risks), before);
  assert.equal(priorityRisk([]), undefined);
});
