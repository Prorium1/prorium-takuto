import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
export default async function SecurityPage() {
  await requireAdmin();
  redirect("/admin");
}
