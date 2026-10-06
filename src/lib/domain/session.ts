import { createHmac, timingSafeEqual } from "node:crypto";
import type { Actor } from "./types";

export function signSession(
  actor: Actor,
  key: string,
  now = Math.floor(Date.now() / 1000),
) {
  const body = Buffer.from(JSON.stringify({ actor, exp: now + 3600 })).toString(
    "base64url",
  );
  return `${body}.${createHmac("sha256", key).update(body).digest("base64url")}`;
}
export function verifySession(
  token: string,
  key: string,
  now = Math.floor(Date.now() / 1000),
): Actor | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [body, signature] = parts;
    const expected = createHmac("sha256", key).update(body).digest();
    const received = Buffer.from(signature, "base64url");
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    )
      return null;
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (
      !Number.isSafeInteger(data.exp) ||
      data.exp <= now ||
      data.actor?.companyId !== "prorium"
    )
      return null;
    if (data.actor.id === "demo-investor" && data.actor.role === "investor")
      return data.actor;
    if (data.actor.id === "demo-admin" && data.actor.role === "admin")
      return data.actor;
    return null;
  } catch {
    return null;
  }
}
