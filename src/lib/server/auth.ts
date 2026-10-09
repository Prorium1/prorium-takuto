import "server-only";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { signSession, verifySession } from "../domain/session";
import type { Actor } from "../domain/types";
import {
  isMockEnvironment,
  sessionKey,
  productionConfigured,
  productionConfiguration,
} from "./environment";
import { createSupabaseClient } from "./supabase";

export const SESSION_COOKIE = "prorium_mock_session";
export async function getActor(): Promise<Actor | null> {
  if (!isMockEnvironment()) {
    if (!productionConfigured()) return null;
    const client = await createSupabaseClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user) return null;
    const { data, error: membershipError } = await client.rpc(
      "ir_current_actor",
      { p_company: productionConfiguration().companyId },
    );
    if (membershipError || !data || data.id !== user.id) return null;
    return data as Actor;
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifySession(token, sessionKey()) : null;
}
export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return actor;
}
export async function requireAdmin(): Promise<Actor> {
  const actor = await requireActor();
  if (actor.role !== "admin") notFound();
  if (actor.needsMfa) redirect("/account/security");
  return actor;
}
export async function setSession(actor: Actor) {
  (await cookies()).set(SESSION_COOKIE, signSession(actor, sessionKey()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.VERCEL === "1" || (process.env.INTERNAL_APP_ORIGIN?.startsWith("https:") ?? false),
    path: "/",
    maxAge: 3600,
  });
}
