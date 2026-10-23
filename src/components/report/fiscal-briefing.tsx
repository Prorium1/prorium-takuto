"use client";
import { useId, useState } from "react";
import type { FiscalSource } from "@/lib/domain/fiscal";
import { fiscalSummary } from "@/lib/domain/fiscal";
import { yen, yoyPresentation } from "@/lib/domain/finance";
import { formatReportTimestamp } from "@/lib/domain/provenance";
import type { OwnershipSnapshot } from "@/lib/domain/ownership";
import { OwnershipView } from "@/components/ownership-view";
import { EventSpotlight } from "./event-spotlight";
import { FiscalManagementSummary } from "./fiscal-management-summary";
const signed = (n: number) => `${n > 0 ? "+" : ""}${yen(n)}`;
function chartScale(values: number[]) {
  const lo = Math.min(0, ...values),
    hi = Math.max(1, ...values),
    span = hi - lo,
    pad = span * 0.12;
  return {
    y: (v: number) => 270 - ((v - lo + pad) / (span + pad * 2)) * 230,
    ticks: Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4),
  };
}
const x = (i: number) => 160 + i * 75;
const path = (values: (number | null)[], y: (n: number) => number) =>
  values
    .map((v, i) =>
      v === null
        ? ""
        : `${i === 0 || values[i - 1] === null ? "M" : "L"}${x(i)} ${y(v)}`,
    )
    .join(" ");
export function FiscalBriefing({
  source: s,
  ownership,
  referenceVideo,
  mock = false,
}: {
  source: FiscalSource;
  ownership: OwnershipSnapshot | null;
  referenceVideo?: { occurredOn: string; videoUrl: string };
  mock?: boolean;
}) {
  const stats = fiscalSummary(s),
    latest = s.months.at(-1)!,
    months = s.previousFiscalYear.map(
      (p) => `${Number(p.period.slice(0, 4)) + 1}${p.period.slice(4)}`,
    );
  const [metric, setMetric] = useState<"revenue" | "operatingProfit">(
      "revenue",
    ),
    [bsMetric, setBsMetric] = useState<
      "cash" | "assets" | "liabilities" | "equity"
    >("cash");
  const [revInput, setRevInput] = useState(String(stats.monthlyRevenue)),
    [profitInput, setProfitInput] = useState(String(stats.monthlyProfit));
  const amount = (v: string) =>
    v.trim() !== "" &&
    Number.isSafeInteger(Number(v)) &&
    Math.abs(Number(v)) <= 100_000_000_000_000
      ? Number(v)
      : null;
  const rev = amount(revInput),
    profit = amount(profitInput),
    valid = rev !== null && rev >= 0 && profit !== null;
  const forecast = valid
    ? {
        revenue: stats.actual.revenue + rev * stats.remainingMonths,
        operatingProfit:
          stats.actual.operatingProfit + profit * stats.remainingMonths,
      }
    : null;
  const target =
    metric === "revenue"
      ? s.outlook?.targetRevenue
      : s.outlook?.targetOperatingProfit;
  const selectedForecast = forecast?.[metric] ?? null;
  const actualRunning: number[] = [];
  s.months.forEach((m, i) =>
    actualRunning.push((actualRunning[i - 1] || 0) + m.monthly[metric]),
  );
  const priorRunning: number[] = [];
  s.previousFiscalYear.forEach((m, i) =>
    priorRunning.push((priorRunning[i - 1] || 0) + m.metrics[metric]),
  );
  const futureRunning = months.map((_, i) =>
    i < s.months.length - 1
      ? null
      : i === s.months.length - 1
        ? actualRunning.at(-1)!
        : selectedForecast === null
          ? null
          : stats.actual[metric] +
            ((selectedForecast - stats.actual[metric]) *
              (i - s.months.length + 1)) /
              Math.max(1, stats.remainingMonths),
  );
  const scale = chartScale([
    ...actualRunning,
    ...priorRunning,
    ...(selectedForecast === null ? [] : [selectedForecast]),
    ...(target == null ? [] : [target]),
  ]);
  const monthlyValues = months.map(
    (_, i) =>
      s.months[i]?.monthly[metric] ??
      (!valid ? null : metric === "revenue" ? rev : profit),
  );
  const monthlyScale = chartScale([
    ...monthlyValues.filter((v): v is number => v !== null),
    ...s.previousFiscalYear.map((p) => p.metrics[metric]),
  ]);
  const bsValues = s.months.map((m) => m.bsTotals[bsMetric]),
    bsScale = chartScale(bsValues.filter((v): v is number => v !== null));
  const bridge = [
    { label: "前年同期", value: stats.previous.operatingProfit },
    {
      label: "売上の増減",
      value: stats.actual.revenue - stats.previous.revenue,
    },
    {
      label: "原価の増減",
      value: -(stats.actual.costOfSales - stats.previous.costOfSales),
    },
    { label: "販管費の増減", value: -(stats.actual.sga - stats.previous.sga) },
    { label: "今期累計", value: stats.actual.operatingProfit },
  ];
  const running = [bridge[0].value];
  for (let i = 1; i < 4; i++) running.push(running[i - 1] + bridge[i].value);
  const bridgeScale = chartScale([...running, bridge[4].value]);
  const id = useId(),
    progress = stats.targetProgress;
  const latestStamp = s.months.reduce(
    (a, m) => (m.retrievedAt < a ? m.retrievedAt : a),
    s.months[0].retrievedAt,
  );
  const metricLabel = metric === "revenue" ? "売上高" : "営業利益";
  return (
    <article className="fiscal-briefing">
      <header className="fiscal-hero">
        <div>
          <span className="fiscal-status">
            管理者専用 · 説明用 · 未公開{mock ? " · 架空データ" : ""}
          </span>
          <p className="eyebrow">PRORIUM / FISCAL YEAR {s.fiscalEndYear}</p>
          <h1>
            今期の現在地と、
            <br />
            <span>着地への道筋。</span>
          </h1>
          <p className="fiscal-period">
            {s.fiscalEndYear - 1}年11月 — {s.fiscalEndYear}年10月
          </p>
          <p>
            {latest.period.replace("-", "年")}
            月までの会計実績と、実績未取得分の参考シナリオ。
          </p>
          <p className="presentation-source">
            freee · 最も古い取得 {formatReportTimestamp(latestStamp)}
            {mock ? " · 未接続" : ""}
          </p>
        </div>
        <div className="fiscal-goal">
          <span>通期売上目標</span>
          <strong>
            {s.outlook?.targetRevenue == null
              ? "未登録"
              : yen(s.outlook.targetRevenue)}
          </strong>
          <div className="fiscal-ring">
            <svg viewBox="0 0 180 180" aria-hidden="true">
              <circle cx="90" cy="90" r="74" />
              <circle
                cx="90"
                cy="90"
                r="74"
                className="fiscal-ring-fill"
                strokeDasharray={`${Math.min(1, Math.max(0, progress ?? 0)) * 465} 465`}
                transform="rotate(-90 90 90)"
              />
            </svg>
            <div>
              <b>
                {progress === null ? "—" : `${(progress * 100).toFixed(1)}%`}
              </b>
              <span>会計実績 / 売上目標</span>
            </div>
          </div>
          <p>
            {stats.requiredRevenue === null ? (
              "目標確認後に差額を表示"
            ) : stats.requiredRevenue === 0 ? (
              "会計実績は目標以上です"
            ) : (
              <>
                目標まで <b>{yen(stats.requiredRevenue)}</b>
              </>
            )}
          </p>
        </div>
      </header>
      <nav className="fiscal-nav" aria-label="今期全体の目次">
        {s.managementSummary && <a href="#fiscal-management">経営サマリー</a>}
        <a href="#fiscal-overview">現在地</a>
        <a href="#fiscal-landing">着地と目標</a>
        <a href="#fiscal-monthly">月次推移</a>
        <a href="#fiscal-profit">利益の内訳</a>
        <a href="#fiscal-bs">財務状態</a>
        <a href="#fiscal-evidence">数字の根拠</a>
        {referenceVideo && <a href="#event">大会映像</a>}
        {ownership && <a href="#fiscal-ownership">株主構成</a>}
      </nav>
      <section id="fiscal-overview" className="fiscal-section">
        <div className="fiscal-section-heading">
          <span>01 / CURRENT POSITION</span>
          <h2>今期、ここまで。</h2>
          <p>
            {s.months[0].period}〜{latest.period}の{s.months.length}
            か月累計。仮締め・未締めを含む会計データです。
          </p>
        </div>
        <div className="fiscal-kpis">
          {(
            [
              ["累計売上", stats.actual.revenue, stats.previous.revenue],
              [
                "累計営業利益",
                stats.actual.operatingProfit,
                stats.previous.operatingProfit,
              ],
              [
                "累計経常利益",
                stats.actual.ordinaryProfit,
                stats.previous.ordinaryProfit,
              ],
              ["月末現預金", latest.bsTotals.cash, null],
            ] as const
          ).map(([label, value, prior]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{value === null ? "未取得" : <>{yen(value)}</>}</strong>
              {value === null && <p>現預金科目の確認待ち</p>}
              {prior !== null && value !== null ? (
                <p className={value >= prior ? "positive" : "negative"}>
                  {yoyPresentation(value, prior).label}
                  <small> 前年同期比</small>
                </p>
              ) : (
                <p>{latest.period}末残高 · 将来予測ではありません</p>
              )}
            </article>
          ))}
        </div>
        <div className="fiscal-timeline" aria-label="会計データの対象月">
          {months.map((p, i) => (
            <div
              key={p}
              className={i < s.months.length ? "is-actual" : "is-forecast"}
            >
              <b>{Number(p.slice(5))}月</b>
              <span>{i < s.months.length ? "会計実績" : "参考予測"}</span>
            </div>
          ))}
        </div>
      </section>
      {s.managementSummary && (
        <FiscalManagementSummary summary={s.managementSummary} />
      )}
      <section id="fiscal-landing" className="fiscal-section">
        <div className="fiscal-section-heading">
          <span>02 / YEAR-END OUTLOOK</span>
          <h2>目標まで、あとどれくらい。</h2>
          <p>会社の目標・経営者予想・機械的な試算を分けて表示しています。</p>
        </div>
        <div className="fiscal-landing-grid">
          <article>
            <span>経営者が共有した着地目標</span>
            <h3>会社の目標</h3>
            <dl>
              <dt>売上</dt>
              <dd>
                {s.outlook?.targetRevenue == null
                  ? "未確認"
                  : yen(s.outlook.targetRevenue)}
              </dd>
              <dt>営業利益</dt>
              <dd>
                {s.outlook?.targetOperatingProfit == null
                  ? "未確認"
                  : yen(s.outlook.targetOperatingProfit)}
              </dd>
            </dl>
            <p>
              {s.outlook?.sourceLabel || "目標の登録待ち"}
              {s.outlook && ` · ${s.outlook.asOf}`}
            </p>
          </article>
          <article>
            <span>経営者の見立て</span>
            <h3>経営者の着地予想</h3>
            <dl>
              <dt>売上</dt>
              <dd>
                {s.outlook?.forecastRevenue == null
                  ? "未確認"
                  : yen(s.outlook.forecastRevenue)}
              </dd>
              <dt>営業利益</dt>
              <dd>
                {s.outlook?.forecastOperatingProfit == null
                  ? "未確認"
                  : yen(s.outlook.forecastOperatingProfit)}
              </dd>
            </dl>
            <p>機械的な試算を、経営者の予想として扱っていません。</p>
          </article>
          <article className="fiscal-reference">
            <span>FORECAST / 参考シナリオ</span>
            <h3>実績と仮定からの参考着地</h3>
            <dl>
              <dt>売上</dt>
              <dd>{forecast ? yen(forecast.revenue) : "入力を確認"}</dd>
              <dt>営業利益</dt>
              <dd>
                {forecast ? signed(forecast.operatingProfit) : "入力を確認"}
              </dd>
            </dl>
            <p>
              累計実績＋実績未取得{stats.remainingMonths}
              か月の仮定。将来の結果を保証しません。
            </p>
          </article>
        </div>
        <div className="fiscal-gap">
          <div>
            <span>売上目標まで必要な金額</span>
            <strong>
              {stats.requiredRevenue === null
                ? "未登録"
                : yen(stats.requiredRevenue)}
            </strong>
            <p>実績未取得分 {stats.remainingMonths}か月で必要な合計。</p>
          </div>
          <div>
            <span>参考着地と売上目標の差</span>
            <strong>
              {forecast && s.outlook?.targetRevenue != null
                ? signed(forecast.revenue - s.outlook.targetRevenue)
                : "—"}
            </strong>
            <p>参考シナリオに対する差額。実績の差額ではありません。</p>
          </div>
        </div>
        <div className="fiscal-simulation">
          <div>
            <h3>参考シナリオを試す</h3>
            <p>
              初期値は直近{Math.min(3, s.months.length)}
              か月の単月平均。この画面だけの試算で、保存・公開されません。
            </p>
          </div>
          <label>
            実績未取得分の月平均売上（円）
            <input
              type="number"
              min="0"
              step="1"
              value={revInput}
              onChange={(e) => setRevInput(e.target.value)}
            />
          </label>
          <label>
            実績未取得分の月平均営業利益（円）
            <input
              type="number"
              step="1"
              value={profitInput}
              onChange={(e) => setProfitInput(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setRevInput(String(stats.monthlyRevenue));
              setProfitInput(String(stats.monthlyProfit));
            }}
          >
            直近平均に戻す
          </button>
          {!valid && (
            <p role="alert">
              売上は0円以上、営業利益は整数で入力してください。空欄を0円とは扱いません。
            </p>
          )}
        </div>
        <div
          className="fiscal-chart-controls"
          role="group"
          aria-label="表示する通期指標"
        >
          <button
            aria-pressed={metric === "revenue"}
            onClick={() => setMetric("revenue")}
          >
            売上高
          </button>
          <button
            aria-pressed={metric === "operatingProfit"}
            onClick={() => setMetric("operatingProfit")}
          >
            営業利益
          </button>
        </div>
        <div className="fiscal-chart-card">
          <div className="fiscal-chart-title">
            <h3>{metricLabel}の累計と着地</h3>
            <span>単位：円</span>
          </div>
          <div className="fiscal-legend">
            <span className="legend-current">今期実績</span>
            <span className="legend-prior">前期実績</span>
            <span className="legend-forecast">参考予測</span>
            {target != null && <span className="legend-target">着地目標</span>}
          </div>
          <div className="fiscal-svg-scroll">
            <svg
              viewBox="0 0 1040 320"
              role="img"
              aria-label={`${metricLabel}の今期累計・前期実績・参考着地の比較`}
            >
              {scale.ticks.map((t) => (
                <g key={t}>
                  <line
                    x1="148"
                    x2="1000"
                    y1={scale.y(t)}
                    y2={scale.y(t)}
                    className="fiscal-grid-line"
                  />
                  <text x="138" y={scale.y(t) + 4} textAnchor="end">
                    {yen(t)}
                  </text>
                </g>
              ))}
              {target != null && (
                <line
                  x1="148"
                  x2="1000"
                  y1={scale.y(target)}
                  y2={scale.y(target)}
                  className="fiscal-target-line"
                />
              )}
              <path
                d={path(priorRunning, scale.y)}
                className="fiscal-prior-line"
              />
              <path
                d={path(actualRunning, scale.y)}
                className="fiscal-actual-line"
              />
              <path
                d={path(futureRunning, scale.y)}
                className="fiscal-forecast-line"
              />
              {actualRunning.map((v, i) => (
                <circle
                  key={i}
                  cx={x(i)}
                  cy={scale.y(v)}
                  r="4"
                  className="fiscal-actual-dot"
                >
                  <title>{`${months[i]}累計 ${yen(v)}`}</title>
                </circle>
              ))}
              {months.map((p, i) => (
                <text key={p} x={x(i)} y="302" textAnchor="middle">
                  {Number(p.slice(5))}月
                </text>
              ))}
            </svg>
          </div>
          <p className="presentation-note">
            実績は実線、参考予測は紫の破線。前期は通期実績です。目標達成率と時間の経過率は異なります。
          </p>
        </div>
      </section>
      <section id="fiscal-monthly" className="fiscal-section">
        <div className="fiscal-section-heading">
          <span>03 / MONTHLY PERFORMANCE</span>
          <h2>どの月が、今期を動かしたか。</h2>
          <p>現在選択中：{metricLabel}。前期の同じ月と比較できます。</p>
        </div>
        <div className="fiscal-chart-card">
          <div className="fiscal-legend">
            <span className="legend-current">今期単月</span>
            <span className="legend-prior">前年同月</span>
            <span className="legend-forecast">参考予測</span>
          </div>
          <div className="fiscal-svg-scroll">
            <svg
              viewBox="0 0 1040 320"
              role="img"
              aria-label={`${metricLabel}の12か月単月推移`}
            >
              <defs>
                <pattern
                  id={id}
                  width="8"
                  height="8"
                  patternUnits="userSpaceOnUse"
                >
                  <path d="M0 8L8 0" stroke="#9b8ac5" strokeWidth="2" />
                </pattern>
              </defs>
              {monthlyScale.ticks.map((t) => (
                <g key={t}>
                  <line
                    x1="148"
                    x2="1000"
                    y1={monthlyScale.y(t)}
                    y2={monthlyScale.y(t)}
                    className="fiscal-grid-line"
                  />
                  <text x="138" y={monthlyScale.y(t) + 4} textAnchor="end">
                    {yen(t)}
                  </text>
                </g>
              ))}
              <line
                x1="148"
                x2="1000"
                y1={monthlyScale.y(0)}
                y2={monthlyScale.y(0)}
                stroke="#718398"
              />
              {months.map((p, i) => {
                const current = monthlyValues[i],
                  prev = s.previousFiscalYear[i].metrics[metric];
                return (
                  <g key={p}>
                    <rect
                      x={x(i) - 20}
                      y={Math.min(monthlyScale.y(0), monthlyScale.y(prev))}
                      width="17"
                      height={Math.max(
                        1,
                        Math.abs(monthlyScale.y(prev) - monthlyScale.y(0)),
                      )}
                      fill="#dce3eb"
                    >
                      <title>{`前年同月 ${yen(prev)}`}</title>
                    </rect>
                    {current !== null && (
                      <rect
                        x={x(i) + 1}
                        y={Math.min(monthlyScale.y(0), monthlyScale.y(current))}
                        width="23"
                        height={Math.max(
                          1,
                          Math.abs(monthlyScale.y(current) - monthlyScale.y(0)),
                        )}
                        fill={
                          i < s.months.length
                            ? current >= 0
                              ? "#326bb0"
                              : "#aa666c"
                            : `url(#${id})`
                        }
                        stroke={i < s.months.length ? "none" : "#8a72b1"}
                      >
                        <title>{`${i < s.months.length ? "会計実績" : "参考予測"} ${yen(current)}`}</title>
                      </rect>
                    )}
                    <text x={x(i)} y="302" textAnchor="middle">
                      {Number(p.slice(5))}月
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </section>
      <section id="fiscal-profit" className="fiscal-section">
        <div className="fiscal-section-heading">
          <span>04 / PROFIT BRIDGE</span>
          <h2>利益の変化を、一本の流れに。</h2>
          <p>前年同期からの営業利益差額を、売上・原価・販管費に分解。</p>
        </div>
        <div className="fiscal-chart-card">
          <div className="fiscal-svg-scroll">
            <svg
              viewBox="0 0 1040 320"
              role="img"
              aria-label="前年同期営業利益から今期累計営業利益への増減内訳"
            >
              <line
                x1="50"
                x2="1000"
                y1={bridgeScale.y(0)}
                y2={bridgeScale.y(0)}
                className="fiscal-grid-line"
              />
              {bridge.map((b, i) => {
                const start = i === 0 || i === 4 ? 0 : running[i - 1],
                  end = i === 0 || i === 4 ? b.value : running[i],
                  left = 70 + i * 195;
                return (
                  <g key={b.label}>
                    <rect
                      x={left}
                      y={Math.min(bridgeScale.y(start), bridgeScale.y(end))}
                      width="115"
                      height={Math.max(
                        2,
                        Math.abs(bridgeScale.y(start) - bridgeScale.y(end)),
                      )}
                      rx="3"
                      fill={
                        i === 0 || i === 4
                          ? "#326bb0"
                          : b.value >= 0
                            ? "#539c8b"
                            : "#b4767b"
                      }
                    />
                    <text
                      x={left + 57}
                      y={
                        Math.min(bridgeScale.y(start), bridgeScale.y(end)) - 10
                      }
                      textAnchor="middle"
                    >
                      {yen(b.value)}
                    </text>
                    <text x={left + 57} y="302" textAnchor="middle">
                      {b.label}
                    </text>
                    <title>{`${b.label} ${signed(b.value)}`}</title>
                  </g>
                );
              })}
            </svg>
          </div>
          <p className="presentation-note">
            単位：円。会計上の内訳であり、事業・案件の原因を断定するものではありません。前年との原価・販管費の区分の比較可能性は確認が必要です。
          </p>
        </div>
      </section>
      <section id="fiscal-bs" className="fiscal-section">
        <div className="fiscal-section-heading">
          <span>05 / FINANCIAL POSITION</span>
          <h2>資金と財務体力の推移。</h2>
          <p>B/Sは各月末の残高。売上・利益の累計値とは分けて見ます。</p>
        </div>
        <div className="presentation-balances">
          {(
            [
              ["総資産", latest.bsTotals.assets],
              ["負債", latest.bsTotals.liabilities],
              ["純資産", latest.bsTotals.equity],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <span>
                {latest.period}末 {label}
              </span>
              <strong>{yen(value)}</strong>
            </div>
          ))}
        </div>
        <div
          className="fiscal-chart-controls"
          role="group"
          aria-label="表示するB/S指標"
        >
          {(
            [
              ["cash", "現預金"],
              ["assets", "総資産"],
              ["liabilities", "負債"],
              ["equity", "純資産"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              aria-pressed={bsMetric === key}
              onClick={() => setBsMetric(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="fiscal-chart-card">
          <div className="fiscal-svg-scroll">
            <svg
              viewBox="0 0 1040 320"
              role="img"
              aria-label="選択したB/S項目の月末残高推移"
            >
              {bsScale.ticks.map((t) => (
                <g key={t}>
                  <line
                    x1="148"
                    x2="1000"
                    y1={bsScale.y(t)}
                    y2={bsScale.y(t)}
                    className="fiscal-grid-line"
                  />
                  <text x="138" y={bsScale.y(t) + 4} textAnchor="end">
                    {yen(t)}
                  </text>
                </g>
              ))}
              <path
                d={path(bsValues, bsScale.y)}
                className="fiscal-actual-line"
              />
              {bsValues.map((v, i) =>
                v === null ? null : (
                  <circle
                    key={i}
                    cx={x(i)}
                    cy={bsScale.y(v)}
                    r="4"
                    className="fiscal-actual-dot"
                  >
                    <title>{`${s.months[i].period}末 ${yen(v)}`}</title>
                  </circle>
                ),
              )}
              {months.map((p, i) => (
                <text key={p} x={x(i)} y="302" textAnchor="middle">
                  {Number(p.slice(5))}月
                </text>
              ))}
            </svg>
          </div>
          <p className="presentation-note">
            単位：円。月次固定費は未確認のため、現預金が何か月分あるかは算定していません。
          </p>
        </div>
      </section>
      <section id="fiscal-evidence" className="fiscal-section">
        <div className="fiscal-section-heading">
          <span>06 / DATA & EVIDENCE</span>
          <h2>数字の根拠を、その場で。</h2>
          <p>単月値＝P/Lの期末残高−期首残高。累計値＝対象月の単月値の合計。</p>
        </div>
        <details className="fiscal-data">
          <summary>PL・BSの月次一覧と取得日時を開く</summary>
          <div className="presentation-table-wrap">
            <table className="presentation-table">
              <thead>
                <tr>
                  <th>対象月</th>
                  <th>売上高</th>
                  <th>売上原価</th>
                  <th>販管費</th>
                  <th>営業利益</th>
                  <th>経常利益</th>
                  <th>月末現預金</th>
                  <th>月末純資産</th>
                  <th>締め設定</th>
                  <th>取得</th>
                </tr>
              </thead>
              <tbody>
                {s.months.map((m) => {
                  const end = new Date(
                    Date.UTC(
                      Number(m.period.slice(0, 4)),
                      Number(m.period.slice(5)),
                      0,
                    ),
                  )
                    .toISOString()
                    .slice(0, 10);
                  return (
                    <tr key={m.period}>
                      <th>{m.period} · 会計実績</th>
                      {(
                        [
                          m.monthly.revenue,
                          m.monthly.costOfSales,
                          m.monthly.sga,
                          m.monthly.operatingProfit,
                          m.monthly.ordinaryProfit,
                          m.bsTotals.cash,
                          m.bsTotals.equity,
                        ] as (number | null)[]
                      ).map((v, i) => (
                        <td key={i}>{v === null ? "未取得" : yen(v)}</td>
                      ))}
                      <td>
                        {m.nativeClosedThrough && end <= m.nativeClosedThrough
                          ? "本締め"
                          : m.temporaryClosedThrough &&
                              end <= m.temporaryClosedThrough
                            ? "仮締め"
                            : "未締め"}
                      </td>
                      <td>{formatReportTimestamp(m.retrievedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
        <div className="fiscal-source-note">
          <p>
            締め設定はfreee上の本締め・仮締めの状態です。経営者による別途の月次確認とは分けて表示しています。
          </p>
          <p>
            出典：freee会計（会計実績・前期比較・B/S）、経営者の共有内容（会社目標）。Notionの部門別売上予測は全社会計の目標へ転用していません。
          </p>
          {s.outlook?.sourceUrl && (
            <a href={s.outlook.sourceUrl} target="_blank" rel="noreferrer">
              目標・経営者予想の出典を見る
            </a>
          )}
          <p>
            {s.managementSummary
              ? "事業の進捗とAI活用は、上記の経営者説明に記載しています。数値化したAI効果、開発・採用・株主へのお願いは追加の確認待ちです。"
              : "成長の事業要因、AIの売上・効率への寄与、開発・採用・株主へのお願いは経営者の確認待ちです。未入力を0件や効果なしとは扱いません。"}
          </p>
        </div>
      </section>
      {referenceVideo && (
        <EventSpotlight
          period={latest.period}
          print={false}
          event={{
            occurredOn: referenceVideo.occurredOn,
            videoUrl: referenceVideo.videoUrl,
            title: "映像で振り返る、現場の記録。",
            videoTitle: "大会の記録映像",
            summary:
              "経営者から共有された大会映像です。会計数値や売上への寄与を示す資料ではありません。",
            outcomes: [],
            nextAction: "",
          }}
        />
      )}
      {ownership && (
        <section id="fiscal-ownership" className="fiscal-section">
          <OwnershipView snapshot={ownership} preview />
          <p className="presentation-note">
            株主構成は名簿の基準日時点。財務実績の対象期間とは異なります。
          </p>
        </section>
      )}
      <footer className="presentation-footer">
        経営者の画面共有用プレビューです。仮締め・未締めを含む会計データ、未確認の情報、参考シナリオを区別しています。公開済みの株主レポート・承認済みのSnapshotは変更しません。
      </footer>
    </article>
  );
}
