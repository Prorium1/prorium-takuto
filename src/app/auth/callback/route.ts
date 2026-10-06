import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/server/supabase";
import { productionConfiguration } from "@/lib/server/environment";
import { getActor } from "@/lib/server/auth";
export async function GET(request: Request) {
  const config = productionConfiguration();
  const code = new URL(request.url).searchParams.get("code");
  if (code) {
    const client = await createSupabaseClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
      await client.rpc("ir_accept_invitation", { p_company: config.companyId });
      const actor = await getActor();
      if (actor)
        return NextResponse.redirect(
          `${config.origin}${actor.role === "admin" ? (actor.needsMfa ? "/account/security" : "/admin") : "/dashboard"}`,
        );
      await client.auth.signOut();
    }
  }
  return NextResponse.redirect(`${config.origin}/login?reason=access`);
}
