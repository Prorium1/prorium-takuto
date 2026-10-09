import test from "node:test";
import assert from "node:assert/strict";
import { validateFreeeTrial, monthlyFreeeWindow } from "../src/lib/domain/freee-trial";

const pl = { up_to_date: true, trial_pl: { company_id: 11486508, start_date: "2026-08-01", end_date: "2026-08-31", balances: [
  { account_item_id: 100, account_item_name: "Synthetic revenue", hierarchy_level: 2, closing_balance: 100000 },
  { account_category_name: "Synthetic total", total_line: true, hierarchy_level: 1, closing_balance: 100000 },
] } };

test("freee monthly window uses exact calendar boundaries", () => {
  assert.deepEqual(monthlyFreeeWindow("2024-02"), { start: "2024-02-01", end: "2024-02-29" });
  assert.deepEqual(monthlyFreeeWindow("2026-08"), { start: "2026-08-01", end: "2026-08-31" });
  assert.throws(() => monthlyFreeeWindow("2026-13"));
});

test("trial validation binds company, period, freshness and integer JPY", () => {
  const result = validateFreeeTrial(pl, "pl", 11486508, "2026-08");
  assert.equal(result.balances.length, 2);
  assert.equal(result.balances[0].accountItemId, 100);
  assert.throws(() => validateFreeeTrial({ ...pl, up_to_date: false }, "pl", 11486508, "2026-08"), /集計/);
  assert.throws(() => validateFreeeTrial(pl, "pl", 12535174, "2026-08"), /事業所/);
  assert.throws(() => validateFreeeTrial(pl, "pl", 11486508, "2026-09"), /対象月/);
  assert.throws(() => validateFreeeTrial({ ...pl, trial_pl: { ...pl.trial_pl, balances: [{ ...pl.trial_pl.balances[0], closing_balance: 1.5 }] } }, "pl", 11486508, "2026-08"), /金額/);
});
