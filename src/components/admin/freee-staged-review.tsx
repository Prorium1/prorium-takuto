import { periodLabel } from "@/lib/domain/finance";
import { stagedRowSchema } from "@/lib/domain/freee-staging";
import { FreeePromoteForm } from "./freee-promote-form";

export function FreeeStagedReview({ rows, reportPeriods = [] }: { rows: unknown[]; reportPeriods?: string[] }) {
  const staged = rows.flatMap((row) => {
    const parsed = stagedRowSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
  if (!staged.length) return null;
  const yen = (value: number) => `${value.toLocaleString("ja-JP")}円`;
  return (
    <section className="admin-panel">
      <div className="panel-heading">
        <h2>freeeから取得した財務データ</h2>
        <span className="badge badge-neutral">管理者のみ · 確認待ち</span>
      </div>
      <p className="admin-info">
        freeeの月次P/L・B/Sと前年同月を照合した候補値です。会計上の月次締め、現預金の対象科目、増減理由は未確認です。ここに表示された値は株主レポートにも公開済みSnapshotにも反映されていません。
      </p>
      <div className="table-wrap">
        <table className="data-table" aria-label="freee取込候補一覧">
          <thead><tr><th>対象月</th><th>売上</th><th>営業利益</th><th>経常利益</th><th>現預金</th><th>状態</th></tr></thead>
          <tbody>
            {staged.map((row) => <tr key={row.id}>
              <td>{periodLabel(row.period)}</td>
              <td>{yen(row.candidate.revenue.current)}<br /><small>前年 {yen(row.candidate.revenue.previous)}</small></td>
              <td>{yen(row.candidate.operatingProfit.current)}<br /><small>前年 {yen(row.candidate.operatingProfit.previous)}</small></td>
              <td>{yen(row.candidate.ordinaryProfit.current)}<br /><small>前年 {yen(row.candidate.ordinaryProfit.previous)}</small></td>
              <td>{yen(row.candidate.cash.current)}<br /><small>前年 {yen(row.candidate.cash.previous)}</small></td>
              <td>{row.candidate.completeness === "month-to-date" ? `${row.candidate.throughDate ?? "月途中"}まで · 参考値` : reportPeriods.includes(row.period) ? "非公開下書きへ反映済み" : "月次締め・科目確認待ち"}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {staged.filter((row) => row.candidate.completeness !== "month-to-date" && !reportPeriods.includes(row.period)).map((row) => <FreeePromoteForm key={row.id} id={row.id} period={row.period} cashAccountIds={row.provenance.cashAccountIds.current} />)}
      <p className="workflow-info">取込候補 → 会計・経営確認 → 下書きSnapshot → レポート確認 → 承認 → 公開</p>
    </section>
  );
}
