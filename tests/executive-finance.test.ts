import test from "node:test";
import assert from "node:assert/strict";
import {
  parseExecutivePL,
  executiveFinancial,
} from "../src/lib/domain/executive-finance";
const category = [
  "売上高",
  "売上原価",
  "売上総損益金額",
  "販売管理費",
  "営業損益金額",
  "経常損益金額",
];
function fixture(period = "2026-08") {
  const open = [1000, 200, 800, 500, 300, 310];
  const close = [1300, 300, 1000, 650, 350, 365];
  return {
    up_to_date: true,
    trial_pl: {
      company_id: 1234,
      start_date: `${period}-01`,
      end_date: `${period}-31`,
      balances: category
        .map((name, i) => ({
          total_line: true,
          account_category_name: name,
          opening_balance: open[i],
          closing_balance: close[i],
        }))
        .concat([
          {
            account_item_id: 99,
            account_item_name: "Mock外注費",
            account_category_name: "売上原価",
            opening_balance: 50,
            closing_balance: 75,
          },
        ] as never[]),
    },
  };
}
test("monthly P/L uses net movement and preserves the separate fiscal cumulative balance", () => {
  const p = parseExecutivePL(fixture(), 1234, "2026-08");
  assert.equal(p.monthly.revenue, 300);
  assert.equal(p.cumulative.revenue, 1300);
  assert.equal(p.monthly.operatingProfit, 50);
  assert.equal(p.monthly.costOfSales, 100);
  assert.equal(p.accounts[0].monthly, 25);
});
test("a wrong company, month, incomplete aggregation, duplicate totals or inconsistent P/L is rejected", () => {
  assert.throws(() => parseExecutivePL(fixture(), 4321, "2026-08"));
  assert.throws(() => parseExecutivePL(fixture(), 1234, "2026-07"));
  const stale = fixture();
  stale.up_to_date = false;
  assert.throws(() => parseExecutivePL(stale, 1234, "2026-08"));
  const duplicate = fixture();
  duplicate.trial_pl.balances.push(duplicate.trial_pl.balances[0]);
  assert.throws(() => parseExecutivePL(duplicate, 1234, "2026-08"));
  const bad = fixture();
  bad.trial_pl.balances[2].closing_balance++;
  assert.throws(() => parseExecutivePL(bad, 1234, "2026-08"));
});
test("missing comparison accounts stay missing; they are never replaced with zero", () => {
  const p = parseExecutivePL(fixture(), 1234, "2026-08");
  const old = { ...p, accounts: [] };
  const f = executiveFinancial("2026-08", p, old, old, {
    nativeClosedThrough: null,
    temporaryClosedThrough: "2026-08-31",
  });
  assert.equal(f.accounts[0].previousYear, null);
  assert.equal(f.accounts[0].previousMonth, null);
  assert.equal(f.basis, "monthly-net-v2");
});
