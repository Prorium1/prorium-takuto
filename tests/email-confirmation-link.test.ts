import test from "node:test";
import assert from "node:assert/strict";
import { parseEmailConfirmationLink } from "../src/lib/domain/email-confirmation-link";

const project = "https://acpwmxehprpcdyrsbfqe.supabase.co";
const hash = "a".repeat(64);
const link = `${project}/auth/v1/verify?token=${hash}&type=magiclink&redirect_to=https%3A%2F%2Fprorium-shareholder-ir.vercel.app%2Fauth%2Fcallback`;

test("copies a Supabase confirmation token without following the link", () => {
  assert.deepEqual(parseEmailConfirmationLink(link, project), {
    token_hash: hash,
    type: "magiclink",
  });
  const wrapped = `https://example.safelinks.protection.outlook.com/?url=${encodeURIComponent(link)}`;
  assert.deepEqual(parseEmailConfirmationLink(wrapped, project), {
    token_hash: hash,
    type: "magiclink",
  });
  const gmail = `https://www.google.com/url?q=${encodeURIComponent(link)}`;
  assert.deepEqual(parseEmailConfirmationLink(gmail, project), {
    token_hash: hash,
    type: "magiclink",
  });
  assert.equal(
    parseEmailConfirmationLink(link.replace("magiclink", "signup"), project)
      .type,
    "signup",
  );
});

test("rejects spoofed providers, credentials and malformed tokens", () => {
  for (const invalid of [
    `http://acpwmxehprpcdyrsbfqe.supabase.co/auth/v1/verify?token=${hash}&type=magiclink`,
    `https://acpwmxehprpcdyrsbfqe.supabase.co.evil.example/auth/v1/verify?token=${hash}&type=magiclink`,
    `https://user:pass@acpwmxehprpcdyrsbfqe.supabase.co/auth/v1/verify?token=${hash}&type=magiclink`,
    `${project}/auth/v1/verify?token=short&type=magiclink`,
    `${project}/auth/v1/verify?token=${hash}&type=unknown`,
    `${project}/other?token=${hash}&type=magiclink`,
  ])
    assert.throws(() => parseEmailConfirmationLink(invalid, project));
});
