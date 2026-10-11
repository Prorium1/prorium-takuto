export const PLATFORM_AUTH = "https://mledqwzqtkzqjaoewwlf.supabase.co";
export const opaque = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
export async function sha256(value: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(hash)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export async function challengeFor(value: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export function randomCode() {
  return btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
// Never derive authorization from caller-supplied JWT claims or user_metadata.
export async function verifyPlatformAdmin(
  token: string,
  apiKey: string,
  request: typeof fetch = fetch,
) {
  if (!token || token.length > 4096 || !apiKey || apiKey.length > 2048)
    throw new Error("Unauthorized");
  const headers = { Authorization: `Bearer ${token}`, apikey: apiKey };
  const response = await request(`${PLATFORM_AUTH}/auth/v1/user`, {
    headers,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Unauthorized");
  const user = await response.json();
  if (
    typeof user.id !== "string" ||
    !user.email_confirmed_at ||
    user.is_anonymous === true
  )
    throw new Error("Unauthorized");
  const profileResponse = await request(
    `${PLATFORM_AUTH}/rest/v1/rpc/get_my_profile`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "Content-Profile": "prorium_platform",
        "Accept-Profile": "prorium_platform",
      },
      body: "{}",
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!profileResponse.ok) throw new Error("Unauthorized");
  const profile = await profileResponse.json();
  if (
    profile?.id !== user.id ||
    profile?.role !== "admin" ||
    profile?.is_active !== true
  )
    throw new Error("Unauthorized");
  return user.id as string;
}
