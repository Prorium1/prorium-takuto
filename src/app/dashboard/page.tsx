import { isCloudMockPreview } from "@/lib/server/environment";
import { Shell } from "@/components/shell";
import { InvestorDashboard } from "@/components/investor-dashboard";
import { requireActor } from "@/lib/server/auth";
import { listPublishedReports } from "@/lib/server/repository";
export const dynamic = "force-dynamic";
export default async function Dashboard() {
  const actor = await requireActor();
  const reports = await listPublishedReports(actor);
  return (
    <Shell role={actor.role}>
      <InvestorDashboard
        reports={reports}
        browserPrint={isCloudMockPreview()}
      />
    </Shell>
  );
}
