import test from "node:test";
import assert from "node:assert/strict";
import { parseExecutiveStatements } from "../src/lib/domain/executive-statements";

const row = (
  category: string,
  opening: number,
  closing: number,
  id?: number,
) => ({
  account_category_name: category,
  account_item_id: id,
  account_item_name: id ? `Mock ${category}` : undefined,
  total_line: !id,
  hierarchy_level: 1,
  opening_balance: opening,
  debit_amount: 200,
  credit_amount: 100,
  closing_balance: closing,
});
function inputs() {
  const meta = {
    company_id: 1234,
    start_date: "2026-08-01",
    end_date: "2026-08-31",
  };
  return {
    pl: {
      up_to_date: true,
      trial_pl: {
        ...meta,
        balances: [
          row("売上高", 1000, 1400),
          row("売上原価", 200, 300),
          row("売上総損益金額", 800, 1100),
          row("販売管理費", 500, 850),
          row("営業損益金額", 300, 250),
          row("経常損益金額", 310, 265),
          row("販売管理費", 200, 250, 7),
        ],
      },
    },
    bs: {
      up_to_date: true,
      trial_bs: {
        ...meta,
        balances: [
          row("資産", 900, 1000),
          row("負債", 400, 600),
          row("純資産", 500, 400),
          row("流動資産", 700, 800),
          row("流動負債", 100, 200),
          row("現金・預金", 200, 300, 1),
          row("現金・預金", 100, 200, 2),
        ],
      },
    },
  };
}
test("preserves debit/credit, fiscal cumulative P/L and month-end B/S without double-counting cash", () => {
  const { pl, bs } = inputs();
  const result = parseExecutiveStatements(
    pl,
    bs,
    1234,
    "2026-08",
    "2025-11-01",
  );
  assert.equal(result.bsTotals.cash, 500);
  assert.equal(result.bsTotals.assets, 1000);
  assert.equal(result.pl[0].closing, 1400);
  assert.equal(result.pl[0].closing - result.pl[0].opening, 400);
  assert.equal(result.pl[0].debit, 200);
  assert.equal(result.pl[0].credit, 100);
  assert.equal(result.fiscalStart, "2025-11-01");
});
test("rejects stale, wrong-month, missing turnover and unbalanced B/S", () => {
  const { pl, bs } = inputs();
  const parse = (b: unknown) =>
    parseExecutiveStatements(pl, b, 1234, "2026-08", "2025-11-01");
  assert.throws(() => parse({ ...bs, up_to_date: false }));
  assert.throws(() =>
    parse({ ...bs, trial_bs: { ...bs.trial_bs, company_id: 9 } }),
  );
  assert.throws(() =>
    parse({ ...bs, trial_bs: { ...bs.trial_bs, end_date: "2026-07-31" } }),
  );
  const bad = structuredClone(bs);
  bad.trial_bs.balances[0].closing_balance++;
  assert.throws(() => parse(bad));
  const missing = structuredClone(bs);
  delete (missing.trial_bs.balances[0] as { debit_amount?: number })
    .debit_amount;
  assert.throws(() => parse(missing));
});
