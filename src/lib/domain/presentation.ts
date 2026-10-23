import { z } from "zod";
const amount = z.number().int().safe();
export const presentationMetricsSchema = z
  .object({
    revenue: amount,
    costOfSales: amount,
    grossProfit: amount,
    sga: amount,
    operatingProfit: amount,
    ordinaryProfit: amount,
  })
  .strict();
const metrics = presentationMetricsSchema;
const period = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
export const presentationSourceSchema = z
  .object({
    period,
    basis: z.literal("monthly-net-v2"),
    retrievedAt: z.iso.datetime({ offset: true }),
    monthly: metrics,
    previousYear: metrics,
    bsTotals: z
      .object({
        assets: amount,
        liabilities: amount,
        equity: amount,
        cash: amount.nullable(),
        currentAssets: amount,
        currentLiabilities: amount,
      })
      .strict(),
    trend: z
      .array(
        z
          .object({
            period,
            retrievedAt: z.iso.datetime({ offset: true }),
            revenue: amount,
            previousRevenue: amount,
            profit: amount,
            previousProfit: amount,
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict()
  .superRefine((s, ctx) => {
    const invalid = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    for (const m of [s.monthly, s.previousYear])
      if (
        m.revenue - m.costOfSales !== m.grossProfit ||
        m.grossProfit - m.sga !== m.operatingProfit
      )
        invalid("P/Lの整合性を確認してください。");
    if (s.bsTotals.assets !== s.bsTotals.liabilities + s.bsTotals.equity)
      invalid("B/Sの貸借が一致しません。");
    if (
      s.trend.some(
        (p, i) =>
          p.period > s.period || (i > 0 && p.period <= s.trend[i - 1].period),
      )
    )
      invalid("月次推移の対象月を確認してください。");
    const latest = s.trend.at(-1);
    if (
      !latest ||
      latest.period !== s.period ||
      latest.revenue !== s.monthly.revenue ||
      latest.profit !== s.monthly.operatingProfit ||
      latest.previousRevenue !== s.previousYear.revenue ||
      latest.previousProfit !== s.previousYear.operatingProfit
    )
      invalid("当月と月次推移が一致しません。");
  });
export type PresentationSource = z.infer<typeof presentationSourceSchema>;
