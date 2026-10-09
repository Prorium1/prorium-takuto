import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/shell";
import { ReportView } from "@/components/report/report-view";
import { WorkflowControls } from "@/components/admin/workflow";
import { ReportEditor } from "@/components/admin/report-editor";
import { AuditList } from "@/components/admin/audit-list";
import { AnalysisDraftView } from "@/components/admin/analysis-draft";
import { requireAdmin } from "@/lib/server/auth";
import { getAdminReport, getAdminStore } from "@/lib/server/repository";
import { periodLabel } from "@/lib/domain/finance";

import { MonthlyUpdateForm } from "@/components/admin/monthly-update";
import { FinancialEntryForm } from "@/components/admin/financial-entry";
import { DocumentUploadForm } from "@/components/admin/document-upload";
import {
  isMockEnvironment,
  isCloudMockPreview,
} from "@/lib/server/environment";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export default async function AdminReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const actor = await requireAdmin();
  const { id } = await params;
  const { preview } = await searchParams;
  const [report, store] = await Promise.all([
    getAdminReport(id, actor),
    getAdminStore(actor),
  ]);
  if (!report) notFound();
  if (preview === "1")
    return (
      <Shell role={actor.role} report>
        <Link className="admin-back" href={`/admin/reports/${id}`}>
          <ArrowLeft size={13} />
          編集へ戻る
        </Link>
        <ReportView report={report} preview />
      </Shell>
    );
  if (isCloudMockPreview())
    return (
      <Shell role={actor.role}>
        <Link className="admin-back" href="/admin/reports">
          <ArrowLeft size={13} />
          すべてのレポート
        </Link>
        <div className="page-heading">
          <span className="eyebrow">MONTHLY REFLECTION · DEMO</span>
          <h1>{periodLabel(report.period)}</h1>
          <p>架空の出来事を入力して、株主向け下書きを確認できます。</p>
        </div>
        <MonthlyUpdateForm
          key={report.id}
          report={report}
          notes=""
          aiEnabled={false}
          cloudPreview
        />
        <Link
          className="button secondary"
          href={`/admin/reports/${id}?preview=1`}
        >
          サンプルレポートを見る
        </Link>
      </Shell>
    );
  return (
    <Shell role={actor.role}>
      <Link className="admin-back" href="/admin/reports">
        <ArrowLeft size={13} />
        すべてのレポート
      </Link>
      <div className="page-heading">
        <span className="eyebrow">REPORT EDITOR · {report.version}</span>
        <h1>{periodLabel(report.period)}</h1>
        <p>Monthly Shareholder Report</p>
      </div>
      <WorkflowControls report={report} />
      {report.state !== "published" && (
        <>
          <MonthlyUpdateForm
            key={report.id}
            report={report}
            notes={
              store.monthlyInputs?.find((n) => n.reportId === id)?.notes || ""
            }
            aiEnabled={
              !isMockEnvironment() && Boolean(process.env.OPENAI_API_KEY)
            }
          />
          <DocumentUploadForm report={report} mock={isMockEnvironment()} />
          {!isMockEnvironment() && <FinancialEntryForm report={report} />}
        </>
      )}
      <AnalysisDraftView
        run={store.analyses.findLast((run) => run.reportId === id)}
      />
      {report.analysis === "generated-mock" && (
        <div className="draft-analysis-note">
          Mock
          AIによる生成結果です。財務数値・変化要因・事業情報・リスクの内容を確認してから承認してください。実際のAIモデルは未接続です。
        </div>
      )}
      {report.state !== "published" ? (
        <ReportEditor key={report.id} report={report} />
      ) : (
        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Publication Record</h2>
            <span>Immutable snapshot</span>
          </div>
          <p className="admin-info">
            Version: {report.version}
            <br />
            Approved:{" "}
            {report.approvedAt
              ? new Date(report.approvedAt).toLocaleString("ja-JP", {
                  timeZone: "Asia/Tokyo",
                })
              : "—"}
            <br />
            Published:{" "}
            {report.publishedAt
              ? new Date(report.publishedAt).toLocaleString("ja-JP", {
                  timeZone: "Asia/Tokyo",
                })
              : "—"}
            <br />
            Content checksum: <code>{report.contentHash.slice(0, 24)}…</code>
          </p>
        </section>
      )}
      <section className="admin-panel" style={{ marginTop: 25 }}>
        <div className="panel-heading">
          <h2>Version Audit Log</h2>
          <span>操作履歴</span>
        </div>
        <AuditList events={store.audit.filter((e) => e.reportId === id)} />
      </section>
    </Shell>
  );
}
