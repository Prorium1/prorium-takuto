import type { FiscalSource } from "@/lib/domain/fiscal";
export function FiscalManagementSummary({
  summary,
}: {
  summary: NonNullable<FiscalSource["managementSummary"]>;
}) {
  const schools = summary.schoolLaunches;
  return (
    <section
      id="fiscal-management"
      className="fiscal-section fiscal-management"
    >
      <div className="fiscal-section-heading">
        <span>MANAGEMENT REVIEW</span>
        <h2>今期の経営サマリー</h2>
        <p>
          {summary.sourceLabel} · {summary.asOf}時点
        </p>
      </div>
      <div className="fiscal-management-lead">
        <h3>{summary.headline}</h3>
        <p>{summary.overview}</p>
      </div>
      <div className="fiscal-management-grid">
        <article>
          <span className="fiscal-management-number">01</span>
          <h3>資金面</h3>
          <ol className="fiscal-funding-timeline">
            {summary.funding.map((item, i) => (
              <li key={i}>
                <strong>{item.period}</strong>
                <p>{item.text}</p>
              </li>
            ))}
          </ol>
        </article>
        <article>
          <span className="fiscal-management-number">02</span>
          <h3>事業の進捗</h3>
          <ul>
            {summary.business.map((text, i) => (
              <li key={i}>{text}</li>
            ))}
          </ul>
          <div className="fiscal-school-count">
            <span>今期の新規ローンチを確認</span>
            <strong>{schools.confirmed.length}校</strong>
            <p>
              {schools.totalAdded === null
                ? "全体の純増は確認中"
                : `今期の${schools.totalAdded < 0 ? "純減" : "純増"} ${Math.abs(schools.totalAdded)}校`}
            </p>
          </div>
          {schools.confirmed.length > 0 && (
            <details>
              <summary>確認できたスクールと根拠を見る</summary>
              <ul>
                {schools.confirmed.map((s) => (
                  <li key={`${s.name}:${s.period}`}>
                    <a href={s.sourceUrl} target="_blank" rel="noreferrer">
                      {s.name}
                    </a>
                    <span> · {s.period}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="fiscal-school-note">{schools.note}</p>
          <a href={schools.sourceUrl} target="_blank" rel="noreferrer">
            集計元の社内資料を確認 →
          </a>
        </article>
        <article>
          <span className="fiscal-management-number">03</span>
          <h3>業務効率化と新規展開</h3>
          <ul>
            {summary.efficiency.map((text, i) => (
              <li key={i}>{text}</li>
            ))}
          </ul>
        </article>
        <article>
          <span className="fiscal-management-number">04</span>
          <h3>今後の展望</h3>
          <span className="fiscal-outlook-label">今後の方針・見通し</span>
          <ul>
            {summary.outlook.map((text, i) => (
              <li key={i}>{text}</li>
            ))}
          </ul>
        </article>
      </div>
      <p className="fiscal-summary-basis">
        財務KPIはfreeeの会計データ、事業の振り返りは経営者の共有内容に基づきます。事業情報の基準日と会計実績の対象月は異なります。AIによる費用削減額・利益への寄与額は未計測です。
      </p>
    </section>
  );
}
