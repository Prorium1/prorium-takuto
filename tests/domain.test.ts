import test from "node:test";
import assert from "node:assert/strict";
import {
  compareYoY,
  reconcileDrivers,
  percent,
} from "../src/lib/domain/finance";
import { applyOperation } from "../src/lib/domain/workflow";
import { augustReport, initialStore } from "../src/lib/mock/seed";
import { signSession, verifySession } from "../src/lib/domain/session";

test("YoY uses the same-period baseline and handles zero/negative baselines", () => {
  assert.equal(compareYoY(52_640_000, 40_000_000).percent, 31.6);
  assert.equal(compareYoY(100, 0).percent, null);
  assert.equal(compareYoY(100, -100).percent, null);
  assert.equal(compareYoY(-120, 100).percent, -220);
});

test("undefined YoY rates are explicitly unavailable rather than reported as zero percent", () => {
  assert.equal(percent(compareYoY(120, 0).percent), "算定不可");
  assert.equal(percent(compareYoY(120, -10).percent), "算定不可");
  assert.equal(percent(compareYoY(100, 100).percent), "0.0%");
  assert.equal(percent(compareYoY(90, 100).percent), "-10.0%");
});

test("revenue and operating profit drivers reconcile to the reported change", () => {
  const { financial, revenueDrivers, profitDrivers } = augustReport.content;
  assert.equal(
    reconcileDrivers(
      financial.revenue.previous,
      financial.revenue.current,
      revenueDrivers,
    ),
    true,
  );
  assert.equal(
    reconcileDrivers(
      financial.operatingProfit.previous,
      financial.operatingProfit.current,
      profitDrivers,
    ),
    true,
  );
  assert.equal(
    reconcileDrivers(100, 200, [{ label: "bad", amount: 50, description: "" }]),
    false,
  );
});

test("archive financials match the history displayed in the August report", () => {
  for (const report of initialStore().reports.filter((r) =>
    ["2026-06", "2026-07"].includes(r.period),
  )) {
    const point = augustReport.content.financial.trend.find(
      (p) => p.month === `${Number(report.period.slice(5))}月`,
    )!;
    assert.equal(report.content.financial.revenue.current, point.revenue);
    assert.equal(
      report.content.financial.operatingProfit.current,
      point.profit,
    );
    assert.equal(
      report.content.financial.revenue.previous,
      point.previousRevenue,
    );
    assert.equal(
      reconcileDrivers(
        report.content.financial.revenue.previous,
        report.content.financial.revenue.current,
        report.content.revenueDrivers,
      ),
      true,
    );
  }
});

test("workflow requires human review and approval of exact content", () => {
  const draft = {
    ...structuredClone(augustReport),
    state: "draft" as const,
    approvedHash: null,
    approvedBy: null,
    approvedAt: null,
    publishedAt: null,
  };
  assert.throws(() => applyOperation(draft, "publish", "admin"), /承認/);
  assert.throws(() => applyOperation(draft, "approve", "admin"), /レビュー/);
  const review = applyOperation(draft, "review", "admin");
  const approved = applyOperation(review, "approve", "admin");
  assert.equal(approved.approvedHash, approved.contentHash);
  assert.equal(applyOperation(approved, "publish", "admin").state, "published");
  assert.throws(
    () =>
      applyOperation(
        { ...approved, contentHash: "tampered" },
        "publish",
        "admin",
      ),
    /承認/,
  );
  const changedContent = structuredClone(approved);
  changedContent.content.summary.text = "unapproved content";
  assert.throws(
    () => applyOperation(changedContent, "publish", "admin"),
    /承認/,
  );
});

test("published data cannot be edited or regenerated", () => {
  assert.throws(
    () => applyOperation(augustReport, "edit", "admin"),
    /公開済み/,
  );
  assert.throws(
    () => applyOperation(augustReport, "generate", "admin"),
    /公開済み/,
  );
});

test("editing after approval invalidates approval and returns to draft", () => {
  const approved = { ...augustReport, state: "approved" as const };
  const edited = applyOperation(approved, "edit", "admin");
  assert.equal(edited.state, "draft");
  assert.equal(edited.approvedHash, null);
  assert.equal(edited.approvedBy, null);
});

test("signed mock sessions reject tampering, expiry and invalid actors", () => {
  const key = "test-key-only";
  const actor = {
    id: "demo-investor",
    role: "investor" as const,
    companyId: "prorium",
  };
  const token = signSession(actor, key, 1000);
  assert.deepEqual(verifySession(token, key, 1001), actor);
  assert.equal(verifySession(token + "x", key, 1001), null);
  assert.equal(verifySession(token, "another-key", 1001), null);
  assert.equal(verifySession(token, key, 1000 + 3601), null);
});
