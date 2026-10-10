import { Shell } from "@/components/shell";
import { ReportTable } from "@/components/admin/report-table";
import { CreateReportForm } from "@/components/admin/workflow";
import { requireAdmin } from "@/lib/server/auth";
import { getAdminReports } from "@/lib/server/repository";
import { productionClient, databaseError } from "@/lib/server/production-repository";
import { stagedRowSchema } from "@/lib/domain/freee-staging";
import { periodLabel } from "@/lib/domain/finance";
import Link from "next/link";
import {
  isMockEnvironment,
  isCloudMockPreview,
} from "@/lib/server/environment";

export const dynamic = "force-dynamic";
export default async function AdminReportsPage() {
  const actor = await requireAdmin();
  const reports = await getAdminReports(actor);
  const candidates = !isMockEnvironment() ? await (async () => {
    const client = await productionClient(actor, true);
    const { data, error } = await client.rpc("ir_list_freee_staged", { p_company: actor.companyId });
    databaseError(error);
    const byPeriod = new Map<string, ReturnType<typeof stagedRowSchema.parse>>();
    for (const raw of data ?? []) {
      const parsed = stagedRowSchema.safeParse(raw);
      if (parsed.success && !byPeriod.has(parsed.data.period)) byPeriod.set(parsed.data.period, parsed.data);
    }
    return [...byPeriod.values()].sort((a, b) => b.period.localeCompare(a.period));
  })() : [];
  return (
    <Shell role={actor.role}>
      <div className="page-heading">
        <span className="eyebrow">MONTHLY REPORT WORKSPACE</span>
        <h1>Monthly Reports</h1>
        <p>Draftから公開まで、すべてのVersionを管理。</p>
      </div>
      {candidates.length > 0 && (
        <section className="admin-panel fiscal-review-index">
          <div className="panel-heading"><h2>今期の月次レビュー</h2><span>{candidates.length}か月 · freee取得候補</span></div>
          <p className="admin-info">実数値の候補を月ごとに整理しました。会計締め、勘定科目、増減理由を確認した月から、株主向けの非公開下書きへ進められます。</p>
          <div className="fiscal-review-months">
            {candidates.map((row) => {
              const report = reports.find((item) => item.period === row.period);
              const complete = row.candidate.completeness !== "month-to-date";
              return <Link key={row.period} href={`/admin/import/${row.period}`} className="fiscal-review-month"><span>{periodLabel(row.period)}</span><b>{report?.content.financial.source === "freee" ? "下書き作成済み" : complete ? "確認待ち" : "月途中"}</b><small>数字と前年同月を確認 →</small></Link>;
            })}
          </div>
        </section>
      )}
      {!isCloudMockPreview() && (
        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Create Report</h2>
            <span>
              {isMockEnvironment() ? "Mock Data only" : "月ごとに下書きを作成"}
            </span>
          </div>
          <CreateReportForm />
          <p className="admin-info">
            新規レポートはDraftで作成します。既存の月を修正するときは、公開済みレポートから改訂版を作成してください。
          </p>
        </section>
      )}
      <section className="admin-panel">
        <ReportTable reports={reports} />
      </section>
    </Shell>
  );
}
