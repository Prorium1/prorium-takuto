import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import * as runtime from "../src/lib/domain/runtime";

test("release verification never inherits production credentials or hosting mode", async () => {
  const verification =
    await import("../src/lib/domain/verification-environment");
  const env = verification.verificationEnvironment({
    PATH: "/usr/bin",
    NODE_ENV: "production",
    VERCEL_ENV: "production",
    PRORIUM_ENV: "production",
    SUPABASE_URL: "https://synthetic-project.example.test",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_SYNTHETIC_ONLY",
    PRORIUM_COMPANY_ID: "11111111-1111-1111-1111-111111111111",
    APP_ORIGIN: "https://synthetic-ir.example.test",
    OPENAI_API_KEY: "synthetic-only",
    AWS_SECRET_ACCESS_KEY: "synthetic-only",
    NEXT_PUBLIC_SUPABASE_URL: "https://synthetic-project.example.test",
    NODE_OPTIONS: "--require=synthetic-injected-loader",
  });
  assert.equal(runtime.mockEnabled(env), true);
  assert.equal(runtime.productionConfigured(env), false);
  for (const name of [
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "PRORIUM_COMPANY_ID",
    "APP_ORIGIN",
    "OPENAI_API_KEY",
    "AWS_SECRET_ACCESS_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NODE_OPTIONS",
    "VERCEL_ENV",
  ])
    assert.equal(env[name], undefined, name);
  assert.equal(env.PATH, "/usr/bin");
  assert.equal(env.NODE_ENV, "test");
  assert.equal(env.INTERNAL_APP_ORIGIN, "http://127.0.0.1:3100");
  const productionSmoke: NodeJS.ProcessEnv = {
    ...env,
    NODE_ENV: "production",
    PRORIUM_ENV: "production",
  };
  assert.equal(runtime.mockEnabled(productionSmoke), false);
  assert.equal(runtime.productionConfigured(productionSmoke), false);
});

test("verification rejects Next dotenv files without loading their contents", async () => {
  const verification =
    await import("../src/lib/domain/verification-environment");
  const directory = await mkdtemp(path.join(tmpdir(), "prorium-env-guard-"));
  try {
    await writeFile(path.join(directory, ".env.example"), "SYNTHETIC=example");
    await verification.assertVerificationWorkspace(directory);
    await writeFile(
      path.join(directory, ".env.production.local"),
      "SYNTHETIC=never-load-this",
    );
    await assert.rejects(
      verification.assertVerificationWorkspace(directory),
      /環境設定ファイル/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
