import { periodLabel } from "@/lib/domain/finance";
import { z } from "zod";

const money = z.number().safe().int();
const stagedSchema = z.object({
  id: z.uuid(),
  period: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),
  candidate: z.object({
    completeness: z.literal("month-to-date").optional(),
    throughDate: z.string().optional(),
    revenue: z.object({ current: money, previous: money }),
    operatingProfit: z.object({ current: money, previous: money }),
    ordinaryProfit: z.object({ current: money, previous: money }),
    cash: z.object({ current: money, previous: money }),
  }),
  provenance: z.object({ closeConfirmed: z.literal(false), retrievedAt: z.string() }),
});

export function FreeeStagedReview({ rows }: { rows: unknown[] }) {
  const staged = rows.flatMap((row) => {
    const parsed = stagedSchema.safeParse(row);
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
              <td>{row.candidate.completeness === "month-to-date" ? `${row.candidate.throughDate ?? "月途中"}まで · 参考値` : "月次締め・科目確認待ち"}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <p className="workflow-info">取込候補 → 会計・経営確認 → 下書きSnapshot → レポート確認 → 承認 → 公開</p>
    </section>
  );
}
