export type EmailTokenType = "email" | "magiclink" | "signup" | "recovery";

export function parseEmailConfirmationLink(
  raw: string,
  projectUrl: string,
): {
  token_hash: string;
  type: EmailTokenType;
} {
  if (raw.length > 5000) throw new Error("Invalid confirmation link");
  const project = new URL(projectUrl);
  let url = new URL(raw.trim());
  // Email clients may wrap links for click tracking. Parse the nested URL only;
  // never request the wrapper or trust it as an authentication endpoint.
  for (let i = 0; i < 2 && url.origin !== project.origin; i++) {
    const nested =
      url.searchParams.get("url") ??
      (url.hostname === "www.google.com" || url.hostname === "google.com"
        ? url.searchParams.get("q")
        : null);
    if (!nested) break;
    url = new URL(nested);
  }
  if (
    url.protocol !== "https:" ||
    url.origin !== project.origin ||
    url.pathname !== "/auth/v1/verify" ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error("Invalid confirmation link");
  const token =
    url.searchParams.get("token") ?? url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (!token || !/^[A-Za-z0-9_-]{16,256}$/.test(token))
    throw new Error("Invalid confirmation token");
  if (
    type !== "email" &&
    type !== "magiclink" &&
    type !== "signup" &&
    type !== "recovery"
  )
    throw new Error("Invalid confirmation type");
  return { token_hash: token, type };
}
