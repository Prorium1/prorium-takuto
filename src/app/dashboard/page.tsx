import { isCloudMockPreview } from "@/lib/server/environment";
import { Shell } from "@/components/shell";
import { InvestorDashboard } from "@/components/investor-dashboard";
import { requireActor } from "@/lib/server/auth";
import { listPublishedReports } from "@/lib/server/repository";
import { getReportPreparation } from "@/lib/server/repository";
import { ReportPreparationPanel } from "@/components/report-preparation";
import { listFiscalPublications } from "@/lib/server/fiscal-publications";
export const dynamic = "force-dynamic";
export default async function Dashboard() {
  const actor = await requireActor();
  const [reports, preparation, annual] = await Promise.all([
    listPublishedReports(actor),
    actor.role === "admin" ? getReportPreparation(actor) : Promise.resolve([]),
    listFiscalPublications(actor),
  ]);
  return (
    <Shell role={actor.role}>
      {actor.role === "admin" && (
        <ReportPreparationPanel
          reports={preparation}
          published={reports.length > 0 || annual.length > 0}
        />
      )}
      <InvestorDashboard
        reports={reports}
        fiscalReport={annual[0] || null}
        browserPrint={isCloudMockPreview()}
      />
    </Shell>
  );
}
