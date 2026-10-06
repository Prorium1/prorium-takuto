import { notFound, redirect } from "next/navigation";
import { requireActor } from "@/lib/server/auth";
import { createSupabaseClient } from "@/lib/server/supabase";
import { Shell } from "@/components/shell";
import { MfaForm } from "@/components/mfa-form";
export const dynamic = "force-dynamic";
export default async function SecurityPage() {
  const actor = await requireActor();
  if (actor.role !== "admin") notFound();
  if (!actor.needsMfa) redirect("/admin");
  const client = await createSupabaseClient();
  const { data } = await client.auth.mfa.listFactors();
  return (
    <Shell role={actor.role}>
      <div className="page-heading">
        <span className="eyebrow">ACCOUNT SECURITY</span>
        <h1>アカウントの保護</h1>
      </div>
      <MfaForm
        existingFactor={data?.totp.find((f) => f.status === "verified")?.id}
      />
    </Shell>
  );
}
