import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { getFiscalPublication } from "@/lib/server/fiscal-publications";
import { isMockEnvironment } from "@/lib/server/environment";
import { Brand } from "@/components/brand";
import { FiscalPublicationView } from "@/components/report/fiscal-publication-view";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ year: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const actor = await requireAdmin(),
    { year } = await params,
    { version } = await searchParams;
  const report = await getFiscalPublication(
    actor,
    Number(year),
    version ? Number(version) : undefined,
    true,
  );
  if (!report) notFound();
  return (
    <main className="presentation-page fiscal-page">
      <div className="presentation-topbar">
        <Brand />
        <Link href={`/admin/fiscal/${year}/share`}>編集・承認画面へ戻る</Link>
      </div>
      <FiscalPublicationView report={report} mock={isMockEnvironment()} />
    </main>
  );
}
