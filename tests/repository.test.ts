import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createReport,
  getAdminReport,
  getPublishedReport,
  listPublishedReports,
  mutateReport,
  reviseReport,
} from "../src/lib/server/repository";
import type { Actor } from "../src/lib/domain/types";
import { isMockEnvironment } from "../src/lib/server/environment";

test("repository enforces investor/admin boundaries, concurrency and immutable publication across import/revision", async () => {
  const storeDirectory = await mkdtemp(path.join(tmpdir(), "prorium-unit-"));
  const oldEnv = process.env.PRORIUM_ENV;
  const oldPath = process.env.MOCK_STORE_PATH;
  process.env.PRORIUM_ENV = "mock";
  process.env.MOCK_STORE_PATH = storeDirectory;
  const investor: Actor = {
    id: "demo-investor",
    role: "investor",
    companyId: "prorium",
  };
  const admin: Actor = {
    id: "demo-admin",
    role: "admin",
    companyId: "prorium",
  };
  try {
    assert.equal((await listPublishedReports(investor)).length, 3);
    assert.equal(await getPublishedReport("2026-09", investor), null);
    await assert.rejects(
      getAdminReport("report-2026-09-v1-0", investor),
      /管理者/,
    );
    await assert.rejects(
      listPublishedReports({ ...investor, companyId: "other" }),
      /アクセス権/,
    );
    const august = await getPublishedReport("2026-08", investor);
    const september = (await getAdminReport("report-2026-09-v1-0", admin))!;
    const importedSeptember = await mutateReport(
      september.id,
      admin,
      september.revision,
      "import",
    );
    assert.equal(
      importedSeptember.content.ai.efficiency.find(
        (k) => k.key === "costReduction",
      )!.value,
      importedSeptember.content.profitDrivers.find(
        (d) => d.label === "AIによる効率化",
      )!.amount,
      "Imported AI metrics must match the profit bridge",
    );
    const original = JSON.stringify(august);
    await assert.rejects(
      mutateReport(august!.id, admin, 1, "generate"),
      /公開済み/,
    );
    const report = await createReport("2026-10", admin);
    await assert.rejects(
      mutateReport(report.id, investor, 1, "publish"),
      /管理者/,
    );
    const concurrent = await Promise.allSettled([
      mutateReport(report.id, admin, 1, "generate"),
      mutateReport(report.id, admin, 1, "generate"),
    ]);
    assert.equal(concurrent.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(concurrent.filter((r) => r.status === "rejected").length, 1);
    let latest = (await getAdminReport(report.id, admin))!;
    latest = await mutateReport(report.id, admin, latest.revision, "review");
    latest = await mutateReport(report.id, admin, latest.revision, "approve");
    latest = await mutateReport(report.id, admin, latest.revision, "import");
    assert.equal(latest.state, "draft");
    assert.equal(latest.approvedHash, null);
    assert.equal(await getPublishedReport("2026-10", investor), null);
    latest = await mutateReport(report.id, admin, latest.revision, "review");
    latest = await mutateReport(report.id, admin, latest.revision, "approve");
    latest = await mutateReport(report.id, admin, latest.revision, "publish");
    const publishedContent = JSON.stringify(latest.content);
    const revision = await reviseReport(latest.id, admin);
    assert.equal(revision.version, "v1.1");
    await mutateReport(revision.id, admin, revision.revision, "import");
    assert.equal(
      JSON.stringify(
        (await getPublishedReport("2026-10", investor, "v1.0"))?.content,
      ),
      publishedContent,
    );
    assert.equal(
      JSON.stringify(await getPublishedReport("2026-08", investor)),
      original,
    );
    assert.equal(await getPublishedReport("2026-10", investor, "v1.1"), null);
    let minor = (await getAdminReport(revision.id, admin))!;
    minor = await mutateReport(minor.id, admin, minor.revision, "review");
    minor = await mutateReport(minor.id, admin, minor.revision, "approve");
    minor = await mutateReport(minor.id, admin, minor.revision, "publish");
    const major = await reviseReport(minor.id, admin, "major");
    assert.equal(major.version, "v2.0");
    process.env.PRORIUM_ENV = "production";
    assert.equal(isMockEnvironment(), false);
    await assert.rejects(listPublishedReports(investor), /本番接続が未設定/);
  } finally {
    if (oldEnv === undefined) delete process.env.PRORIUM_ENV;
    else process.env.PRORIUM_ENV = oldEnv;
    if (oldPath === undefined) delete process.env.MOCK_STORE_PATH;
    else process.env.MOCK_STORE_PATH = oldPath;
    await rm(storeDirectory, { recursive: true, force: true });
  }
});
