import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/server/auth";
import { getAdminReport } from "@/lib/server/repository";
import { getPresentationSource } from "@/lib/server/presentation";
import { getOwnershipImport } from "@/lib/server/ownership-import";
import { PresentationView } from "@/components/report/presentation-view";
import { Brand } from "@/components/brand";
export const dynamic = "force-dynamic";
export default async function PresentationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireAdmin(),
    { id } = await params;
  const report = await getAdminReport(id, actor);
  if (!report) notFound();
  const [source, imported] = await Promise.all([
    getPresentationSource(actor, report),
    getOwnershipImport(actor),
  ]);
  return (
    <main className="presentation-page">
      <div className="presentation-topbar">
        <Brand />
        <Link href={`/admin/reports/${id}`}>編集画面へ戻る</Link>
      </div>
      {source ? (
        <PresentationView
          source={source}
          report={report}
          ownership={imported?.snapshot || null}
        />
      ) : (
        <section className="presentation-pending">
          <h1>説明用の単月データを取得できていません</h1>
          <p>
            freeeの経営分析で対象月を取得してから、この画面を再読み込みしてください。
          </p>
        </section>
      )}
    </main>
  );
}
