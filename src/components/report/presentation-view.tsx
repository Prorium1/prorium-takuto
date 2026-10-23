import type { PresentationSource } from "@/lib/domain/presentation";
import type { ReportVersion } from "@/lib/domain/types";
import type { OwnershipSnapshot } from "@/lib/domain/ownership";
import { millions, periodLabel, yoyPresentation } from "@/lib/domain/finance";
import { formatReportTimestamp } from "@/lib/domain/provenance";
import { TrendChart } from "./trend-chart";
import { EventSpotlight } from "./event-spotlight";
import { OwnershipView } from "@/components/ownership-view";
const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;
export function PresentationView({
  source: s,
  report,
  ownership,
}: {
  source: PresentationSource;
  report: ReportVersion;
  ownership: OwnershipSnapshot | null;
}) {
  const c = s.monthly,
    previous = s.previousYear;
  const revenue = yoyPresentation(c.revenue, previous.revenue);
  const grossChange = c.grossProfit - previous.grossProfit,
    expenseChange = c.sga - previous.sga;
  const signed = (n: number) => `${n > 0 ? "+" : ""}${yen(n)}`;
  return (
    <article className="presentation-report">
      <header className="presentation-header">
        <div className="presentation-status">
          管理者専用 · 説明用プレビュー · 未公開
        </div>
        <span className="eyebrow">PRORIUM / SHAREHOLDER BRIEFING</span>
        <h1>
          {periodLabel(s.period)}
          <span>経営の現在地</span>
        </h1>
        <p>freeeの単月実績と、確認できている情報を一つに。</p>
        <p className="presentation-source">
          {report.content.financial.isMock
            ? "架空データ · freee未接続"
            : "freee会計"}{" "}
          · 取得 {formatReportTimestamp(s.retrievedAt)}
        </p>
        <nav aria-label="説明用プレビューの目次">
          <a href="#presentation-trend">月次推移</a>
          <a href="#presentation-evidence">変化の内訳</a>
          <a href="#presentation-balance">財務状態</a>
          {ownership && <a href="#presentation-ownership">株主構成</a>}
          {report.content.eventSpotlight && <a href="#event">大会映像</a>}
        </nav>
      </header>
      <div className="kpi-grid">
        {(
          [
            ["売上高", c.revenue, previous.revenue],
            ["営業利益", c.operatingProfit, previous.operatingProfit],
            ["経常利益", c.ordinaryProfit, previous.ordinaryProfit],
            ["現預金", s.bsTotals.cash, null],
          ] as const
        ).map(([label, value, prior]) => (
          <article className="kpi-card" key={label}>
            <div className="kpi-label">{label}</div>
            <span className="kpi-en">
              {label === "現預金" ? "MONTH END" : "MONTHLY ACTUAL"}
            </span>
            <div className="kpi-value">
              {value === null ? (
                "未取得"
              ) : (
                <>
                  {millions(value)}
                  <span>百万円</span>
                </>
              )}
            </div>
            <p className="presentation-exact">
              {value === null ? "現預金科目の確認が必要です。" : yen(value)}
            </p>
            {prior !== null && value !== null ? (
              <div className="kpi-comparison">
                <strong className={value >= prior ? "positive" : "negative"}>
                  {yoyPresentation(value, prior).label}
                </strong>
                <span>前年同月比</span>
              </div>
            ) : (
              <p className="presentation-source">現預金の比較値は未取得</p>
            )}
            {prior !== null && (
              <p className="presentation-source">前年同月 {yen(prior)}</p>
            )}
          </article>
        ))}
      </div>
      <section className="presentation-summary">
        <span className="eyebrow">30 SECOND SUMMARY</span>
        <h2>売上と、収益性を分けて読む。</h2>
        <p>
          売上高は{yen(c.revenue)}、前年同月比{revenue.label}。営業
          {c.operatingProfit < 0 ? "損失" : "利益"}は
          {yen(Math.abs(c.operatingProfit))}でした。
        </p>
        <p>
          営業利益の前年差は
          {signed(c.operatingProfit - previous.operatingProfit)}
          。会計上は、粗利益の変化{signed(grossChange)}と、販管費の変化
          {signed(expenseChange)}
          で説明できます。事業・案件ごとの背景は未確認です。
        </p>
      </section>
      <section id="presentation-trend" className="report-section">
        <div className="section-heading">
          <div>
            <h2>月次で見る、事業の動き</h2>
            <p>売上・営業利益を切り替えて、前年同月と比較。</p>
          </div>
        </div>
        <TrendChart
          financial={{
            period: s.period,
            isMock: report.content.financial.isMock,
            trend: s.trend.map((p) => ({
              ...p,
              month: p.period.slice(2).replace("-", "/"),
            })),
          }}
          provisional
        />
        <details className="presentation-evidence">
          <summary>月次推移の取得日・算定方法</summary>
          <p>P/Lは各月の期末残高−期首残高。各月の取得時点の値です。</p>
          <ul>
            {s.trend.map((p) => (
              <li key={p.period}>
                {p.period} · {formatReportTimestamp(p.retrievedAt)}
              </li>
            ))}
          </ul>
        </details>
      </section>
      <section id="presentation-evidence" className="report-section">
        <div className="section-heading">
          <div>
            <h2>何が、どれだけ変わったか</h2>
            <p>会計上の増減と、経営者の説明を区別しています。</p>
          </div>
        </div>
        <div className="presentation-table-wrap">
          <table className="presentation-table">
            <thead>
              <tr>
                <th>単月の指標</th>
                <th>前年同月</th>
                <th>当月</th>
                <th>増減額</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["売上高", "revenue"],
                  ["売上原価", "costOfSales"],
                  ["粗利益", "grossProfit"],
                  ["販管費", "sga"],
                  ["営業利益", "operatingProfit"],
                  ["経常利益", "ordinaryProfit"],
                ] as const
              ).map(([label, key]) => (
                <tr key={key}>
                  <th>{label}</th>
                  <td>{yen(previous[key])}</td>
                  <td>{yen(c[key])}</td>
                  <td>{signed(c[key] - previous[key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="presentation-note">
          粗利益＝売上高−売上原価。営業利益＝粗利益−販管費。増減額＝当月−前年同月。
        </p>
        {previous.costOfSales === 0 && (
          <p className="presentation-note">
            前年同月の売上原価が0円のため、費用区分・計上基準の比較可能性は確認が必要です。
          </p>
        )}
      </section>
      <section id="presentation-balance" className="report-section">
        <div className="section-heading">
          <div>
            <h2>月末の財務状態</h2>
            <p>貸借対照表の残高。単月の売上・利益とは異なります。</p>
          </div>
        </div>
        <div className="presentation-balances">
          {(
            [
              ["総資産", s.bsTotals.assets],
              ["負債", s.bsTotals.liabilities],
              ["純資産", s.bsTotals.equity],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{yen(value)}</strong>
            </div>
          ))}
        </div>
      </section>
      {ownership && (
        <section id="presentation-ownership" className="report-section">
          <OwnershipView snapshot={ownership} preview />
          <p className="presentation-note">
            smartroundから取得した確認用の名簿です。未転換の新株予約権は発行済株式ベースの比率に含めていません。
          </p>
        </section>
      )}
      {report.content.eventSpotlight && (
        <EventSpotlight
          event={{
            title: "大会・イベント映像",
            occurredOn: report.content.eventSpotlight.occurredOn,
            summary:
              "管理画面に登録された参考映像です。大会の成果・事業への寄与は未確認です。",
            outcomes: [],
            nextAction: "",
            videoUrl: report.content.eventSpotlight.videoUrl,
            videoTitle: "登録された大会映像",
          }}
          period={s.period}
          print={false}
        />
      )}
      <section className="presentation-pending">
        <span className="eyebrow">TO BE CONFIRMED</span>
        <h2>確認が必要な情報</h2>
        <dl>
          <dt>月次固定費</dt>
          <dd>未確認 · 固定費に対する現預金の月数は算定していません。</dd>
          <dt>事業・案件ごとの増減理由</dt>
          <dd>未確認 · 会計上の内訳と事業の背景は分けて扱います。</dd>
          <dt>AIによる売上・利益への寄与</dt>
          <dd>未確認 · 寄与額や削減効果は掲載していません。</dd>
          <dt>開発・採用・資金調達・今後の見通し・株主へのお願い</dt>
          <dd>この画面では未確認。経営者の説明後に更新します。</dd>
        </dl>
      </section>
      <footer className="presentation-footer">
        この画面は取得済みデータを使った説明用プレビューです。経営者の確認・承認が完了した公開レポートではありません。下書きや公開済みのSnapshotは変更されません。
      </footer>
    </article>
  );
}
