import Link from "next/link";
import { ArrowRight, Upload } from "lucide-react";
import { Shell } from "@/components/shell";
import { ReportTable } from "@/components/admin/report-table";
import { AuditList } from "@/components/admin/audit-list";
import { requireAdmin } from "@/lib/server/auth";
import { getAdminReports, getAdminStore } from "@/lib/server/repository";
import { periodLabel } from "@/lib/domain/finance";
import styles from "./overview.module.css";
import { listFiscalPublications } from "@/lib/server/fiscal-publications";

export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const actor = await requireAdmin();
  const [reports, store, annual] = await Promise.all([
    getAdminReports(actor),
    getAdminStore(actor),
    listFiscalPublications(actor, false),
  ]);
  const draft = reports.find((report) => report.state === "draft");
  const reportStates = [...reports, ...annual];
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
  }).format(new Date());
  const fiscalYear =
    Number(today.slice(0, 4)) + (Number(today.slice(5, 7)) >= 11 ? 1 : 0);
  const latestPeriod = reports
    .map((r) => r.period)
    .sort()
    .at(-1);
  const preparedYear =
    annual[0]?.year ??
    (latestPeriod
      ? Number(latestPeriod.slice(0, 4)) +
        (Number(latestPeriod.slice(5, 7)) >= 11 ? 1 : 0)
      : fiscalYear);
  const current = annual[0];
  return (
    <Shell role={actor.role}>
      <div className={styles.overview}>
        <header className={styles.hero}>
          <span className={styles.eyebrow}>経営者だけが使う画面</span>
          <h1>経営者のホーム</h1>
          <p>株主へのご報告は、ここから進めます。</p>
        </header>
        <section
          className={styles.nextAction}
          aria-labelledby="next-action-title"
        >
          <div>
            <span className={styles.eyebrow}>
              {current?.state === "published"
                ? "共有する資料"
                : "最初にすること"}
            </span>
            <h2 id="next-action-title">{preparedYear}年10月期の報告</h2>
            <p>
              {current?.state === "published"
                ? "公開済みの報告です。共有リンクと提出用の資料を開けます。"
                : "報告の内容を確認し、承認してから株主に公開します。"}
            </p>
          </div>
          <Link
            href={`/admin/fiscal/${preparedYear}/share`}
            className="button primary"
          >
            {current?.state === "published"
              ? "共有リンクと資料を開く"
              : "報告を確認する"}
            <ArrowRight size={20} />
          </Link>
        </section>
        <nav className={styles.destinations} aria-label="見る画面を選ぶ">
          <Link href={`/admin/fiscal/${preparedYear}`}>
            <span>経営者向け · 非公開</span>
            <h2>会社の数字を詳しく見る</h2>
            <p>売上や利益の推移を確認します。</p>
            <strong>経営分析を開く →</strong>
          </Link>
          <Link href="/dashboard">
            <span>株主向け · 公開済みの情報</span>
            <h2>株主の画面を見る</h2>
            <p>株主に公開している報告を確認します。</p>
            <strong>株主のホームを開く →</strong>
          </Link>
        </nav>
        <div className={styles.counts} aria-label="レポートの状況">
          {[
            ["作成中", reportStates.filter((r) => r.state === "draft").length],
            [
              "確認・承認待ち",
              reportStates.filter((r) =>
                ["review", "approved"].includes(r.state),
              ).length,
            ],
            [
              "公開済み",
              reportStates.filter((r) => r.state === "published").length,
            ],
          ].map(([label, value]) => (
            <div key={String(label)} className={styles.count}>
              <span>{label}</span>
              <strong>
                {value}
                <small>件</small>
              </strong>
            </div>
          ))}
        </div>
        <section
          className={styles.panel}
          aria-labelledby="monthly-reports-heading"
        >
          <div className={styles.panelHeading}>
            <div>
              <h2 id="monthly-reports-heading">月ごとの報告</h2>
              <p>月ごとの振り返りや、出来事を記録します。</p>
            </div>
            <Link
              className="button secondary"
              href={draft ? `/admin/reports/${draft.id}` : "/admin/reports"}
            >
              {draft
                ? `${periodLabel(draft.period)}の続きを書く`
                : "月次レポートを作る"}
            </Link>
          </div>
          <ReportTable reports={reports} />
        </section>
        <nav className={styles.tools} aria-label="登録と設定">
          <Link href="/admin/investors">閲覧する株主を登録する →</Link>
          <Link href="/admin/login">Googleログインを設定・確認する →</Link>
          <Link href="/admin/shareholders">株主構成を登録・修正する →</Link>
          <Link href="/admin/import">
            <Upload size={18} />
            会計データを取り込む →
          </Link>
        </nav>
        <details className={styles.activity}>
          <summary>
            <h2>操作の履歴を見る</h2>
            <span aria-hidden="true">＋</span>
          </summary>
          <div className={styles.activityBody}>
            <AuditList events={store.audit} />
          </div>
        </details>
      </div>
    </Shell>
  );
}
