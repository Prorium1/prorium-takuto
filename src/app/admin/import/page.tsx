import { ArrowRight, Database } from "lucide-react";
import { Shell } from "@/components/shell";
import { ImportForm } from "@/components/admin/import-form";
import { requireAdmin } from "@/lib/server/auth";
import { getAdminReports, getAdminStore } from "@/lib/server/repository";
import { isMockEnvironment } from "@/lib/server/environment";
import Link from "next/link";

export const dynamic = "force-dynamic";
export default async function ImportPage() {
  const actor = await requireAdmin();
  if (!isMockEnvironment())
    return (
      <Shell role={actor.role}>
        <div className="page-heading">
          <span className="eyebrow">FINANCIAL DATA</span>
          <h1>財務データと資料</h1>
          <p>今月の確認済み資料を、株主に届ける。</p>
        </div>
        <section className="admin-panel">
          <h2>P/L・B/S・残高試算表の共有</h2>
          <p className="admin-info">
            月次レポートの編集画面でPDFを添付してください。必要に応じて財務KPIを入力でき、確認・承認・公開後に株主が閲覧できます。
          </p>
          <Link href="/admin/reports" className="button primary">
            月次レポートを開く
          </Link>
        </section>
        <section className="admin-panel">
          <h2>freee 連携</h2>
          <p className="admin-info">
            自動取込は未接続です。現時点ではfreeeなどから出力したPDFを共有できます。公開済みの資料・数値は、会計ソフトで後から変更しても更新されません。
          </p>
        </section>
      </Shell>
    );
  const [reports, store] = await Promise.all([
    getAdminReports(actor),
    getAdminStore(actor),
  ]);
  return (
    <Shell role={actor.role}>
      <div className="page-heading">
        <span className="eyebrow">FINANCIAL DATA PIPELINE</span>
        <h1>Data Import</h1>
        <p>データを検証し、公開時点の数字を守る。</p>
      </div>
      <div className="import-flow">
        {[
          "Import",
          "Validation",
          "Snapshot",
          "AI Analysis",
          "Review",
          "Publish",
        ].map((v, i) => (
          <div
            key={v}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <span>{v}</span>
            {i < 5 && <ArrowRight size={12} />}
          </div>
        ))}
      </div>
      <section className="admin-panel">
        <div className="panel-heading">
          <h2>Financial Data Source</h2>
          <span className="mock-badge">SYNTHETIC ONLY</span>
        </div>
        <div className="import-source">
          <Database size={24} />
          <div>
            <h3>freee Integration · Mock Adapter</h3>
            <p>勘定科目マッピング、期間検証、Snapshot作成の接続点</p>
          </div>
          <span className="badge badge-neutral">Live connection 未接続</span>
        </div>
        <ImportForm reports={reports.filter((r) => r.state !== "published")} />
      </section>
      <section className="admin-panel">
        <div className="panel-heading">
          <h2>Import History</h2>
          <span>{store.imports.length} imports</span>
        </div>
        {store.imports.length === 0 ? (
          <p className="admin-info">
            Importはまだ実行されていません。初期レポートは合成データのSnapshotで構成しています。
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PERIOD</th>
                  <th>SOURCE</th>
                  <th>VALIDATION</th>
                  <th>CREATED · JST</th>
                </tr>
              </thead>
              <tbody>
                {store.imports.toReversed().map((job) => (
                  <tr key={job.id}>
                    <td>{job.period}</td>
                    <td>Mock freee fixture</td>
                    <td>
                      <span className="badge badge-green">Validated</span>
                    </td>
                    <td>
                      {new Date(job.at).toLocaleString("ja-JP", {
                        timeZone: "Asia/Tokyo",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="admin-info">
          再Importは新しいSnapshotを作ります。公開済みのVersionが参照するSnapshotとレポート本文は変更されません。
        </p>
      </section>
    </Shell>
  );
}
