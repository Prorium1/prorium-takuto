import Link from "next/link";
import { ArrowRight, Upload } from "lucide-react";
import { Shell } from "@/components/shell";
import { ReportTable } from "@/components/admin/report-table";
import { AuditList } from "@/components/admin/audit-list";
import { requireAdmin } from "@/lib/server/auth";
import { getAdminReports, getAdminStore } from "@/lib/server/repository";
import { periodLabel } from "@/lib/domain/finance";
import styles from "./overview.module.css";

export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const actor = await requireAdmin();
  const [reports, store] = await Promise.all([
    getAdminReports(actor),
    getAdminStore(actor),
  ]);
  const draft = reports.find((report) => report.state === "draft");
  return (
    <Shell role={actor.role}>
      <div className={styles.overview}>
        <nav className="ir-audience-nav" aria-label="経営者と投資家の画面">
          <span aria-current="page">経営者用 · 編集・承認・公開</span>
          <Link href="/dashboard">投資家向け公開レポートを見る →</Link>
        </nav>
        <header className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>PRORIUM / INVESTOR RELATIONS</span>
            <h1>レポート管理</h1>
            <p>月次の振り返りを、株主に伝わるレポートへ。</p>
          </div>
          <div className={styles.heroAction}>
            {draft && (
              <Link
                href={`/admin/reports/${draft.id}/present`}
                className="button secondary"
              >
                説明用プレビューを開く
              </Link>
            )}
            {draft && (
              <span>
                {periodLabel(draft.period)} ·{" "}
                {draft.contextRequired
                  ? "振り返りの入力待ち"
                  : "下書きを編集中"}
              </span>
            )}
            <Link
              href={draft ? `/admin/reports/${draft.id}` : "/admin/reports"}
              className="button primary"
            >
              {draft ? "下書きを編集" : "レポートを管理"}
              <ArrowRight size={16} />
            </Link>
          </div>
        </header>
        <div className={styles.counts} aria-label="レポートの状況">
          {[
            ["公開済み", reports.filter((r) => r.state === "published").length],
            [
              "確認・承認待ち",
              reports.filter((r) => ["review", "approved"].includes(r.state))
                .length,
            ],
            ["下書き", reports.filter((r) => r.state === "draft").length],
          ].map(([label, value]) => (
            <div key={String(label)} className={styles.count}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <section
          className={styles.panel}
          aria-labelledby="monthly-reports-heading"
        >
          <div className={styles.panelHeading}>
            <div>
              <span className={styles.eyebrow}>MONTHLY REPORTS</span>
              <h2 id="monthly-reports-heading">月次レポート</h2>
            </div>
            <Link className={styles.importLink} href="/admin/import">
              <Upload size={16} />
              データ取込
            </Link>
          </div>
          <ReportTable reports={reports} />
        </section>
        <details className={styles.activity}>
          <summary>
            <div>
              <h2>最近の操作</h2>
              <p>ログイン・編集・公開の履歴</p>
            </div>
            <span className={styles.activityToggle}>
              履歴を見る <span aria-hidden="true">＋</span>
            </span>
          </summary>
          <div className={styles.activityBody}>
            <AuditList events={store.audit} />
          </div>
        </details>
      </div>
    </Shell>
  );
}
