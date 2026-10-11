import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  productionConfigured,
  productionConfiguration,
} from "@/lib/server/environment";
import { createSupabaseClient } from "@/lib/server/supabase";
import {
  validatePlatformCallback,
  SSO_COOKIE,
} from "@/lib/domain/platform-sso";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!productionConfigured())
    return NextResponse.redirect(
      "https://prorium-shareholder-ir.vercel.app/login",
    );
  const config = productionConfiguration();
  const store = await cookies();
  const cookie = store.get(SSO_COOKIE)?.value;
  store.delete(SSO_COOKIE);
  try {
    const payload = validatePlatformCallback(
      cookie,
      new URL(request.url).searchParams,
    );
    const response = await fetch(`${config.url}/functions/v1/ir-platform-sso`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: config.key },
      body: JSON.stringify({ action: "redeem", ...payload }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error("Access denied");
    const result = await response.json();
    if (
      typeof result.token_hash !== "string" ||
      typeof result.user_id !== "string"
    )
      throw new Error("Invalid response");
    const client = await createSupabaseClient();
    const { data, error } = await client.auth.verifyOtp({
      type: "magiclink",
      token_hash: result.token_hash,
    });
    if (error || data.user?.id !== result.user_id)
      throw new Error("Access denied");
    const { data: actor, error: actorError } = await client.rpc(
      "ir_current_actor",
      { p_company: config.companyId },
    );
    if (actorError || actor?.role !== "admin" || actor.id !== result.user_id) {
      await client.auth.signOut();
      throw new Error("Access denied");
    }
    return NextResponse.redirect(`${config.origin}/admin`, {
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return NextResponse.redirect(`${config.origin}/login?reason=platform`, {
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  }
}
