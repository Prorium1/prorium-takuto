import { redirect } from "next/navigation";
import { requireActor } from "@/lib/server/auth";
import { listPublishedReports } from "@/lib/server/repository";
export const dynamic = "force-dynamic";
export default async function Dashboard() {
  const actor = await requireActor();
  const reports = await listPublishedReports(actor);
  redirect(reports[0] ? `/reports/${reports[0].period}` : "/reports");
}
