import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
const port = Number(process.env.CLOUD_PREVIEW_TEST_PORT || 3200);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid cloud preview test port");

export default defineConfig({
  ...base,
  testMatch: "*.browser.ts",
  use: { ...base.use, baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    command: `npx next dev --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PRORIUM_ENV: "mock",
      VERCEL_ENV: "preview",
      MOCK_SESSION_SECRET: "synthetic-test-secret-for-preview-only-123456",
      MOCK_STORE_PATH: "/unwritable-preview-path",
      NEXT_DIST_DIR: ".next/cloud-e2e",
      INTERNAL_APP_ORIGIN: `http://127.0.0.1:${port}`,
    },
  },
});
