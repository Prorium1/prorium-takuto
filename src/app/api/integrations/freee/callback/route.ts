import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getActor } from "@/lib/server/auth";
import { encryptFreeeToken } from "@/lib/domain/freee-oauth";
import { freeeConfig, exchangeFreeeCode } from "@/lib/server/freee";
import { isMockEnvironment, productionConfiguration } from "@/lib/server/environment";
import { productionClient } from "@/lib/server/production-repository";

export const runtime = "nodejs";
export async function GET(request: Request) {
  if (isMockEnvironment()) return new Response(null, { status: 404 });
  const actor = await getActor();
  if (actor?.role !== "admin" || actor.needsMfa) return new Response(null, { status: 403 });
  const jar = await cookies();
  const saved = jar.get("prorium_freee_oauth")?.value;
  jar.set("prorium_freee_oauth", "", {
    httpOnly: true, secure: true, sameSite: "lax", path: "/api/integrations/freee", maxAge: 0,
  });
  const url = new URL(request.url);
  const state = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code") || "";
  const expected = `${actor.id}.${state}`;
  if (!saved || !state || !code || code.length > 4096 || saved.length !== expected.length || !timingSafeEqual(Buffer.from(saved), Buffer.from(expected)))
    return new Response("freee認可を確認できませんでした。再度接続してください。", { status: 400 });
  try {
    const config = freeeConfig();
    const result = await exchangeFreeeCode(code);
    const encrypted = encryptFreeeToken({
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      expires_at: result.expiresAt,
    }, config.encryptionKey, actor.companyId);
    const client = await productionClient(actor, true);
    const { error } = await client.rpc("ir_save_freee_connection", {
      p_company: actor.companyId,
      p_freee_company: result.companyId,
      p_ciphertext: encrypted,
      p_expires_at: result.expiresAt,
    });
    if (error) throw error;
    return Response.redirect(new URL("/admin/import?freee=connected", productionConfiguration().origin), 303);
  } catch {
    return new Response("freeeの接続を保存できませんでした。事業所と設定を確認してください。", { status: 400 });
  }
}
