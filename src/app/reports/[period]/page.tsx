import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { ReportView } from "@/components/report/report-view";
import { requireActor } from "@/lib/server/auth";
import { isCloudMockPreview } from "@/lib/server/environment";
import {
  getPublishedReport,
  listPublishedReports,
} from "@/lib/server/repository";
import { periodLabel } from "@/lib/domain/finance";

export const dynamic = "force-dynamic";
export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ period: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const actor = await requireActor();
  const { period } = await params;
  const { version } = await searchParams;
  const [report, archive] = await Promise.all([
    getPublishedReport(period, actor, version),
    listPublishedReports(actor),
  ]);
  if (!report) notFound();
  const periods = [...new Set(archive.map((r) => r.period))];
  const versions = archive.filter((r) => r.period === period);
  return (
    <Shell role={actor.role} report>
      <div className="report-navigation">
        <span>
          <span className="live-dot" />
          株主限定 · Monthly Report
        </span>
        <details className="period-select">
          <summary>
            {periodLabel(period)}
            <ChevronDown size={14} />
          </summary>
          <div>
            {periods.map((p) => (
              <Link
                key={p}
                href={`/reports/${p}`}
                aria-current={p === period ? "page" : undefined}
              >
                {periodLabel(p)}
              </Link>
            ))}
          </div>
        </details>
        {versions.length > 1 && (
          <div className="version-links">
            {versions.map((v) => (
              <Link
                key={v.id}
                href={`/reports/${period}?version=${v.version}`}
                className={v.version === report.version ? "active" : ""}
              >
                {v.version}
              </Link>
            ))}
          </div>
        )}
      </div>
      <ReportView report={report} browserPrint={isCloudMockPreview()} />
    </Shell>
  );
}
