import { notFound } from "next/navigation";
import { requireActor } from "@/lib/server/auth";
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
  searchParams: Promise<{ version?: string; preview?: string }>;
}) {
  const actor = await requireActor(),
    { year } = await params,
    { version, preview } = await searchParams;
  if (preview && actor.role !== "admin") notFound();
  const report = await getFiscalPublication(
    actor,
    Number(year),
    version ? Number(version) : undefined,
    preview === "1",
  );
  if (!report) notFound();
  return (
    <main className="presentation-page fiscal-page fiscal-print">
      <Brand />
      <FiscalPublicationView report={report} mock={isMockEnvironment()} print />
    </main>
  );
}
