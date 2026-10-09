import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFreeeImportPlan,
  novemberFiscalStart,
} from "../src/lib/domain/freee-plan";

test("November fiscal plan includes current and prior-year monthly windows without assuming close", () => {
  const plan = buildFreeeImportPlan(
    "2025-11",
    new Date("2026-10-08T08:00:00Z"),
  );
  assert.equal(plan.length, 12);
  assert.equal(plan[0].period, "2025-11");
  assert.equal(plan[0].previousPeriod, "2024-11");
  assert.equal(plan[0].from, "2025-11-01");
  assert.equal(plan[0].through, "2025-11-30");
  assert.equal(plan[0].status, "closing-unconfirmed");
  assert.equal(plan.at(-1)?.period, "2026-10");
  assert.equal(plan.at(-1)?.through, "2026-10-08");
  assert.equal(plan.at(-1)?.status, "in-progress");
  assert.equal(plan.at(-1)?.canPublishAsMonthlyActual, false);
});

test("fiscal plan uses JST boundaries, handles leap years and rejects future/oversized ranges", () => {
  const at = new Date("2026-10-31T15:00:00Z");
  assert.equal(novemberFiscalStart(at), "2026-11");
  assert.equal(
    novemberFiscalStart(new Date("2026-10-31T14:59:59Z")),
    "2025-11",
  );
  const plan = buildFreeeImportPlan(
    "2024-02",
    new Date("2024-03-01T00:00:00Z"),
  );
  assert.equal(plan[0].through, "2024-02-29");
  assert.throws(() => buildFreeeImportPlan("2026-12", at));
  assert.throws(() => buildFreeeImportPlan("2020-01", at));
  assert.throws(() => buildFreeeImportPlan("2026-13", at));
});
