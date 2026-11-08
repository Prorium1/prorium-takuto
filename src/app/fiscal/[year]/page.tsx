import { notFound } from "next/navigation";
import Link from "next/link";
import { requireActor } from "@/lib/server/auth";
import { getFiscalPublication } from "@/lib/server/fiscal-publications";
import {
  isMockEnvironment,
  isCloudMockPreview,
} from "@/lib/server/environment";
import { fiscalVersionLabel } from "@/lib/domain/fiscal-publication";
import { Brand } from "@/components/brand";
import { PdfButton } from "@/components/report/pdf-button";
import { FiscalPublicationView } from "@/components/report/fiscal-publication-view";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ year: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const actor = await requireActor(),
    { year } = await params,
    { version } = await searchParams;
  const report = await getFiscalPublication(
    actor,
    Number(year),
    version ? Number(version) : undefined,
  );
  if (!report) notFound();
  return (
    <main className="presentation-page fiscal-page">
      <div className="presentation-topbar">
        <Brand />
        <Link href="/dashboard">株主ポータルへ</Link>
        <PdfButton
          period={`${year}-10`}
          version={fiscalVersionLabel(report.version)}
          endpoint={`/api/fiscal/${year}/pdf?version=${report.version}`}
          filename={`Prorium-FY${year}-${fiscalVersionLabel(report.version)}.pdf`}
          browserPrint={isCloudMockPreview()}
        />
      </div>
      <FiscalPublicationView report={report} mock={isMockEnvironment()} />
    </main>
  );
}
