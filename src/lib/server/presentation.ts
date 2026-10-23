import "server-only";
import type { Actor, ReportVersion } from "../domain/types";
import { presentationSourceSchema } from "../domain/presentation";
import { isMockEnvironment } from "./environment";
export async function getPresentationSource(
  actor: Actor,
  report: ReportVersion,
) {
  if (actor.role !== "admin" || actor.companyId !== report.companyId)
    throw new Error("管理者権限が必要です。");
  if (isMockEnvironment()) {
    const f = report.content.financial;
    if (f.available === false) return null;
    const metrics = (
      revenue: number,
      operatingProfit: number,
      ordinaryProfit: number,
    ) => {
      const costOfSales = Math.round(revenue * 0.3),
        grossProfit = revenue - costOfSales;
      return {
        revenue,
        costOfSales,
        grossProfit,
        sga: grossProfit - operatingProfit,
        operatingProfit,
        ordinaryProfit,
      };
    };
    return presentationSourceSchema.parse({
      period: report.period,
      basis: "monthly-net-v2",
      retrievedAt: f.updatedAt,
      monthly: metrics(
        f.revenue.current,
        f.operatingProfit.current,
        f.ordinaryProfit.current,
      ),
      previousYear: metrics(
        f.revenue.previous,
        f.operatingProfit.previous,
        f.ordinaryProfit.previous,
      ),
      bsTotals: {
        assets: f.assets,
        liabilities: f.liabilities,
        equity: f.equity,
        cash: f.cash.current,
        currentAssets: f.assets,
        currentLiabilities: f.liabilities,
      },
      trend: [
        {
          period: report.period,
          retrievedAt: f.updatedAt,
          revenue: f.revenue.current,
          previousRevenue: f.revenue.previous,
          profit: f.operatingProfit.current,
          previousProfit: f.operatingProfit.previous,
        },
      ],
    });
  }
  const { productionClient, databaseError } =
    await import("./production-repository");
  const client = await productionClient(actor, true);
  const { data, error } = await client.rpc("ir_get_presentation_source", {
    p_id: report.id,
  });
  databaseError(error);
  if (data === null) return null;
  const parsed = presentationSourceSchema.safeParse(data);
  if (!parsed.success) return null;
  const source = parsed.data;
  if (source.period !== report.period)
    throw new Error("対象月が一致しません。");
  return source;
}
