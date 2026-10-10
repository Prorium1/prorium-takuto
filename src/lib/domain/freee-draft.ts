import { z } from "zod";
import { emptyReport } from "./monthly";
import { stagedRowSchema } from "./freee-staging";

export const freeeConfirmationSchema = z.object({
  monthlyFixedCosts: z.number().safe().int().nonnegative(),
  revenueReason: z.string().trim().min(10).max(1000),
  profitReason: z.string().trim().min(10).max(1000),
});

export function buildFreeeDraftContent(rawStage: unknown, companyId: string, rawConfirmation: unknown) {
  const stage = stagedRowSchema.parse(rawStage);
  const confirmation = freeeConfirmationSchema.parse(rawConfirmation);
  if (stage.candidate.completeness === "month-to-date" || stage.period !== stage.candidate.period || stage.period !== stage.provenance.period)
    throw new Error("月途中の数値は月次レポートの下書きにできません。");
  if (stage.candidate.assets !== stage.candidate.liabilities + stage.candidate.equity)
    throw new Error("貸借の一致を確認してください。");
  const content = emptyReport(stage.period, companyId).content;
  const f = stage.candidate;
  content.financial = {
    ...content.financial,
    source: "freee", available: true, updatedAt: stage.provenance.retrievedAt,
    revenue: { ...f.revenue, status: "freee・管理者確認" },
    operatingProfit: { ...f.operatingProfit, status: "freee・管理者確認" },
    ordinaryProfit: { ...f.ordinaryProfit, status: "freee・管理者確認" },
    cash: { ...f.cash, status: "freee・対象科目確認" },
    assets: f.assets, liabilities: f.liabilities, equity: f.equity,
    monthlyFixedCosts: confirmation.monthlyFixedCosts,
  };
  content.revenueDrivers = [{ label: "経営者の確認", amount: f.revenue.current - f.revenue.previous, description: confirmation.revenueReason }];
  content.profitDrivers = [{ label: "経営者の確認", amount: f.operatingProfit.current - f.operatingProfit.previous, description: confirmation.profitReason }];
  content.financialAnalysis = `売上の変化: ${confirmation.revenueReason}\n営業利益の変化: ${confirmation.profitReason}`;
  return content;
}

export function buildPendingFreeeDraftContent(rawStage: unknown, companyId: string) {
  const content = buildFreeeDraftContent(rawStage, companyId, {
    monthlyFixedCosts: 0,
    revenueReason: "売上の増減理由は経営者の追記待ちです。",
    profitReason: "営業利益の増減理由は経営者の追記待ちです。",
  });
  content.financial.revenue.status = "freee・会計確認済み";
  content.financial.operatingProfit.status = "freee・会計確認済み";
  content.financial.ordinaryProfit.status = "freee・会計確認済み";
  content.financial.cash.status = "freee・対象科目確認済み";
  return content;
}
