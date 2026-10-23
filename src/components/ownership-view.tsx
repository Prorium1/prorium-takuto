import { ownershipRows, type OwnershipSnapshot } from "@/lib/domain/ownership";
const COLORS = [
  "#306db2",
  "#7462a3",
  "#4d8982",
  "#b5845d",
  "#668ba9",
  "#9d6a87",
  "#9caaaf",
];
export function OwnershipView({
  snapshot,
  print = false,
  headingLevel = 2,
  preview = false,
}: {
  snapshot: OwnershipSnapshot;
  print?: boolean;
  headingLevel?: 1 | 2;
  preview?: boolean;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const rows = ownershipRows(snapshot);
  const groups = ownershipRows({ ...snapshot, display: "grouped" });
  const circumference = 2 * Math.PI * 70;
  return (
    <div className={`ownership-view ${print ? "ownership-print" : ""}`}>
      <div className="ownership-heading">
        <div>
          <span className="eyebrow">SHAREHOLDER COMPOSITION</span>
          <Heading>株主構成</Heading>
          <p>基準日 {snapshot.asOf} · 発行済株式ベース</p>
        </div>
        <div>
          <span>発行済株式数</span>
          <strong>
            {snapshot.issuedShares.toLocaleString("ja-JP")}
            <small>株</small>
          </strong>
        </div>
      </div>
      <div className="ownership-composition">
        <svg
          viewBox="0 0 200 200"
          role="img"
          aria-label="株主区分ごとの保有比率"
        >
          <circle
            cx="100"
            cy="100"
            r="70"
            fill="none"
            stroke="#edf1f5"
            strokeWidth="25"
          />
          {groups.map((r, i) => {
            const start = groups
              .slice(0, i)
              .reduce((sum, row) => sum + row.ratio, 0);
            return (
              <circle
                key={r.id}
                cx="100"
                cy="100"
                r="70"
                fill="none"
                stroke={COLORS[i % COLORS.length]}
                strokeWidth="25"
                strokeDasharray={`${(r.ratio / 100) * circumference} ${circumference}`}
                strokeDashoffset={(-start / 100) * circumference}
                transform="rotate(-90 100 100)"
              />
            );
          })}
          <text
            x="100"
            y="95"
            textAnchor="middle"
            className="ownership-chart-label"
          >
            発行済株式
          </text>
          <text
            x="100"
            y="120"
            textAnchor="middle"
            className="ownership-chart-value"
          >
            100%
          </text>
        </svg>
        <div className="ownership-legend">
          {groups.map((r, i) => (
            <div key={r.id}>
              <span>
                <i style={{ background: COLORS[i % COLORS.length] }} />
                {r.label}
              </span>
              <strong>{r.ratio.toFixed(2)}%</strong>
            </div>
          ))}
        </div>
      </div>
      <div className="ownership-table-wrap">
        <table className="ownership-table">
          <caption>
            {snapshot.display === "named"
              ? `${preview ? "基準日時点の" : "公開された"}株主ごとの保有状況`
              : `${preview ? "基準日時点の" : "公開された"}株主区分ごとの保有状況`}
          </caption>
          <thead>
            <tr>
              <th>{snapshot.display === "named" ? "株主名" : "株主区分"}</th>
              <th>保有株数</th>
              <th>保有比率</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <th scope="row">
                  {r.label}
                  {snapshot.display === "named" && <small>{r.detail}</small>}
                </th>
                <td>{r.shares.toLocaleString("ja-JP")}株</td>
                <td>{r.ratio.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th>合計</th>
              <td>{snapshot.issuedShares.toLocaleString("ja-JP")}株</td>
              <td>100.00%</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="ownership-basis">
        <p>
          <strong>根拠資料：</strong>
          {snapshot.sourceLabel}
        </p>
        <p>
          保有比率＝保有株数÷発行済株式数。未行使のストックオプションや未転換のJ-KISS等を含む完全希薄化後の比率、議決権比率とは区別しています。
        </p>
        {snapshot.notes && <p>{snapshot.notes}</p>}
      </div>
    </div>
  );
}
