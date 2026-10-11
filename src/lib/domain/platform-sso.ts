import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
export const PLATFORM_ORIGIN = "https://dashboard.prorium.co.jp";
export const SSO_COOKIE = "__Host-prorium_ir_platform";
const opaque = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
export function createPlatformAttempt(now = Date.now()) {
  return {
    state: randomBytes(32).toString("base64url"),
    verifier: randomBytes(32).toString("base64url"),
    at: now,
  };
}
export function platformAuthorizationUrl(
  attempt: ReturnType<typeof createPlatformAttempt>,
) {
  const url = new URL("/api/shareholder-ir/authorize", PLATFORM_ORIGIN);
  url.searchParams.set("state", attempt.state);
  url.searchParams.set(
    "challenge",
    createHash("sha256").update(attempt.verifier).digest("base64url"),
  );
  return url.href;
}
export function validatePlatformCallback(
  cookie: string | undefined,
  params: URLSearchParams,
  now = Date.now(),
) {
  if (!cookie || cookie.length > 1024)
    throw new Error("ログイン連携の有効期限が切れました。");
  const attempt = JSON.parse(cookie);
  const state = params.get("state"),
    code = params.get("code");
  if (
    !opaque(attempt.state) ||
    !opaque(attempt.verifier) ||
    !opaque(state) ||
    !opaque(code) ||
    !Number.isFinite(attempt.at) ||
    attempt.at > now ||
    now - attempt.at > 300000 ||
    !timingSafeEqual(Buffer.from(attempt.state), Buffer.from(state))
  )
    throw new Error("ログイン連携を確認できませんでした。");
  return { code, verifier: attempt.verifier };
}
