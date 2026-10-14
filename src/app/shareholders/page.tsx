import Link from "next/link";
import { Shell } from "@/components/shell";
import { OwnershipView } from "@/components/ownership-view";
import { requireActor } from "@/lib/server/auth";
import { listPublishedReports } from "@/lib/server/repository";
import { latestOwnershipReport } from "@/lib/domain/ownership";
import { periodLabel } from "@/lib/domain/finance";
export const dynamic = "force-dynamic";
export default async function ShareholdersPage() {
  const actor = await requireActor();
  const report = latestOwnershipReport(await listPublishedReports(actor));
  return (
    <Shell role={actor.role}>
      <Link className="admin-back" href="/dashboard">
        ← 株主ポータル
      </Link>
      {report ? (
        <>
          <OwnershipView
            snapshot={report.content.ownership!}
            headingLevel={1}
          />
          <p className="archive-note">
            {periodLabel(report.period)}の承認・公開済みレポート ·{" "}
            {report.version}
          </p>
          <Link
            className="button secondary"
            href={`/reports/${report.period}?version=${encodeURIComponent(report.version)}#shareholders`}
          >
            掲載レポートとPDFを見る
          </Link>
        </>
      ) : (
        <section className="empty-state">
          <h1>株主構成はまだ公開されていません。</h1>
          <p>
            確認した株主名簿をもとに、基準日・発行済株式数・保有比率を表示します。
          </p>
          <p>
            招待アカウント数や調達予定額から、株主構成を推測することはありません。
          </p>
          {actor.role === "admin" && (
            <Link className="button primary" href="/admin/shareholders">
              株主構成を登録する
            </Link>
          )}
        </section>
      )}
    </Shell>
  );
}
