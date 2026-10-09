import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getActor } from "@/lib/server/auth";
import { isMockEnvironment } from "@/lib/server/environment";
import { freeeConfig } from "@/lib/server/freee";
import { buildFreeeAuthorizationUrl } from "@/lib/domain/freee-oauth";

export const runtime = "nodejs";
export async function GET() {
  if (isMockEnvironment()) return new Response(null, { status: 404 });
  const actor = await getActor();
  if (actor?.role !== "admin" || actor.needsMfa) return new Response(null, { status: 403 });
  let config;
  try { config = freeeConfig(); } catch { return new Response("freee連携の本番設定が未完了です。", { status: 503 }); }
  const state = randomBytes(32).toString("base64url");
  (await cookies()).set("prorium_freee_oauth", `${actor.id}.${state}`, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/api/integrations/freee", maxAge: 600,
  });
  return Response.redirect(buildFreeeAuthorizationUrl(config.clientId, config.redirectUri, state), 302);
}
