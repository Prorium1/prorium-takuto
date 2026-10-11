import { z } from "zod";
import { monthlyFreeeWindow } from "./freee-trial";
const row = z.object({
  account_item_id: z.number().int().positive().optional(),
  account_item_name: z.string().max(200).optional(),
  account_category_name: z.string().max(200).optional(),
  total_line: z.boolean().optional(),
  opening_balance: z.number().safe().int(),
  closing_balance: z.number().safe().int(),
});
const schema = z.object({
  up_to_date: z.literal(true),
  trial_pl: z.object({
    company_id: z.number().int().positive(),
    start_date: z.string(),
    end_date: z.string(),
    balances: z.array(row).min(1).max(1000),
  }),
});
const categories = {
  revenue: "売上高",
  costOfSales: "売上原価",
  grossProfit: "売上総損益金額",
  sga: "販売管理費",
  operatingProfit: "営業損益金額",
  ordinaryProfit: "経常損益金額",
} as const;
export function parseExecutivePL(
  raw: unknown,
  companyId: number,
  period: string,
) {
  const { trial_pl: p } = schema.parse(raw);
  const dates = monthlyFreeeWindow(period);
  if (
    p.company_id !== companyId ||
    p.start_date !== dates.start ||
    p.end_date !== dates.end
  )
    throw new Error("freeeの対象事業所・月を確認できませんでした。");
  const totals = (monthly: boolean) =>
    Object.fromEntries(
      Object.entries(categories).map(([key, category]) => {
        const matching = p.balances.filter(
          (r) => r.total_line && r.account_category_name === category,
        );
        if (matching.length !== 1)
          throw new Error("freeeの損益区分を一意に確認できませんでした。");
        const r = matching[0];
        return [
          key,
          monthly ? r.closing_balance - r.opening_balance : r.closing_balance,
        ];
      }),
    ) as Record<keyof typeof categories, number>;
  const monthly = totals(true);
  const cumulative = totals(false);
  for (const t of [monthly, cumulative])
    if (
      t.revenue - t.costOfSales !== t.grossProfit ||
      t.grossProfit - t.sga !== t.operatingProfit
    )
      throw new Error("freeeの損益に不整合があります。");
  return {
    monthly,
    cumulative,
    accounts: p.balances
      .filter((r) => r.account_item_id)
      .map((r) => ({
        id: r.account_item_id!,
        name: r.account_item_name || "科目名未設定",
        category: r.account_category_name || "未分類",
        monthly: r.closing_balance - r.opening_balance,
      })),
  };
}
export function executiveFinancial(
  period: string,
  current: ReturnType<typeof parseExecutivePL>,
  previous: ReturnType<typeof parseExecutivePL>,
  prior: ReturnType<typeof parseExecutivePL>,
  close: {
    nativeClosedThrough: string | null;
    temporaryClosedThrough: string | null;
  },
) {
  return {
    period,
    basis: "monthly-net-v2" as const,
    source: "freee" as const,
    retrievedAt: new Date().toISOString(),
    monthly: current.monthly,
    cumulative: current.cumulative,
    previousYear: prior.monthly,
    previousMonth: previous.monthly,
    accounts: current.accounts.map((a) => ({
      ...a,
      previousYear: prior.accounts.find((p) => p.id === a.id)?.monthly ?? null,
      previousMonth:
        previous.accounts.find((p) => p.id === a.id)?.monthly ?? null,
    })),
    ...close,
  };
}
