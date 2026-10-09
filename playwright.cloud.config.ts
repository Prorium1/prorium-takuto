import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testMatch: "*.browser.ts",
  use: { ...base.use, baseURL: "http://127.0.0.1:3200" },
  webServer: {
    command: "npx next dev --hostname 127.0.0.1 --port 3200",
    url: "http://127.0.0.1:3200/login",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PRORIUM_ENV: "mock",
      VERCEL_ENV: "preview",
      MOCK_SESSION_SECRET: "synthetic-test-secret-for-preview-only-123456",
      MOCK_STORE_PATH: "/unwritable-preview-path",
      NEXT_DIST_DIR: ".next/cloud-e2e",
      INTERNAL_APP_ORIGIN: "http://127.0.0.1:3200",
    },
  },
});
