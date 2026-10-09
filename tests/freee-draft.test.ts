import test from "node:test";
import assert from "node:assert/strict";
import { buildFreeeDraftContent } from "../src/lib/domain/freee-draft";

const stage = {
  id: "11111111-1111-4111-8111-111111111111", period: "2026-08",
  candidate: { period: "2026-08", currency: "JPY", source: "freee", revenue: { current: 130, previous: 100 }, operatingProfit: { current: 20, previous: 15 }, ordinaryProfit: { current: 21, previous: 16 }, cash: { current: 80, previous: 60 }, assets: 300, liabilities: 100, equity: 200, monthlyFixedCosts: null },
  provenance: { period: "2026-08", closeConfirmed: false, retrievedAt: "2026-10-09T00:00:00Z", cashAccountIds: { current: [1], previous: [1] } },
};
const confirmation = { monthlyFixedCosts: 10, revenueReason: "Synthetic revenue change evidence", profitReason: "Synthetic operating profit evidence" };

test("confirmed freee candidate creates only an unpublished-content draft with exact financial drivers", () => {
  const content = buildFreeeDraftContent(stage, "22222222-2222-4222-8222-222222222222", confirmation);
  assert.equal(content.financial.source, "freee");
  assert.equal(content.financial.revenue.current, 130);
  assert.equal(content.financial.updatedAt, stage.provenance.retrievedAt);
  assert.equal(content.revenueDrivers[0].amount, 30);
  assert.equal(content.profitDrivers[0].amount, 5);
  assert.equal(content.summary.text, "");
  assert.equal(content.ceo.message, "");
  assert.deepEqual(content.ai.revenue, []);
});

test("month-to-date and unmatched balance sheet never become monthly drafts", () => {
  assert.throws(() => buildFreeeDraftContent({ ...stage, candidate: { ...stage.candidate, completeness: "month-to-date" } }, "company", confirmation), /月途中/);
  assert.throws(() => buildFreeeDraftContent({ ...stage, candidate: { ...stage.candidate, assets: 301 } }, "company", confirmation), /貸借/);
});
