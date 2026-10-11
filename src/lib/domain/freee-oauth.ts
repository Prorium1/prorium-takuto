import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type FreeeToken = {
  refresh_token: string;
  access_token: string;
  expires_at: string;
};

export function buildFreeeAuthorizationUrl(clientId: string, redirectUri: string, state: string) {
  const url = new URL("https://accounts.secure.freee.co.jp/public_api/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_company");
  return url.toString();
}

function encryptionKey(encoded: string) {
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64") !== encoded) throw new Error("Invalid freee encryption key");
  return key;
}

export function encryptFreeeToken(token: FreeeToken, encodedKey: string, companyId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(encodedKey), iv);
  cipher.setAAD(Buffer.from(companyId));
  const payload = Buffer.concat([cipher.update(JSON.stringify(token), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), payload]).toString("base64");
}

export function decryptFreeeToken(encoded: string, encodedKey: string, companyId: string): FreeeToken {
  const blob = Buffer.from(encoded, "base64");
  if (blob.length < 29) throw new Error("Invalid encrypted token");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(encodedKey), blob.subarray(0, 12));
  decipher.setAAD(Buffer.from(companyId));
  decipher.setAuthTag(blob.subarray(12, 28));
  const result = JSON.parse(Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()]).toString("utf8"));
  if (typeof result.refresh_token !== "string" || typeof result.access_token !== "string" || typeof result.expires_at !== "string") throw new Error("Invalid token payload");
  return result as FreeeToken;
}
