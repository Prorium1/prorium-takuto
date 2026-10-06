import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { updateMonthlyReport as update } from "../src/lib/server/monthly";
import {
  createReport,
  getAdminReport,
  getAdminStore,
  mutateReport,
} from "../src/lib/server/repository";
import { saveContent } from "../src/lib/server/updates";
import { structureMonthlyNotes } from "../src/lib/domain/monthly";
import type { Actor, ReportVersion } from "../src/lib/domain/types";
const admin: Actor = { id: "demo-admin", role: "admin", companyId: "prorium" };

async function fixture(run: (report: ReportVersion) => Promise<void>) {
  const directory = await mkdtemp(
    path.join(tmpdir(), "prorium-monthly-update-"),
  );
  const previous = {
    mode: process.env.PRORIUM_ENV,
    path: process.env.MOCK_STORE_PATH,
  };
  process.env.PRORIUM_ENV = "mock";
  process.env.MOCK_STORE_PATH = directory;
  try {
    await run(await createReport("2026-12", admin, true));
  } finally {
    if (previous.mode === undefined) delete process.env.PRORIUM_ENV;
    else process.env.PRORIUM_ENV = previous.mode;
    if (previous.path === undefined) delete process.env.MOCK_STORE_PATH;
    else process.env.MOCK_STORE_PATH = previous.path;
    await rm(directory, { recursive: true, force: true });
  }
}

test("AI outage preserves private monthly notes and invalidates earlier approval without changing the summary", async () => {
  await fixture(async (report) => {
    const content = structuredClone(report.content);
    content.summary = structureMonthlyNotes(
      report.period,
      "以前に確認した講座の進捗を共有します。",
    );
    content.ceo.message = "品質の確認を続けます。";
    let approved = await saveContent(
      report.id,
      admin,
      report.revision,
      content,
      "human-authored",
    );
    approved = await mutateReport(
      report.id,
      admin,
      approved.revision,
      "review",
    );
    approved = await mutateReport(
      report.id,
      admin,
      approved.revision,
      "approve",
    );
    const notes = "非公開の検討メモ。今月の動画制作工程を確認しました。";
    let persistedAtProviderCall: string | undefined;
    const result = await update(
      report.id,
      admin,
      approved.revision,
      notes,
      "generate",
      async () => {
        // Observe real persisted state at the external-provider boundary.
        persistedAtProviderCall = (
          await getAdminStore(admin)
        ).monthlyInputs?.find((n) => n.reportId === report.id)?.notes;
        throw new Error("provider unavailable");
      },
    );
    const saved = (await getAdminReport(report.id, admin))!;
    assert.equal(persistedAtProviderCall, notes);
    assert.equal(result.generationFailed, true);
    assert.equal(saved.state, "draft");
    assert.equal(saved.approvedHash, null);
    assert.deepEqual(saved.content.summary, approved.content.summary);
    assert.equal(saved.analysis, "human-authored");
    assert.equal(saved.revision, approved.revision + 1);
    assert.equal(
      (await getAdminStore(admin)).monthlyInputs?.find(
        (n) => n.reportId === report.id,
      )?.notes,
      notes,
    );
  });
});

test("AI completion cannot overwrite an edit saved while generation was pending", async () => {
  await fixture(async (report) => {
    await assert.rejects(
      update(
        report.id,
        admin,
        report.revision,
        "今月は講座の進捗を確認しました。",
        "generate",
        async () => {
          const saved = (await getAdminReport(report.id, admin))!;
          const edited = structuredClone(saved.content);
          edited.ceo.message = "別の編集者が保存した経営コメントです。";
          await saveContent(
            report.id,
            admin,
            saved.revision,
            edited,
            saved.analysis,
          );
          return {
            summary: structureMonthlyNotes(
              report.period,
              "AI生成が終わりましたが古い入力です。",
            ),
            method: "openai",
          };
        },
      ),
      /別の|変更|更新|concurrent/i,
    );
    const current = (await getAdminReport(report.id, admin))!;
    assert.equal(
      current.content.ceo.message,
      "別の編集者が保存した経営コメントです。",
    );
    assert.equal(current.content.summary.text, "");
  });
});

test("editorial fallback creates a reviewable draft without calling AI even when a provider exists", async () => {
  await fixture(async (report) => {
    const notes = "今月は講座を改善しました。来月は継続率を確認します。";
    const result = await update(
      report.id,
      admin,
      report.revision,
      notes,
      "structure",
      async () => {
        throw new Error("AI must not be contacted");
      },
    );
    assert.equal(result.method, "editorial");
    assert.equal(result.report.state, "draft");
    assert.equal(result.report.analysis, "human-authored");
    assert.equal(result.report.content.summary.text, notes);
    assert.equal(result.report.approvedHash, null);
  });
});

test("stale generation is rejected before any AI request or private-note replacement", async () => {
  await fixture(async (report) => {
    await saveContent(
      report.id,
      admin,
      report.revision,
      report.content,
      report.analysis,
      "別の編集者の確認済みの原文です。",
    );
    await assert.rejects(
      update(
        report.id,
        admin,
        report.revision,
        "古い画面から送った原文です。",
        "generate",
        async () => {
          throw new Error("AI must not be contacted");
        },
      ),
      /別の|変更|更新|concurrent/i,
    );
    assert.equal(
      (await getAdminStore(admin)).monthlyInputs?.find(
        (n) => n.reportId === report.id,
      )?.notes,
      "別の編集者の確認済みの原文です。",
    );
  });
});
