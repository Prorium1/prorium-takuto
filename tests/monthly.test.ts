import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyReport,
  structureMonthlyNotes,
  monthlyNotesSchema,
  financialEntrySchema,
  applyFinancialEntry,
} from "../src/lib/domain/monthly";
import { contentHash, applyOperation } from "../src/lib/domain/workflow";
import {
  humanEditAnalysis,
  reportAttribution,
} from "../src/lib/domain/provenance";

test("multiline monthly notes use consistent newlines after browser form submission", () => {
  const typed = "講座の進捗を確認しました。\n動画の制作工程を改善しました。";
  assert.equal(monthlyNotesSchema.parse(typed.replaceAll("\n", "\r\n")), typed);
});

test("production monthly draft never contains mock financials or business claims", () => {
  const report = emptyReport("2026-10", "11111111-1111-1111-1111-111111111111");
  assert.equal(report.content.financial.isMock, false);
  assert.equal(report.content.financial.available, false);
  assert.equal(report.content.financial.trend.length, 0);
  assert.equal(report.content.highlights.length, 0);
  assert.equal(report.content.summary.text, "");
  const summary = structureMonthlyNotes(
    "2026-10",
    "新しい講座を開講した。\n動画制作の工程を改善した。\n来月は受講者の継続率を確認する。",
  );
  assert.ok(summary.text.includes("新しい講座"));
  assert.ok(!summary.text.includes("増収") && !summary.text.includes("利益率"));
  report.content.summary = summary;
  report.content.ceo.message = "講座と運営品質の改善に取り組みます。";
  report.contentHash = contentHash(report.content);
  const review = applyOperation(report, "review", "admin");
  assert.equal(review.state, "review");
});

test("human approval and publication preserve AI generation provenance", () => {
  const report = emptyReport("2026-10", "company");
  report.content.summary = structureMonthlyNotes(
    "2026-10",
    "新しい講座を開講し、運営の品質を改善しました。",
  );
  report.content.ceo.message = "引き続き運営を改善します。";
  report.contentHash = contentHash(report.content);
  report.analysis = "generated-ai";
  assert.equal(humanEditAnalysis(report.analysis), "generated-ai");
  const reviewed = applyOperation(report, "review", "admin");
  const approved = applyOperation(reviewed, "approve", "admin");
  const published = applyOperation(approved, "publish", "admin");
  assert.equal(published.analysis, "generated-ai");
  assert.equal(
    reportAttribution(published).statement,
    "AI assisted. Human approved.",
  );
  assert.equal(
    reportAttribution({ analysis: "human-authored", approvedBy: "admin" })
      .statement,
    "Management authored. Human approved.",
  );
});

test("financial entry validates integer yen and balanced statements and uses explicit drivers", () => {
  const input = {
    revenue: 120,
    previousRevenue: 100,
    operatingProfit: 12,
    previousOperatingProfit: 10,
    ordinaryProfit: 11,
    previousOrdinaryProfit: 9,
    cash: 50,
    previousCash: 40,
    assets: 70,
    liabilities: 20,
    equity: 50,
    monthlyFixedCosts: 5,
    revenueReason: "提供サービスの増加",
    profitReason: "固定費の吸収",
  };
  assert.ok(
    !financialEntrySchema.safeParse({ ...input, revenue: 1.5 }).success,
  );
  assert.ok(!financialEntrySchema.safeParse({ ...input, equity: 49 }).success);
  const content = applyFinancialEntry(
    emptyReport("2026-10", "company").content,
    input,
  );
  assert.equal(content.financial.available, true);
  assert.equal(content.revenueDrivers[0].amount, 20);
  assert.equal(content.profitDrivers[0].amount, 2);
  assert.equal(content.financial.isMock, false);
  assert.equal(content.financial.source, "management-entry");
});
