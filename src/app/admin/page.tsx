import Link from "next/link";
import { ArrowRight, Upload } from "lucide-react";
import { Shell } from "@/components/shell";
import { ReportTable } from "@/components/admin/report-table";
import { AuditList } from "@/components/admin/audit-list";
import { requireAdmin } from "@/lib/server/auth";
import { getAdminReports, getAdminStore } from "@/lib/server/repository";

export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const actor = await requireAdmin();
  const [reports, store] = await Promise.all([
    getAdminReports(actor),
    getAdminStore(actor),
  ]);
  return (
    <Shell role={actor.role}>
      <div className="admin-head">
        <div className="page-heading">
          <span className="eyebrow">MANAGEMENT WORKSPACE</span>
          <h1>Report Management</h1>
          <p>正確なデータを、伝わるレポートへ。</p>
        </div>
        <Link href="/admin/reports" className="button primary">
          レポートを管理
          <ArrowRight size={15} />
        </Link>
      </div>
      <div className="admin-counts">
        {[
          ["公開済み", reports.filter((r) => r.state === "published").length],
          [
            "レビュー・承認待ち",
            reports.filter((r) => ["review", "approved"].includes(r.state))
              .length,
          ],
          ["Draft", reports.filter((r) => r.state === "draft").length],
        ].map(([label, value]) => (
          <div key={String(label)} className="admin-count">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <section className="admin-panel">
        <div className="panel-heading">
          <h2>Monthly Reports</h2>
          <Link className="text-button" href="/admin/import">
            <Upload size={13} />
            Import
          </Link>
        </div>
        <ReportTable reports={reports} />
      </section>
      <section className="admin-panel">
        <div className="panel-heading">
          <h2>Audit Log</h2>
          <span>管理操作・公開・PDF出力の記録</span>
        </div>
        <AuditList events={store.audit} />
      </section>
    </Shell>
  );
}
