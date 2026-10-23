import { z } from "zod";
import {
  presentationMetricsSchema as metrics,
  presentationSourceSchema,
} from "./presentation";
const period = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),
  amount = z.number().safe().int();
const sourceUrl = z.url().refine((v) => v.startsWith("https://"));
export const fiscalManagementSummarySchema = z
  .object({
    asOf: z.iso.date(),
    sourceLabel: z.string().min(2).max(160),
    headline: z.string().min(2).max(180),
    overview: z.string().min(2).max(1200),
    funding: z
      .array(
        z
          .object({
            period: z.string().min(1).max(60),
            text: z.string().min(2).max(600),
          })
          .strict(),
      )
      .min(1)
      .max(12),
    business: z.array(z.string().min(2).max(600)).min(1).max(8),
    efficiency: z.array(z.string().min(2).max(600)).min(1).max(8),
    outlook: z.array(z.string().min(2).max(600)).min(1).max(8),
    schoolLaunches: z
      .object({
        confirmed: z
          .array(
            z
              .object({ name: z.string().min(2).max(160), period, sourceUrl })
              .strict(),
          )
          .max(100),
        totalAdded: z.number().int().min(-1000).max(1000).nullable(),
        note: z.string().min(2).max(1200),
        sourceUrl,
      })
      .strict(),
  })
  .strict();
export const fiscalOutlookSchema = z
  .object({
    targetRevenue: amount.nonnegative().nullable(),
    targetOperatingProfit: amount.nullable(),
    forecastRevenue: amount.nonnegative().nullable(),
    forecastOperatingProfit: amount.nullable(),
    sourceLabel: z.string().min(2).max(160),
    sourceUrl: z
      .url()
      .refine((v) => v.startsWith("https://"))
      .nullable(),
    asOf: z.iso.date(),
  })
  .strict();
export const fiscalSourceSchema = z
  .object({
    fiscalEndYear: z.number().int().min(2020).max(2099),
    asOf: z.iso.date(),
    months: z
      .array(
        z
          .object({
            period,
            retrievedAt: z.iso.datetime({ offset: true }),
            monthly: metrics,
            previousYear: metrics,
            bsTotals: presentationSourceSchema.shape.bsTotals,
            nativeClosedThrough: z.iso.date().nullable(),
            temporaryClosedThrough: z.iso.date().nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(12),
    previousFiscalYear: z
      .array(z.object({ period, metrics }).strict())
      .length(12),
    outlook: fiscalOutlookSchema.nullable(),
    managementSummary: fiscalManagementSummarySchema.nullish().default(null),
  })
  .strict()
  .superRefine((s, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const expected = (i: number, offset = 0) =>
      new Date(Date.UTC(s.fiscalEndYear - 1 - offset, 10 + i, 1))
        .toISOString()
        .slice(0, 7);
    const balanced = (m: z.infer<typeof metrics>) =>
      m.revenue - m.costOfSales === m.grossProfit &&
      m.grossProfit - m.sga === m.operatingProfit;
    for (const [i, m] of s.months.entries()) {
      if (m.period !== expected(i) || m.period >= s.asOf.slice(0, 7))
        fail("月次実績の対象月・欠損を確認してください。");
      if (
        !balanced(m.monthly) ||
        !balanced(m.previousYear) ||
        m.bsTotals.assets !== m.bsTotals.liabilities + m.bsTotals.equity
      )
        fail("P/L・B/Sの整合性を確認してください。");
      const prior = s.previousFiscalYear[i];
      if (
        prior &&
        Object.keys(m.previousYear).some(
          (k) =>
            m.previousYear[k as keyof typeof m.previousYear] !==
            prior.metrics[k as keyof typeof prior.metrics],
        )
      )
        fail("前年同月の比較値が一致しません。");
    }
    for (const [i, m] of s.previousFiscalYear.entries())
      if (m.period !== expected(i, 1) || !balanced(m.metrics))
        fail("前期実績の整合性を確認してください。");
    if (s.outlook && s.outlook.asOf > s.asOf)
      fail("目標の確認日を確認してください。");
    if (s.managementSummary) {
      if (s.managementSummary.asOf > s.asOf)
        fail("経営サマリーの基準日を確認してください。");
      const schools = s.managementSummary.schoolLaunches;
      if (
        new Set(schools.confirmed.map((s) => `${s.name}:${s.period}`)).size !==
        schools.confirmed.length
      )
        fail("スクールを重複して集計できません。");
      if (
        schools.confirmed.some(
          (p) =>
            p.period < expected(0) ||
            p.period > `${s.fiscalEndYear}-10` ||
            p.period > s.managementSummary!.asOf.slice(0, 7),
        )
      )
        fail("今期以外のローンチを集計できません。");
    }
  });
export type FiscalSource = z.infer<typeof fiscalSourceSchema>;
export type FiscalMetrics = z.infer<typeof metrics>;
export function fiscalSummary(s: FiscalSource) {
  const sum = (rows: FiscalMetrics[]) =>
    Object.fromEntries(
      Object.keys(rows[0]).map((k) => [
        k,
        rows.reduce((n, r) => n + r[k as keyof FiscalMetrics], 0),
      ]),
    ) as FiscalMetrics;
  const actual = sum(s.months.map((m) => m.monthly)),
    previous = sum(s.months.map((m) => m.previousYear)),
    previousFullYear = sum(s.previousFiscalYear.map((m) => m.metrics));
  const sample = s.months.slice(-3),
    remainingMonths = 12 - s.months.length;
  const monthlyRevenue = Math.round(
      sample.reduce((n, m) => n + m.monthly.revenue, 0) / sample.length,
    ),
    monthlyProfit = Math.round(
      sample.reduce((n, m) => n + m.monthly.operatingProfit, 0) / sample.length,
    );
  const reference = {
    revenue: actual.revenue + monthlyRevenue * remainingMonths,
    operatingProfit: actual.operatingProfit + monthlyProfit * remainingMonths,
  };
  const target = s.outlook?.targetRevenue ?? null;
  return {
    actual,
    previous,
    previousFullYear,
    remainingMonths,
    monthlyRevenue,
    monthlyProfit,
    reference,
    requiredRevenue:
      target === null ? null : Math.max(0, target - actual.revenue),
    targetProgress:
      target !== null && target > 0 ? actual.revenue / target : null,
  };
}
