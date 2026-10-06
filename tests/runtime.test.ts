import test from "node:test";
import assert from "node:assert/strict";
import {
  mockEnabled,
  productionConfigured,
  productionConfiguration,
} from "../src/lib/domain/runtime";

const configured = {
  NODE_ENV: "production",
  PRORIUM_ENV: "production",
  VERCEL_ENV: "production",
  SUPABASE_URL: "https://isolated-project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY:
    "sb_publishable_example_for_configuration_validation",
  PRORIUM_COMPANY_ID: "11111111-1111-4111-8111-111111111111",
  APP_ORIGIN: "https://ir.prorium.example",
} as NodeJS.ProcessEnv;

test("production rejects demo flags, preview credentials, development execution and secret keys", () => {
  assert.equal(mockEnabled({ ...configured, PRORIUM_ENV: "mock" }), false);
  assert.equal(productionConfigured(configured), true);
  assert.equal(
    productionConfigured({ ...configured, VERCEL_ENV: "preview" }),
    false,
  );
  assert.equal(
    productionConfigured({ ...configured, NODE_ENV: "development" }),
    false,
  );
  assert.equal(
    productionConfiguration(configured).origin,
    configured.APP_ORIGIN,
  );
  assert.throws(() =>
    productionConfiguration({
      ...configured,
      SUPABASE_PUBLISHABLE_KEY: ["sb", "secret", "x".repeat(32)].join("_"),
    }),
  );
  assert.throws(() =>
    productionConfiguration({
      ...configured,
      APP_ORIGIN: "https://ir.prorium.example/untrusted-path",
    }),
  );
  assert.throws(() =>
    productionConfiguration({
      ...configured,
      SUPABASE_URL: "https://username:password@isolated-project.supabase.co",
    }),
  );
});
