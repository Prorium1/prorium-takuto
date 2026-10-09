import { Shell } from "@/components/shell";
import { ReportTable } from "@/components/admin/report-table";
import { CreateReportForm } from "@/components/admin/workflow";
import { requireAdmin } from "@/lib/server/auth";
import { getAdminReports } from "@/lib/server/repository";
import {
  isMockEnvironment,
  isCloudMockPreview,
} from "@/lib/server/environment";

export const dynamic = "force-dynamic";
export default async function AdminReportsPage() {
  const actor = await requireAdmin();
  const reports = await getAdminReports(actor);
  return (
    <Shell role={actor.role}>
      <div className="page-heading">
        <span className="eyebrow">MONTHLY REPORT WORKSPACE</span>
        <h1>Monthly Reports</h1>
        <p>Draftから公開まで、すべてのVersionを管理。</p>
      </div>
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
