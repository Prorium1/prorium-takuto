import type {
  FiscalPublication,
  Organization,
} from "@/lib/domain/fiscal-publication";
import { fiscalVersionLabel } from "@/lib/domain/fiscal-publication";
import { yen } from "@/lib/domain/finance";
import { formatReportTimestamp } from "@/lib/domain/provenance";
import { FiscalBriefing } from "./fiscal-briefing";
export function OrganizationView({
  organization: o,
}: {
  organization: Organization;
}) {
  const metrics = [
    ["社員", o.employees],
    ["アルバイト", o.partTime],
    ["役員", o.directors],
    ["業務委託", o.contractors],
  ] as const;
  return (
    <section className="fiscal-section fiscal-organization" id="organization">
      <div className="fiscal-section-heading">
        <span>PEOPLE & ORGANIZATION</span>
        <h2>事業を支える、人と体制。</h2>
        <p>
          {o.asOf}時点 · {o.sourceLabel}
        </p>
      </div>
      <div className="fiscal-people-grid">
        {metrics.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>
              {value === null ? (
                "確認中"
              ) : (
                <>
                  {value}
                  <small>名</small>
                </>
              )}
            </strong>
            {label === "社員" && (
              <p>
                {o.onLeave === null
                  ? "休業者の内訳は確認中"
                  : `うち休業中 ${o.onLeave}名を含む`}
              </p>
            )}
          </article>
        ))}
      </div>
      <p className="fiscal-people-note">
        休業中の人数は社員数の内数です。確認中の区分は0名とせず、全社合計は算出していません。
      </p>
      <div className="fiscal-operating-areas">
        <h3>事業を動かす担当領域</h3>
        <ul role="list">
          {o.areas.map((area) => (
            <li key={area}>{area}</li>
          ))}
        </ul>
        <p>
          兼務を含む担当領域の整理です。各領域の専任人数・指揮命令系統は示していません。
        </p>
      </div>
      {o.note && <p className="fiscal-people-note">{o.note}</p>}
    </section>
  );
}
export function FiscalPublicationView({
  report: r,
  mock = false,
  print = false,
}: {
  report: FiscalPublication;
  mock?: boolean;
  print?: boolean;
}) {
  const notes = r.content.notes;
  return (
    <div
      className="fiscal-publication"
      data-content-hash={r.contentHash}
      data-version={r.version}
    >
      <div
        className={`fiscal-publication-status ${r.state === "published" ? "is-published" : ""}`}
      >
        <strong>
          {r.state === "published" ? "株主限定・公開済み" : "確認用・未公開"}
        </strong>
        <span>
          {fiscalVersionLabel(r.version)} · 資料基準日 {r.content.source.asOf}
        </span>
      </div>
      <FiscalBriefing
        source={r.content.source}
        ownership={r.content.ownership}
        referenceVideo={r.content.video || undefined}
        mock={mock}
        audience="investor"
        print={print}
        afterSummary={
          <>
            <OrganizationView organization={r.content.organization} />
            <section className="fiscal-section fiscal-investor-notes">
              <div className="fiscal-section-heading">
                <span>BUSINESS UPDATE</span>
                <h2>進捗と、株主の皆さまへ。</h2>
              </div>
              <div className="fiscal-notes-grid">
                {(
                  [
                    ["development", "開発・サービスの進捗"],
                    ["hiring", "採用・組織の方針"],
                    ["requests", "株主にお願いしたいこと"],
                    ["risks", "リスクと確認中の事項"],
                  ] as const
                ).map(([key, title]) => (
                  <article key={key}>
                    <h3>{title}</h3>
                    <p>
                      {notes[key] ||
                        "今回の資料では未記載です。追加の情報は確認後にお知らせします。"}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </>
        }
      />
      <section className="fiscal-print-statements">
        <h2>P/L 月次一覧 · 売上と粗利益</h2>
        <p>単位：円 · 単月実績 · 未取得月は掲載していません。</p>
        <table>
          <thead>
            <tr>
              {["対象月", "売上高", "売上原価", "粗利益"].map((x) => (
                <th key={x}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.content.source.months.map((m) => (
              <tr key={m.period}>
                <th>{m.period}</th>
                {[
                  m.monthly.revenue,
                  m.monthly.costOfSales,
                  m.monthly.grossProfit,
                ].map((n, i) => (
                  <td key={i}>{yen(n)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <h2>P/L 月次一覧 · 費用と利益</h2>
        <p>単位：円 · 単月実績</p>
        <table>
          <thead>
            <tr>
              {["対象月", "販管費", "営業利益", "経常利益"].map((x) => (
                <th key={x}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.content.source.months.map((m) => (
              <tr key={m.period}>
                <th>{m.period}</th>
                {[
                  m.monthly.sga,
                  m.monthly.operatingProfit,
                  m.monthly.ordinaryProfit,
                ].map((n, i) => (
                  <td key={i}>{yen(n)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <h2>B/S 月次一覧</h2>
        <p>単位：円 · 月末残高</p>
        <table>
          <thead>
            <tr>
              {["対象月", "現預金", "総資産", "負債", "純資産"].map((x) => (
                <th key={x}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.content.source.months.map((m) => (
              <tr key={m.period}>
                <th>{m.period}</th>
                {[
                  m.bsTotals.cash,
                  m.bsTotals.assets,
                  m.bsTotals.liabilities,
                  m.bsTotals.equity,
                ].map((n, i) => (
                  <td key={i}>{n === null ? "未取得" : yen(n)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <h2>会計データの確認状況</h2>
        <p>
          出典：freee会計。締め設定はfreee上の状態です。経営者による別途の月次確認とは分けて記録しています。
        </p>
        <table className="fiscal-print-evidence">
          <thead>
            <tr>
              <th>対象月</th>
              <th>締め設定</th>
              <th>データ取得日時（日本時間）</th>
            </tr>
          </thead>
          <tbody>
            {r.content.source.months.map((m) => {
              const end = new Date(
                Date.UTC(
                  Number(m.period.slice(0, 4)),
                  Number(m.period.slice(5)),
                  0,
                ),
              )
                .toISOString()
                .slice(0, 10);
              const closed =
                m.nativeClosedThrough && end <= m.nativeClosedThrough
                  ? "本締め"
                  : m.temporaryClosedThrough && end <= m.temporaryClosedThrough
                    ? "仮締め"
                    : "未締め";
              return (
                <tr key={m.period}>
                  <th>{m.period}</th>
                  <td>{closed}</td>
                  <td>{formatReportTimestamp(m.retrievedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p>
          会計実績は{r.content.source.months.at(-1)?.period}まで。未取得月は
          {12 - r.content.source.months.length}
          か月です。未取得月を0円の実績として扱っていません。
        </p>
      </section>
    </div>
  );
}
