import Link from "next/link";
import { Shell } from "@/components/shell";
import { OwnershipForm } from "@/components/admin/ownership-form";
import { requireAdmin } from "@/lib/server/auth";
import { getAdminReports } from "@/lib/server/repository";
import {
  isMockEnvironment,
  isCloudMockPreview,
} from "@/lib/server/environment";
import { validOwnership } from "@/lib/domain/ownership";
import { periodLabel } from "@/lib/domain/finance";
import { getOwnershipImport } from "@/lib/server/ownership-import";
export const dynamic = "force-dynamic";
export default async function AdminShareholdersPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string }>;
}) {
  const actor = await requireAdmin();
  const { report: id } = await searchParams;
  const [allReports, imported] = await Promise.all([
    getAdminReports(actor),
    getOwnershipImport(actor)
      .then((data) => ({ data, error: false }))
      .catch(() => ({ data: null, error: true })),
  ]);
  const reports = allReports.filter((r) => r.state === "draft");
  const report = id ? reports.find((r) => r.id === id) : reports[0];
  const savedOwnership = validOwnership(report?.content.ownership);
  return (
    <Shell role={actor.role}>
      <Link className="admin-back" href="/dashboard">
        ← 株主ポータル
      </Link>
      <div className="page-heading">
        <span className="eyebrow">MANAGEMENT / SHAREHOLDERS</span>
        <h1>株主構成を登録</h1>
        <p>確認した名簿から、株主へ見せる内容を整理します。</p>
      </div>
      {imported.error && (
        <p className="form-error" role="alert">
          取得済みの名簿を読み込めませんでした。入力済みの内容を確認するか、手入力で進められます。
        </p>
      )}
      {report ? (
        <>
          <form className="document-filters">
            <label>
              保存する下書き
              <select name="report" defaultValue={report.id}>
                {reports.map((r) => (
                  <option value={r.id} key={r.id}>
                    {periodLabel(r.period)} · {r.version}
                  </option>
                ))}
              </select>
            </label>
            <button className="button secondary">この下書きを選ぶ</button>
          </form>
          <p className="ownership-form-note">
            {periodLabel(report.period)}
            の下書きに保存します。株主構成の基準日は財務の対象月と分けて表示します。
          </p>
          <OwnershipForm
            key={report.id}
            id={report.id}
            revision={report.revision}
            initial={savedOwnership || imported.data?.snapshot || null}
            imported={imported.data}
            initialUnsaved={!savedOwnership && Boolean(imported.data)}
            mock={isMockEnvironment()}
            cloudPreview={isCloudMockPreview()}
          />
        </>
      ) : (
        <section className="empty-state">
          <h2>編集できる下書きがありません。</h2>
          <p>
            月次レポートを作成するか、公開済みレポートの改訂版を作成してください。
          </p>
          <Link className="button primary" href="/admin/reports">
            レポートを管理
          </Link>
        </section>
      )}
    </Shell>
  );
}
