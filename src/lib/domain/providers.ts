import { randomUUID } from "node:crypto";
import { mockReportForPeriod } from "../mock/seed";
import { compareYoY, margin, millions } from "./finance";
import type {
  AnalysisDraft,
  Driver,
  FinancialSnapshot,
  ReportContent,
} from "./types";
import { periodSchema } from "./validation";

export interface FinancialImportProvider {
  import(period: string): Promise<{
    financial: FinancialSnapshot;
    revenueDrivers: Driver[];
    profitDrivers: Driver[];
    managementMetrics?: ReportContent["ai"];
  }>;
}
export interface AnalysisProvider {
  generate(content: ReportContent): Promise<AnalysisDraft>;
}

export class SyntheticFreeeProvider implements FinancialImportProvider {
  async import(period: string) {
    periodSchema.parse(period);
    const c = mockReportForPeriod(period).content;
    c.financial.id = `snapshot-${randomUUID()}`;
    c.financial.updatedAt = new Date().toISOString();
    if (c.financial.assets !== c.financial.liabilities + c.financial.equity)
      throw new Error("貸借が一致しません。");
    return {
      financial: c.financial,
      revenueDrivers: c.revenueDrivers,
      profitDrivers: c.profitDrivers,
      // Synthetic fixture only. A live freee adapter must obtain these metrics
      // from separately validated management data, not infer them from journals.
      managementMetrics: c.ai,
    };
  }
}

export class MockAnalysisProvider implements AnalysisProvider {
  async generate(content: ReportContent) {
    const f = content.financial;
    const yoy = compareYoY(f.revenue.current, f.revenue.previous);
    const operatingMargin = margin(
      f.operatingProfit.current,
      f.revenue.current,
    );
    const growth =
      yoy.percent === null
        ? `前年との差額は${millions(yoy.delta)}百万円`
        : `前年同月比${yoy.percent.toFixed(1)}%増`;
    return {
      summary: {
        headline: "成長を、利益につなげる。",
        text: `当月の売上高は${millions(f.revenue.current)}百万円、${growth}となりました。${content.revenueDrivers
          .filter((d) => d.amount > 0)
          .slice(0, 3)
          .map((d) => d.label)
          .join(
            "・",
          )}が成長を牽引しています。営業利益率は${operatingMargin.toFixed(1)}%。AIによる効率化と固定費の吸収が収益性の改善に寄与しています。`,
        points: [
          `売上高${millions(f.revenue.current)}百万円。成長要因を下記で確認。`,
          `営業利益${millions(f.operatingProfit.current)}百万円、営業利益率${operatingMargin.toFixed(1)}%。`,
          "AI関連売上と効率化効果を分けて管理。",
        ],
        outlook:
          "成長投資の進捗とAI原価を継続して監視します。将来指標は実績と区分しています。",
      },
      financialAnalysis: `売上高${millions(f.revenue.current)}百万円、営業利益${millions(f.operatingProfit.current)}百万円。変化要因の増減合計は当月と前年の差額に一致しています。先行投資とAI処理原価の変動が下振れ要因となるため、月次で進捗を確認します。`,
      positiveFactors: content.revenueDrivers
        .filter((d) => d.amount > 0)
        .map((d) => d.description),
      whyItChanged: [...content.revenueDrivers, ...content.profitDrivers].map(
        (d) =>
          `${d.label}：${d.amount >= 0 ? "+" : ""}${millions(d.amount)}百万円。${d.description}`,
      ),
      negativeFactors: content.profitDrivers
        .filter((d) => d.amount < 0)
        .map((d) => d.description),
      riskDraft: content.risks.map((r) => `${r.title}：${r.action}`),
      forwardDraft: content.forward.map(
        (f) => `[${f.kind}] ${f.title}：${f.value}`,
      ),
    };
  }
}
