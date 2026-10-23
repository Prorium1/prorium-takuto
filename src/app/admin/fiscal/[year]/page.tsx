import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/server/auth";
import { getFiscalSource } from "@/lib/server/fiscal";
import { getOwnershipImport } from "@/lib/server/ownership-import";
import { FiscalBriefing } from "@/components/report/fiscal-briefing";
import { Brand } from "@/components/brand";
import { isMockEnvironment } from "@/lib/server/environment";
import { getAdminReports } from "@/lib/server/repository";
export const dynamic = "force-dynamic";
export default async function FiscalPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const actor = await requireAdmin(),
    { year } = await params;
  if (!/^20\d{2}$/.test(year)) notFound();
  const [source, ownership, reports] = await Promise.all([
    getFiscalSource(actor, Number(year)),
    getOwnershipImport(actor),
    getAdminReports(actor),
  ]);
  const event = reports
    .filter(
      (r) => r.period >= `${Number(year) - 1}-11` && r.period <= `${year}-10`,
    )
    .map((r) => r.content.eventSpotlight)
    .find((e) => e?.videoUrl);
  return (
    <main className="presentation-page fiscal-page">
      <div className="presentation-topbar">
        <Brand />
        <Link href="/admin">管理画面へ戻る</Link>
      </div>
      {source ? (
        <FiscalBriefing
          source={source}
          ownership={ownership?.snapshot || null}
          mock={isMockEnvironment()}
          referenceVideo={
            event
              ? { occurredOn: event.occurredOn, videoUrl: event.videoUrl }
              : undefined
          }
        />
      ) : (
        <section className="presentation-pending">
          <h1>今期全体の確認用データを準備しています</h1>
          <p>
            期首からの単月データと前年の比較値がそろうと、ここに表示されます。
          </p>
        </section>
      )}
    </main>
  );
}
