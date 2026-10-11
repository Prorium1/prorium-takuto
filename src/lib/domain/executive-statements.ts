import { z } from "zod";
import { monthlyFreeeWindow } from "./freee-trial";
import { parseExecutivePL } from "./executive-finance";

const balance = z.object({
  account_item_id: z.number().int().positive().optional(),
  account_item_name: z.string().max(200).optional(),
  account_category_name: z.string().max(200).optional(),
  account_group_name: z.string().max(200).optional(),
  total_line: z.boolean().optional(),
  hierarchy_level: z.number().int().min(1).max(20),
  opening_balance: z.number().safe().int(),
  debit_amount: z.number().safe().int(),
  credit_amount: z.number().safe().int(),
  closing_balance: z.number().safe().int(),
});
const trial = z.object({
  company_id: z.number().int().positive(),
  start_date: z.string(),
  end_date: z.string(),
  balances: z.array(balance).min(1).max(500),
});
export function parseExecutiveStatements(
  pl: unknown,
  bs: unknown,
  companyId: number,
  period: string,
  fiscalStart: string,
) {
  const dates = monthlyFreeeWindow(period);
  if (
    !/^20\d{2}-(0[1-9]|1[0-2])-01$/.test(fiscalStart) ||
    fiscalStart > dates.start
  )
    throw new Error("会計年度を確認できませんでした。");
  parseExecutivePL(pl, companyId, period);
  function rows(raw: unknown, kind: "pl" | "bs") {
    const input = z
      .object({
        up_to_date: z.literal(true),
        trial_pl: trial.optional(),
        trial_bs: trial.optional(),
      })
      .parse(raw);
    const t = kind === "pl" ? input.trial_pl : input.trial_bs;
    if (
      !t ||
      t.company_id !== companyId ||
      t.start_date !== dates.start ||
      t.end_date !== dates.end
    )
      throw new Error("試算表の対象事業所・月を確認できませんでした。");
    const ids = t.balances
      .filter((r) => r.account_item_id)
      .map((r) => r.account_item_id);
    if (new Set(ids).size !== ids.length)
      throw new Error("試算表の科目が重複しています。");
    return t.balances.map((r) => ({
      id: r.account_item_id ?? null,
      name: r.account_item_name || r.account_category_name || "科目名未設定",
      category: r.account_category_name || "未分類",
      group: r.account_group_name || "",
      level: r.hierarchy_level,
      total: r.total_line ?? false,
      opening: r.opening_balance,
      debit: r.debit_amount,
      credit: r.credit_amount,
      closing: r.closing_balance,
    }));
  }
  const plRows = rows(pl, "pl"),
    bsRows = rows(bs, "bs");
  function total(name: string) {
    const match = bsRows.filter((r) => r.total && r.category === name);
    if (match.length !== 1)
      throw new Error("B/Sの合計区分を一意に確認できませんでした。");
    return match[0].closing;
  }
  const assets = total("資産"),
    liabilities = total("負債"),
    equity = total("純資産");
  if (assets !== liabilities + equity)
    throw new Error("B/Sの貸借が一致しません。");
  const cashRows = bsRows.filter(
    (r) => r.id !== null && r.category === "現金・預金",
  );
  const cash = cashRows.length
    ? cashRows.reduce((sum, r) => sum + r.closing, 0)
    : null;
  if (cash !== null && !Number.isSafeInteger(cash))
    throw new Error("現預金の金額を確認できませんでした。");
  return {
    basis: "freee-trial-v1" as const,
    fiscalStart,
    startDate: dates.start,
    endDate: dates.end,
    bsTotals: {
      assets,
      liabilities,
      equity,
      cash,
      currentAssets: total("流動資産"),
      currentLiabilities: total("流動負債"),
    },
    pl: plRows,
    bs: bsRows,
  };
}
