import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { FinancialSnapshot } from "@/lib/domain/types";
import { compareYoY, millions, percent } from "@/lib/domain/finance";

export function KpiGrid({ financial }: { financial: FinancialSnapshot }) {
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
        const yoy = compareYoY(metric.current, metric.previous);
        return (
          <article className="kpi-card" key={key}>
            <div className="kpi-label">
              {label}
              <span className="status-dot" title={metric.status} />
            </div>
            <span className="kpi-en">{en}</span>
            <div className="kpi-value">
              {millions(metric.current)}
              <span>百万円</span>
            </div>
            <div className="kpi-comparison">
              <span className={yoy.delta >= 0 ? "positive" : "negative"}>
                {yoy.delta >= 0 ? (
                  <ArrowUpRight size={16} />
                ) : (
                  <ArrowDownRight size={16} />
                )}
                {yoy.percent === null
                  ? `${millions(yoy.delta)}百万円`
                  : percent(yoy.percent)}
              </span>
              <span>YoY</span>
              <span className="kpi-status">{metric.status}</span>
            </div>
            <div className="kpi-baseline">
              前年同月 <strong>{millions(metric.previous)}</strong> 百万円
            </div>
          </article>
        );
      })}
    </div>
  );
}
