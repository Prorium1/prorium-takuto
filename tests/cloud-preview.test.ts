import test from "node:test";
import assert from "node:assert/strict";
import { isCloudMockPreview, sessionKey } from "../src/lib/server/environment";
import {
  getAdminReport,
  getAdminReports,
  createReport,
  mutateReport,
} from "../src/lib/server/mock-repository";
import type { Actor } from "../src/lib/domain/types";

test("cloud mock preview uses stable authentication, reads only synthetic fixtures and rejects writes", async () => {
  const keys = [
    "PRORIUM_ENV",
    "VERCEL_ENV",
    "MOCK_SESSION_SECRET",
    "MOCK_STORE_PATH",
  ];
  const old = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const admin: Actor = {
    id: "demo-admin",
    role: "admin",
    companyId: "prorium",
  };
  try {
    Object.assign(process.env, {
      PRORIUM_ENV: "mock",
      VERCEL_ENV: "preview",
      MOCK_STORE_PATH: "/unwritable-preview-path",
      MOCK_SESSION_SECRET: "synthetic-test-secret-for-preview-only-123456",
    });
    assert.equal(isCloudMockPreview(), true);
    assert.equal(sessionKey(), process.env.MOCK_SESSION_SECRET);
    assert.ok(
      (await getAdminReports(admin)).every((r) => r.content.financial.isMock),
    );
    const report = (await getAdminReport("report-2026-09-v1-0", admin))!;
    await assert.rejects(createReport("2026-12", admin), /保存・公開/);
    await assert.rejects(
      mutateReport(report.id, admin, report.revision, "review"),
      /保存・公開/,
    );
    await assert.rejects(
      getAdminReports({ ...admin, id: "demo-investor", role: "investor" }),
      /権/,
    );
    delete process.env.MOCK_SESSION_SECRET;
    assert.throws(() => sessionKey(), /Preview/);
    process.env.VERCEL_ENV = "production";
    assert.equal(isCloudMockPreview(), false);
    await assert.rejects(getAdminReports(admin), /Mock/);
  } finally {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
