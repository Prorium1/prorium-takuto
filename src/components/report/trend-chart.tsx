"use client";
import { useId, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronDown, Minus } from "lucide-react";
import type { FinancialSnapshot } from "@/lib/domain/types";
import {
  financialChartScale,
  millions,
  yoyPresentation,
} from "@/lib/domain/finance";

export function TrendChart({
  financial,
  provisional = false,
}: {
  financial: Pick<FinancialSnapshot, "period" | "trend" | "isMock">;
  provisional?: boolean;
}) {
  const [metric, setMetric] = useState<"revenue" | "profit">("revenue");
  const [range, setRange] = useState(6);
  const [hover, setHover] = useState<number | null>(null);
  const [selection, setSelection] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const tableId = useId();
  const areaId = useId();
  const points = financial.trend.slice(-range);
  const priorKey = metric === "revenue" ? "previousRevenue" : "previousProfit";
  const { ticks, y } = financialChartScale(
    points.flatMap((p) => [p[metric], p[priorKey]]),
    metric === "revenue" ? 20_000_000 : 3_000_000,
  );
  const x = (i: number) =>
    points.length === 1 ? 439 : 64 + i * (750 / (points.length - 1));
  const line = (
    key: "revenue" | "profit" | "previousRevenue" | "previousProfit",
  ) =>
    points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p[key])}`)
      .join(" ");
  const selectedIndex = Math.min(
    hover ?? selection ?? points.length - 1,
    points.length - 1,
  );
  const selected = points[selectedIndex];
  if (!selected)
    return <p className="section-empty">推移データは未掲載です。</p>;
  const yoy = yoyPresentation(selected[metric], selected[priorKey]);
  return (
    <div className="chart-card">
      <div className="chart-toolbar">
        <div className="chart-tabs" role="group" aria-label="表示する指標">
          <button
            type="button"
            aria-pressed={metric === "revenue"}
            className={metric === "revenue" ? "selected" : ""}
            onClick={() => {
              setMetric("revenue");
              setHover(null);
              setSelection(null);
            }}
          >
            売上高
          </button>
          <button
            type="button"
            aria-pressed={metric === "profit"}
            className={metric === "profit" ? "selected" : ""}
            onClick={() => {
              setMetric("profit");
              setHover(null);
              setSelection(null);
            }}
          >
            営業利益
          </button>
        </div>
        <div className="chart-range" role="group" aria-label="表示期間">
          {(financial.trend.length > 6 ? [12, 6, 3] : [6, 3]).map((v) => (
            <button
              type="button"
              aria-pressed={range === v}
              className={range === v ? "selected" : ""}
              key={v}
              onClick={() => {
                setRange(v);
                setHover(null);
                setSelection(null);
              }}
            >
              {v}か月
            </button>
          ))}
        </div>
      </div>
      <div className="chart-stat">
        <div>
          <span>
            {selected.month}の{metric === "revenue" ? "売上高" : "営業利益"}
          </span>
          <strong>
            {millions(selected[metric])}
            <small>百万円</small>
          </strong>
        </div>
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
            <Minus size={15} />
          ) : yoy.delta > 0 ? (
            <ArrowUpRight size={15} />
          ) : (
            <ArrowDownRight size={15} />
          )}
          {yoy.label}
          <small>YoY</small>
        </span>
        <div className="chart-legend">
          <span>
            <i />
            当期
          </span>
          <span>
            <i />
            前年同月
          </span>
        </div>
      </div>
      <p className="chart-prior-value">
        前年同月 <strong>{millions(selected[priorKey])}</strong> 百万円
        <span>
          差額 {yoy.delta > 0 ? "+" : ""}
          {millions(yoy.delta)} 百万円
        </span>
      </p>
      {yoy.note && (
        <p className="comparison-note chart-comparison-note">{yoy.note}</p>
      )}
      <div className="chart-svg-wrap">
        <svg
          viewBox="0 0 864 258"
          role="group"
          aria-label={`${metric === "revenue" ? "売上高" : "営業利益"}の前年同月比較、${points.length}か月。各月を選択できます。詳細は下の数値表を参照。`}
        >
          <title>{`月次推移・前年同月比較${provisional ? "（会計確認待ち）" : ""}`}</title>
          <defs>
            <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3976ce" stopOpacity=".18" />
              <stop offset="100%" stopColor="#3976ce" stopOpacity=".015" />
            </linearGradient>
          </defs>
          {ticks.map((value, i) => {
            return (
              <g key={i}>
                <line
                  x1="64"
                  x2="814"
                  y1={y(value)}
                  y2={y(value)}
                  stroke="#dce3ec"
                />
                <text
                  x="40"
                  y={y(value) + 4}
                  textAnchor="end"
                  fill="#586c7b"
                  fontSize="11"
                >
                  {millions(value, 0)}
                </text>
              </g>
            );
          })}
          {points.length > 1 && (
            <path
              d={`${line(metric)} L ${x(points.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`}
              fill={`url(#${areaId})`}
            />
          )}
          <line x1="64" x2="814" y1={y(0)} y2={y(0)} stroke="#d6dae4" />
          <path
            d={line(priorKey)}
            fill="none"
            stroke="#718297"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            className="chart-series chart-series-prior"
          />
          <path
            d={line(metric)}
            fill="none"
            stroke="var(--report-accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            className="chart-series chart-series-current"
          />
          {points.map((p, i) => (
            <g key={p.month}>
              <text
                x={x(i)}
                y="250"
                textAnchor="middle"
                fill="#586c7b"
                fontSize="12"
              >
                {p.month}
              </text>
              <rect
                x={x(i) - 3}
                y={y(p[priorKey]) - 3}
                width="6"
                height="6"
                fill="white"
                stroke="#718297"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={x(i)}
                cy={y(p[metric])}
                r={i === selectedIndex ? 5 : 3}
                fill="var(--report-accent)"
                stroke="white"
                strokeWidth="2"
              />
              <rect
                x={x(i) - Math.min(64, 375 / Math.max(1, points.length - 1))}
                y="20"
                width={Math.min(128, 750 / Math.max(1, points.length - 1))}
                height="215"
                fill="transparent"
                className="chart-point-target"
                role="button"
                tabIndex={0}
                aria-label={`${p.month}の${metric === "revenue" ? "売上高" : "営業利益"} ${millions(p[metric])}百万円`}
                aria-pressed={i === selectedIndex}
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse") setHover(i);
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType === "mouse") setHover(null);
                }}
                onPointerUp={(event) => {
                  if (event.pointerType !== "mouse") setSelection(i);
                }}
                onClick={() => setSelection(i)}
                onFocus={() => setSelection(i)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelection(i);
                  }
                }}
              />
            </g>
          ))}
        </svg>
      </div>
      <div className="chart-footer">
        <span>
          単位：百万円 ·{" "}
          {provisional ? "freee取込候補・会計確認待ち" : "単月実績"}
          {financial.isMock && " · Mock Data"}
        </span>
        <button
          type="button"
          className="text-button"
          aria-expanded={table}
          aria-controls={tableId}
          onClick={() => setTable(!table)}
        >
          数値を見る
          <ChevronDown size={13} />
        </button>
      </div>
      <div className="table-wrap" id={tableId} hidden={!table}>
        <table className="data-table">
          <caption className="sr-only">月次数値の前年同月比較</caption>
          <thead>
            <tr>
              <th>月</th>
              <th>当期</th>
              <th>前年同月</th>
              <th>YoY</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => {
              const comparison = yoyPresentation(p[metric], p[priorKey]);
              return (
                <tr key={p.month}>
                  <td>{p.month}</td>
                  <td>{millions(p[metric])}</td>
                  <td>{millions(p[priorKey])}</td>
                  <td>
                    {comparison.label}
                    {comparison.note && (
                      <small className="comparison-note">
                        {comparison.note}
                      </small>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
