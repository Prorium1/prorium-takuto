import Link from "next/link";
import { Shell } from "@/components/shell";
import { OwnershipView } from "@/components/ownership-view";
import { requireActor } from "@/lib/server/auth";
import { listPublishedReports } from "@/lib/server/repository";
import { latestPublishedOwnership } from "@/lib/domain/ownership";
import { listFiscalPublications } from "@/lib/server/fiscal-publications";
export const dynamic = "force-dynamic";
export default async function ShareholdersPage() {
  const actor = await requireActor();
  const [reports, annual] = await Promise.all([
    listPublishedReports(actor),
    listFiscalPublications(actor),
  ]);
  const ownership = latestPublishedOwnership(reports, annual);
  return (
    <Shell role={actor.role}>
      <Link className="admin-back" href="/dashboard">
        ← 株主ポータル
      </Link>
      {ownership ? (
        <>
          <OwnershipView snapshot={ownership.snapshot} headingLevel={1} />
          <p className="archive-note">{ownership.label} · 承認・公開済み</p>
          <Link className="button secondary" href={ownership.href}>
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
