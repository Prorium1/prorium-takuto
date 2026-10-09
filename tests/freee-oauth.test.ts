import test from "node:test";
import assert from "node:assert/strict";
import { buildFreeeAuthorizationUrl, encryptFreeeToken, decryptFreeeToken } from "../src/lib/domain/freee-oauth";

test("freee OAuth URL binds redirect and unpredictable state", () => {
  const url = new URL(buildFreeeAuthorizationUrl("client-1", "https://ir.example/api/integrations/freee/callback", "state-123"));
  assert.equal(url.origin, "https://accounts.secure.freee.co.jp");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("state"), "state-123");
  assert.equal(url.searchParams.get("prompt"), "select_company");
  assert.equal(url.searchParams.get("redirect_uri"), "https://ir.example/api/integrations/freee/callback");
});

test("freee credentials are authenticated and bound to their company", () => {
  const key = Buffer.alloc(32, 7).toString("base64");
  const cipher = encryptFreeeToken({ refresh_token: "refresh-private", access_token: "access-private", expires_at: "2026-10-09T12:00:00Z" }, key, "company-a");
  assert.ok(!cipher.includes("refresh-private"));
  assert.equal(decryptFreeeToken(cipher, key, "company-a").refresh_token, "refresh-private");
  assert.throws(() => decryptFreeeToken(cipher, key, "company-b"));
  const damaged = (cipher[0] === "A" ? "B" : "A") + cipher.slice(1);
  assert.throws(() => decryptFreeeToken(damaged, key, "company-a"));
});
