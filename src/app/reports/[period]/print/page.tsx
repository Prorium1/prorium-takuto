import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { ReportView } from "@/components/report/report-view";
import { requireActor } from "@/lib/server/auth";
import { getPublishedReport } from "@/lib/server/repository";
export const dynamic = "force-dynamic";
export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ period: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const actor = await requireActor();
  const { period } = await params;
  const { version } = await searchParams;
  const report = await getPublishedReport(period, actor, version);
  if (!report) notFound();
  return (
    <main className="print-document">
      <div className="print-header">
        <Brand />
        <span className="mock-badge">
          {report.content.financial.isMock
            ? "MOCK DATA · CONFIDENTIAL"
            : "CONFIDENTIAL · SHAREHOLDERS ONLY"}
        </span>
      </div>
      <ReportView report={report} print />
    </main>
  );
}
