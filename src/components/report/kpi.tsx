import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import type { FinancialSnapshot } from "@/lib/domain/types";
import { yenAmount, yoyPresentation } from "@/lib/domain/finance";
import {
  financialBasis,
  financialProvenance,
  formatReportTimestamp,
} from "@/lib/domain/provenance";

export function KpiGrid({ financial }: { financial: FinancialSnapshot }) {
  const basis = financialBasis(financial);
  const source = financialProvenance(financial);
  const yen = (value: number) => `${value.toLocaleString("ja-JP")}円`;
  const cards = [
    { key: "revenue", label: "売上高", en: "REVENUE" },
    { key: "operatingProfit", label: "営業利益", en: "OPERATING PROFIT" },
    { key: "ordinaryProfit", label: "経常利益", en: "ORDINARY PROFIT" },
    { key: "cash", label: "現預金", en: "CASH · MONTH END" },
  ] as const;
  return (
    <div className="kpi-grid">
      {cards.map(({ key, label, en }) => {
        const metric = financial[key];
        const yoy = yoyPresentation(metric.current, metric.previous);
        const comparable = basis.monthly || key === "cash";
        return (
          <article className="kpi-card" key={key}>
            <div className="kpi-label">
              {label}
              <span className="status-dot" title={metric.status} />
            </div>
            <span className="kpi-en">{en}</span>
            <div className="kpi-value">
              {yenAmount(metric.current)}
              <span>円</span>
            </div>
            <div className="kpi-comparison">
              <span
                className={
                  yoy.direction === "flat"
                    ? "comparison-neutral"
                    : yoy.delta > 0
                      ? "positive"
                      : "negative"
                }
              >
                {yoy.direction === "flat" ? (
                  <Minus size={16} />
                ) : yoy.delta > 0 ? (
                  <ArrowUpRight size={16} />
                ) : (
                  <ArrowDownRight size={16} />
                )}
                {comparable ? yoy.label : "集計基準の確認待ち"}
              </span>
              {comparable && <span>YoY</span>}
              <span className="kpi-status">{metric.status}</span>
            </div>
            <div className="kpi-baseline">
              {comparable ? "前年同月" : "比較値"}{" "}
              <strong>{yenAmount(metric.previous)}</strong> 円
            </div>
            {yoy.note && <p className="comparison-note">{yoy.note}</p>}
            <details className="kpi-evidence">
              <summary aria-label={`${label}の根拠`}>数値の根拠</summary>
              <p>
                {key === "cash"
                  ? "対象月の月末残高 / 前年同月末との比較"
                  : basis.label}
              </p>
              <dl>
                <dt>{key === "cash" ? "月末残高" : "表示値"}</dt>
                <dd>{yen(metric.current)}</dd>
                <dt>前年の比較値</dt>
                <dd>{yen(metric.previous)}</dd>
                <dt>増減額</dt>
                <dd>
                  {metric.current - metric.previous > 0 ? "+" : ""}
                  {yen(metric.current - metric.previous)}
                </dd>
              </dl>
              <p>
                {metric.previous > 0
                  ? "増減率＝（表示値−前年の比較値）÷前年の比較値×100"
                  : "前年の比較値が0以下のため、増減率を算定せず差額を表示します。"}
              </p>
              <p>
                {source.source} · {financial.period}
              </p>
              {source.updatedAt && (
                <p>取得・入力 {formatReportTimestamp(source.updatedAt)}</p>
              )}
              <p>公開レポートは承認時の数値を固定して保存します。</p>
            </details>
          </article>
        );
      })}
    </div>
  );
}
