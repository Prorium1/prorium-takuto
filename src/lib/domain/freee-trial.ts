import { z } from "zod";

const periodSchema = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
export function monthlyFreeeWindow(period: string) {
  periodSchema.parse(period);
  const [year, month] = period.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: `${period}-01`, end: `${period}-${String(lastDay).padStart(2, "0")}` };
}

const balanceSchema = z.object({
  account_item_id: z.number().int().positive().optional(),
  account_item_name: z.string().max(200).optional(),
  account_group_name: z.string().max(200).optional(),
  account_category_name: z.string().max(200).optional(),
  total_line: z.boolean().optional(),
  hierarchy_level: z.number().int().min(1).max(20),
  closing_balance: z.number().safe().int(),
});
const trialSchema = z.object({
  up_to_date: z.boolean(),
  trial_pl: z.object({
    company_id: z.number().int().positive(), start_date: z.string(), end_date: z.string(),
    balances: z.array(balanceSchema).min(1).max(10000),
  }).optional(),
  trial_bs: z.object({
    company_id: z.number().int().positive(), start_date: z.string(), end_date: z.string(),
    balances: z.array(balanceSchema).min(1).max(10000),
  }).optional(),
});

export function validateFreeeTrial(input: unknown, kind: "pl" | "bs", companyId: number, period: string) {
  const dates = monthlyFreeeWindow(period);
  const parsed = trialSchema.safeParse(input);
  if (!parsed.success) throw new Error("freeeの金額または残高試算表の形式を確認してください。");
  if (!parsed.data.up_to_date) throw new Error("freeeの集計が未完了です。時間をおいて再取得してください。");
  const trial = kind === "pl" ? parsed.data.trial_pl : parsed.data.trial_bs;
  if (!trial || trial.company_id !== companyId) throw new Error("freee事業所が一致しません。");
  if (trial.start_date !== dates.start || trial.end_date !== dates.end) throw new Error("freeeの対象月が一致しません。");
  return {
    companyId,
    period,
    kind,
    balances: trial.balances.map((row) => ({
      accountItemId: row.account_item_id ?? null,
      accountItemName: row.account_item_name ?? null,
      accountGroupName: row.account_group_name ?? null,
      accountCategoryName: row.account_category_name ?? null,
      totalLine: row.total_line ?? false,
      hierarchyLevel: row.hierarchy_level,
      closingBalance: row.closing_balance,
    })),
  };
}
