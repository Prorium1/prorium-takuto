import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/server/supabase";
import { productionConfiguration } from "@/lib/server/environment";
export async function GET(request: Request) {
  const config = productionConfiguration();
  const code = new URL(request.url).searchParams.get("code");
  if (code) {
    const client = await createSupabaseClient();
    const { data: verified, error } =
      await client.auth.exchangeCodeForSession(code);
    if (!error && verified.user && verified.session) {
      const { error: invitationError } = await client.rpc(
        "ir_accept_invitation",
        {
          p_company: config.companyId,
        },
      );
      const { data: actor, error: actorError } = await client.rpc(
        "ir_current_actor",
        {
          p_company: config.companyId,
        },
      );
      if (!invitationError && !actorError && actor?.id === verified.user.id)
        return NextResponse.redirect(
          `${config.origin}${actor.role === "admin" ? (actor.needsMfa ? "/account/security" : "/admin") : "/dashboard"}`,
        );
      await client.auth.signOut();
    }
  }
  // Supabase's default email template returns implicit tokens in the fragment.
  // Browsers retain that fragment across this redirect; /auth/complete clears it.
  if (!code) return NextResponse.redirect(`${config.origin}/auth/complete`);
  return NextResponse.redirect(`${config.origin}/login?reason=access`);
}
