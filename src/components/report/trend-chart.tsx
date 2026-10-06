"use client";
import { useState } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import type { FinancialSnapshot } from "@/lib/domain/types";
import { compareYoY, millions, percent } from "@/lib/domain/finance";

export function TrendChart({ financial }: { financial: FinancialSnapshot }) {
  const [metric, setMetric] = useState<"revenue" | "profit">("revenue");
  const [range, setRange] = useState(6);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const points = financial.trend.slice(-range);
  const priorKey = metric === "revenue" ? "previousRevenue" : "previousProfit";
  const year = Number(financial.period.slice(0, 4));
  const max =
    Math.ceil(
      Math.max(...points.map((p) => Math.max(p[metric], p[priorKey]))) /
        (metric === "revenue" ? 20_000_000 : 3_000_000),
    ) * (metric === "revenue" ? 20_000_000 : 3_000_000);
  const x = (i: number) => 64 + i * (750 / (points.length - 1));
  const y = (v: number) => 222 - (v / max) * 190;
  const line = (
    key: "revenue" | "profit" | "previousRevenue" | "previousProfit",
  ) =>
    points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p[key])}`)
      .join(" ");
  const selected = points[hover ?? points.length - 1];
  const yoy = compareYoY(selected[metric], selected[priorKey]);
  return (
    <div className="chart-card">
      <div className="chart-toolbar">
        <div className="chart-tabs" role="group" aria-label="表示する指標">
          <button
            className={metric === "revenue" ? "selected" : ""}
            onClick={() => {
              setMetric("revenue");
              setHover(null);
            }}
          >
            売上高
          </button>
          <button
            className={metric === "profit" ? "selected" : ""}
            onClick={() => {
              setMetric("profit");
              setHover(null);
            }}
          >
            営業利益
          </button>
        </div>
        <div className="chart-range" role="group" aria-label="表示期間">
          {[6, 3].map((v) => (
            <button
              className={range === v ? "selected" : ""}
              key={v}
              onClick={() => {
                setRange(v);
                setHover(null);
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
        <span className="positive">
          <ArrowUpRight size={15} />
          {yoy.percent !== null ? percent(yoy.percent) : "比較対象なし"}
          <small>YoY</small>
        </span>
        <div className="chart-legend">
          <span>
            <i />
            {year}
          </span>
          <span>
            <i />
            {year - 1}
          </span>
        </div>
      </div>
      <div className="chart-svg-wrap">
        <svg
          viewBox="0 0 864 258"
          role="img"
          aria-label={`${metric === "revenue" ? "売上高" : "営業利益"}の前年同月比較、${range}か月。詳細は下の数値表を参照。`}
        >
          <title>月次推移・前年同月比較</title>
          {[0, 1, 2, 3].map((i) => {
            const value = (max * i) / 3;
            return (
              <g key={i}>
                <line
                  x1="64"
                  x2="814"
                  y1={y(value)}
                  y2={y(value)}
                  stroke="#eceef3"
                  strokeDasharray={i === 0 ? undefined : "3 5"}
                />
                <text
                  x="40"
                  y={y(value) + 4}
                  textAnchor="end"
                  fill="#9097a6"
                  fontSize="11"
                >
                  {millions(value, 0)}
                </text>
              </g>
            );
          })}
          <path
            d={`${line(metric)} L ${x(points.length - 1)} 222 L 64 222 Z`}
            fill="#eeedfc"
            opacity=".75"
          />
          <path
            d={line(priorKey)}
            fill="none"
            stroke="#b8bdc9"
            strokeWidth="2"
            strokeDasharray="5 5"
          />
          <path
            d={line(metric)}
            fill="none"
            stroke="#625bd6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((p, i) => (
            <g key={p.month}>
              <text
                x={x(i)}
                y="250"
                textAnchor="middle"
                fill="#7a8190"
                fontSize="12"
              >
                {p.month}
              </text>
              <circle
                cx={x(i)}
                cy={y(p[metric])}
                r={i === (hover ?? points.length - 1) ? 5 : 3}
                fill="#625bd6"
                stroke="white"
                strokeWidth="2"
              />
              <rect
                x={x(i) - 28}
                y="20"
                width="56"
                height="215"
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          ))}
        </svg>
      </div>
      <div className="chart-footer">
        <span>単位：百万円 · 単月実績 · Mock Data</span>
        <button
          className="text-button"
          aria-expanded={table}
          onClick={() => setTable(!table)}
        >
          数値を見る
          <ChevronDown size={13} />
        </button>
      </div>
      {table && (
        <div className="table-wrap">
          <table className="data-table">
            <caption className="sr-only">月次数値の前年同月比較</caption>
            <thead>
              <tr>
                <th>月</th>
                <th>{year}年</th>
                <th>{year - 1}年</th>
                <th>YoY</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.month}>
                  <td>{p.month}</td>
                  <td>{millions(p[metric])}</td>
                  <td>{millions(p[priorKey])}</td>
                  <td>
                    {percent(compareYoY(p[metric], p[priorKey]).percent ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
