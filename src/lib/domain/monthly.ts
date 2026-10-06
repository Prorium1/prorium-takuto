import { randomUUID } from "node:crypto";
import { z } from "zod";
import { periodSchema } from "./validation";
import type { ReportContent, ReportVersion } from "./types";
import { contentHash } from "./workflow";

export const monthlyNotesSchema = z
  .string()
  .trim()
  .min(10, "今月あったことを10文字以上で入力してください。")
  .max(12_000);
export const monthlySummarySchema = z.object({
  headline: z.string().trim().min(1).max(100),
  text: z.string().trim().min(1).max(2000),
  points: z.array(z.string().trim().min(1).max(300)).min(1).max(5),
  outlook: z.string().trim().max(500),
});
export function structureMonthlyNotes(
  period: string,
  notes: string,
): ReportContent["summary"] {
  periodSchema.parse(period);
  const text = monthlyNotesSchema.parse(notes);
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-・•]\s*/, "").trim())
    .filter(Boolean);
  return {
    headline: `${Number(period.slice(5))}月の事業と経営のアップデート`,
    text: text.slice(0, 2000),
    points: lines.slice(0, 3).map((l) => l.slice(0, 300)),
    outlook: "",
  };
}
export function emptyReport(period: string, companyId: string): ReportVersion {
  periodSchema.parse(period);
  const at = new Date().toISOString();
  const metric = () => ({ current: 0, previous: 0, status: "未入力" });
  const content: ReportContent = {
    financial: {
      id: randomUUID(),
      period,
      currency: "JPY",
      isMock: false,
      available: false,
      source: "not-entered",
      updatedAt: at,
      revenue: metric(),
      operatingProfit: metric(),
      ordinaryProfit: metric(),
      cash: metric(),
      trend: [],
      assets: 0,
      liabilities: 0,
      equity: 0,
      monthlyFixedCosts: 0,
    },
    summary: { headline: "今月のサマリー", text: "", points: [], outlook: "" },
    financialAnalysis: "財務資料をご確認ください。",
    revenueDrivers: [],
    profitDrivers: [],
    highlights: [],
    ai: { revenue: [], efficiency: [], narrative: "", attributionNote: "" },
    forward: [],
    risks: [],
    documents: [],
    ceo: {
      quote: "株主の皆さまへ",
      message: "",
      name: "Prorium 経営チーム",
      title: "CEO Commentary",
    },
  };
  return {
    id: randomUUID(),
    companyId,
    period,
    version: "v1.0",
    state: "draft",
    revision: 1,
    content,
    contentHash: contentHash(content),
    analysis: "not-generated",
    approvedHash: null,
    approvedBy: null,
    approvedAt: null,
    publishedAt: null,
    createdAt: at,
  };
}
const yen = z.number().int().min(-1e14).max(1e14);
export const financialEntrySchema = z
  .object({
    revenue: yen.nonnegative(),
    previousRevenue: yen.nonnegative(),
    operatingProfit: yen,
    previousOperatingProfit: yen,
    ordinaryProfit: yen,
    previousOrdinaryProfit: yen,
    cash: yen.nonnegative(),
    previousCash: yen.nonnegative(),
    assets: yen.nonnegative(),
    liabilities: yen.nonnegative(),
    equity: yen,
    monthlyFixedCosts: yen.nonnegative(),
    revenueReason: z.string().trim().min(1).max(1000),
    profitReason: z.string().trim().min(1).max(1000),
  })
  .refine((v) => v.assets === v.liabilities + v.equity, {
    message: "総資産 = 負債 + 純資産になるよう確認してください。",
    path: ["equity"],
  });
export type FinancialEntry = z.infer<typeof financialEntrySchema>;
export function applyFinancialEntry(
  content: ReportContent,
  raw: unknown,
): ReportContent {
  const v = financialEntrySchema.parse(raw);
  const next = structuredClone(content);
  next.financial = {
    ...next.financial,
    id: randomUUID(),
    isMock: false,
    available: true,
    source: "management-entry",
    updatedAt: new Date().toISOString(),
    revenue: {
      current: v.revenue,
      previous: v.previousRevenue,
      status: "管理者確認",
    },
    operatingProfit: {
      current: v.operatingProfit,
      previous: v.previousOperatingProfit,
      status: "管理者確認",
    },
    ordinaryProfit: {
      current: v.ordinaryProfit,
      previous: v.previousOrdinaryProfit,
      status: "管理者確認",
    },
    cash: { current: v.cash, previous: v.previousCash, status: "月末残高" },
    assets: v.assets,
    liabilities: v.liabilities,
    equity: v.equity,
    monthlyFixedCosts: v.monthlyFixedCosts,
    trend: [],
  };
  next.revenueDrivers = [
    {
      label: "管理者による変化要因",
      amount: v.revenue - v.previousRevenue,
      description: v.revenueReason,
    },
  ];
  next.profitDrivers = [
    {
      label: "管理者による変化要因",
      amount: v.operatingProfit - v.previousOperatingProfit,
      description: v.profitReason,
    },
  ];
  next.financialAnalysis = `${v.revenueReason}\n${v.profitReason}`;
  return next;
}
