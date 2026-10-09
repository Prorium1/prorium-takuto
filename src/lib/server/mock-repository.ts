import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  Actor,
  MockStore,
  ReportVersion,
  WorkflowOperation,
  ReportContent,
  StoredDocument,
} from "../domain/types";
import { initialStore, mockReportForPeriod } from "../mock/seed";
import { applyOperation, contentHash } from "../domain/workflow";
import { contentEditSchema, periodSchema } from "../domain/validation";
import {
  MockAnalysisProvider,
  SyntheticFreeeProvider,
} from "../domain/providers";
import { emptyReport } from "../domain/monthly";
import { requireMockEnvironment, isCloudMockPreview } from "./environment";

const globalStore = globalThis as typeof globalThis & {
  __proriumStoreQueue?: Promise<unknown>;
};
const storePath = () =>
  path.join(
    process.env.MOCK_STORE_PATH || path.join(process.cwd(), ".data"),
    "mock-store.json",
  );

function assertActor(actor: Actor) {
  requireMockEnvironment();
  if (
    actor.companyId !== "prorium" ||
    !(
      (actor.id === "demo-investor" && actor.role === "investor") ||
      (actor.id === "demo-admin" && actor.role === "admin")
    )
  )
    throw new Error("アクセス権がありません。");
}
function assertAdmin(actor: Actor) {
  assertActor(actor);
  if (actor.role !== "admin") throw new Error("管理者権限が必要です。");
}

async function withStore<T>(
  operation: (store: MockStore) => T | Promise<T>,
  write = false,
): Promise<T> {
  requireMockEnvironment();
  if (isCloudMockPreview()) {
    if (write)
      throw new Error(
        "クラウドPreviewでは保存・公開を行えません。架空データの閲覧と振り返りの下書き確認をご利用ください。",
      );
    return structuredClone(await operation(initialStore()));
  }
  const task = (globalStore.__proriumStoreQueue || Promise.resolve()).then(
    async () => {
      const file = storePath();
      await mkdir(path.dirname(file), { recursive: true });
      let store: MockStore;
      let initialized = false;
      try {
        store = JSON.parse(await readFile(file, "utf8"));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        store = initialStore();
        initialized = true;
      }
      store.analyses ??= [];
      if (
        !store.reports.every(
          (r) =>
            r.content.financial.isMock === true &&
            r.content.financial.source === "synthetic-freee-fixture",
        )
      )
        throw new Error("開発環境ではMockデータのみ利用できます。");
      const result = await operation(store);
      if (write || initialized) {
        const tmp = `${file}.${randomUUID()}.tmp`;
        await writeFile(tmp, JSON.stringify(store, null, 2), { mode: 0o600 });
        await rename(tmp, file);
      }
      return structuredClone(result);
    },
  );
  globalStore.__proriumStoreQueue = task.catch(() => undefined);
  return task;
}
function audit(
  store: MockStore,
  actor: Actor,
  action: string,
  reportId: string | null,
  detail: string,
) {
  store.audit.push({
    id: randomUUID(),
    at: new Date().toISOString(),
    actorId: actor.id,
    action,
    reportId,
    detail,
  });
}
export async function listPublishedReports(
  actor: Actor,
): Promise<ReportVersion[]> {
  assertActor(actor);
  return withStore((store) =>
    store.reports
      .filter((r) => r.companyId === actor.companyId && r.state === "published")
      .sort(
        (a, b) =>
          b.period.localeCompare(a.period) ||
          b.createdAt.localeCompare(a.createdAt),
      ),
  );
}
export async function getPublishedReport(
  period: string,
  actor: Actor,
  version?: string,
): Promise<ReportVersion | null> {
  assertActor(actor);
  if (!periodSchema.safeParse(period).success) return null;
  const reports = await listPublishedReports(actor);
  return (
    reports.find(
      (r) => r.period === period && (!version || r.version === version),
    ) || null
  );
}
export async function getAdminReports(actor: Actor) {
  assertAdmin(actor);
  return withStore((store) =>
    store.reports.toSorted(
      (a, b) =>
        b.period.localeCompare(a.period) ||
        b.createdAt.localeCompare(a.createdAt),
    ),
  );
}
export async function getAdminReport(id: string, actor: Actor) {
  assertAdmin(actor);
  return withStore(
    (store) =>
      store.reports.find(
        (r) => r.id === id && r.companyId === actor.companyId,
      ) || null,
  );
}
export async function getAdminStore(actor: Actor) {
  assertAdmin(actor);
  return withStore((store) => ({
    imports: store.imports,
    audit: store.audit.toReversed(),
    snapshots: store.snapshots,
    analyses: store.analyses,
    monthlyInputs: store.monthlyInputs || [],
  }));
}

export async function createReport(
  period: string,
  actor: Actor,
  summaryOnly = false,
) {
  assertAdmin(actor);
  periodSchema.parse(period);
  return withStore((store) => {
    if (store.reports.some((r) => r.period === period))
      throw new Error(
        "この期間のレポートは存在します。改訂版を作成してください。",
      );
    const report = summaryOnly
      ? emptyReport(period, actor.companyId)
      : mockReportForPeriod(period);
    if (summaryOnly) {
      report.content.financial.isMock = true;
      report.content.financial.source = "synthetic-freee-fixture";
      report.contentHash = contentHash(report.content);
    }
    report.id = randomUUID();
    report.state = "draft";
    report.analysis = "not-generated";
    report.approvedHash = null;
    report.approvedAt = null;
    report.approvedBy = null;
    report.publishedAt = null;
    report.createdAt = new Date().toISOString();
    store.reports.push(report);
    store.snapshots.push(structuredClone(report.content.financial));
    audit(
      store,
      actor,
      "create",
      report.id,
      `${period} ${report.version} · Mock`,
    );
    return report;
  }, true);
}
export async function reviseReport(
  id: string,
  actor: Actor,
  kind: "minor" | "major" = "minor",
) {
  assertAdmin(actor);
  return withStore((store) => {
    const source = store.reports.find((r) => r.id === id);
    if (!source || source.state !== "published")
      throw new Error("改訂元は公開済みレポートを指定してください。");
    if (
      store.reports.some(
        (r) => r.period === source.period && r.state !== "published",
      )
    )
      throw new Error("この期間には未公開の改訂版が存在します。");
    const versions = store.reports
      .filter((r) => r.period === source.period)
      .map((r) => r.version.slice(1).split(".").map(Number));
    const major = Math.max(...versions.map((v) => v[0]));
    const minor = Math.max(
      ...versions.filter((v) => v[0] === major).map((v) => v[1]),
    );
    const report = structuredClone(source);
    report.id = randomUUID();
    report.version =
      kind === "major" ? `v${major + 1}.0` : `v${major}.${minor + 1}`;
    report.state = "draft";
    report.revision = 1;
    report.approvedHash = null;
    report.approvedAt = null;
    report.approvedBy = null;
    report.publishedAt = null;
    report.createdAt = new Date().toISOString();
    store.reports.push(report);
    const monthlyInput = store.monthlyInputs?.find(
      (input) => input.reportId === source.id,
    );
    if (monthlyInput) {
      store.monthlyInputs!.push({
        ...monthlyInput,
        reportId: report.id,
        updatedAt: report.createdAt,
      });
    }
    audit(
      store,
      actor,
      "revision",
      report.id,
      `${source.version} → ${report.version} · 公開版を保持`,
    );
    return report;
  }, true);
}
export async function mutateReport(
  id: string,
  actor: Actor,
  expectedRevision: number,
  operation: WorkflowOperation,
  payload?: unknown,
): Promise<ReportVersion> {
  assertAdmin(actor);
  return withStore(async (store) => {
    const index = store.reports.findIndex(
      (r) => r.id === id && r.companyId === actor.companyId,
    );
    if (index < 0) throw new Error("レポートが見つかりません。");
    const current = store.reports[index];
    if (current.revision !== expectedRevision)
      throw new Error(
        "別の更新が反映されています。画面を再読み込みしてください。",
      );
    const next = applyOperation(current, operation, actor.id);
    if (operation === "edit") {
      const edit = contentEditSchema.parse(payload);
      next.content.summary.headline = edit.headline;
      next.content.summary.text = edit.summary;
      next.content.summary.points = edit.summaryPoints;
      next.content.summary.outlook = edit.summaryOutlook;
      next.content.financialAnalysis = edit.financialAnalysis;
      next.content.highlights = edit.highlights;
      next.content.briefing = edit.briefing;
      next.content.forward = edit.forward;
      next.content.risks = edit.risks;
      next.content.ceo.quote = edit.ceoQuote;
      next.content.ceo.message = edit.ceoMessage;
    }
    if (operation === "generate") {
      const result = await new MockAnalysisProvider().generate(next.content);
      next.content.summary = result.summary;
      next.content.financialAnalysis = result.financialAnalysis;
      next.analysis = "generated-mock";
      store.analyses.push({
        id: randomUUID(),
        reportId: id,
        at: new Date().toISOString(),
        snapshotId: next.content.financial.id,
        provider: "mock",
        output: result,
      });
      audit(
        store,
        actor,
        "ai-analysis",
        id,
        `Mock AI Draft · Positive ${result.positiveFactors.length} / Negative ${result.negativeFactors.length} / Risk ${result.riskDraft.length} / Forward ${result.forwardDraft.length} · 自動公開なし`,
      );
    }
    if (operation === "import") {
      const result = await new SyntheticFreeeProvider().import(current.period);
      next.content.financial = result.financial;
      next.content.revenueDrivers = result.revenueDrivers;
      next.content.profitDrivers = result.profitDrivers;
      if (result.managementMetrics) {
        next.content.ai = structuredClone(result.managementMetrics);
        const revenue = next.content.ai.revenue.find(
          (k) => k.key === "aiRevenue",
        );
        if (revenue)
          next.content.forward = next.content.forward.map((indicator) =>
            indicator.id === "actual" && indicator.kind === "Actual"
              ? {
                  ...indicator,
                  value: `${(revenue.value / 1_000_000).toFixed(2)} 百万円`,
                }
              : indicator,
          );
      }
      next.analysis = "not-generated";
      store.snapshots.push(structuredClone(result.financial));
      store.imports.push({
        id: randomUUID(),
        period: current.period,
        snapshotId: result.financial.id,
        source: "synthetic-freee-fixture",
        status: "validated",
        at: new Date().toISOString(),
        isMock: true,
      });
    }
    next.contentHash = contentHash(next.content);
    store.reports[index] = next;
    audit(
      store,
      actor,
      operation,
      id,
      `${next.period} ${next.version} · ${next.state} · revision ${next.revision}`,
    );
    return next;
  }, true);
}
export async function recordPdfExport(id: string, actor: Actor) {
  assertActor(actor);
  return withStore((store) => {
    audit(store, actor, "pdf-export", id, "公開済みMockレポートのPDF出力");
    return true;
  }, true);
}
export async function recordDocumentDownload(id: string, actor: Actor) {
  assertActor(actor);
  return withStore((store) => {
    const document = store.documents?.find(
      (d) =>
        d.id === id && d.companyId === actor.companyId && d.status === "ready",
    );
    const published = store.reports.some(
      (r) =>
        r.companyId === actor.companyId &&
        r.state === "published" &&
        r.content.documents?.some((d) => d.id === id),
    );
    if (!document || (actor.role !== "admin" && !published))
      throw new Error("アクセス権がありません。");
    audit(
      store,
      actor,
      "document-download",
      document.versionId,
      document.title,
    );
  }, true);
}
export async function saveContent(
  id: string,
  actor: Actor,
  revision: number,
  content: ReportContent,
  analysis: ReportVersion["analysis"],
  notes?: string,
) {
  assertAdmin(actor);
  return withStore((store) => {
    const index = store.reports.findIndex(
      (r) => r.id === id && r.companyId === actor.companyId,
    );
    const current = store.reports[index];
    if (!current || current.revision !== revision)
      throw new Error(
        "別の更新が反映されています。画面を再読み込みしてください。",
      );
    if (!content.financial.isMock)
      throw new Error("開発環境では実際の財務数値は保存できません。");
    const next = applyOperation(current, "edit", actor.id);
    next.content = structuredClone(content);
    next.analysis = analysis;
    next.contentHash = contentHash(content);
    store.reports[index] = next;
    if (notes !== undefined) {
      store.monthlyInputs ??= [];
      store.monthlyInputs = store.monthlyInputs.filter(
        (n) => n.reportId !== id,
      );
      store.monthlyInputs.push({
        reportId: id,
        notes,
        updatedAt: new Date().toISOString(),
      });
    }
    if (!store.snapshots.some((s) => s.id === content.financial.id))
      store.snapshots.push(structuredClone(content.financial));
    audit(
      store,
      actor,
      "monthly-update",
      id,
      "月次内容を更新。原文は管理者のみ閲覧可。",
    );
    return next;
  }, true);
}
export async function addMockDocument(
  id: string,
  actor: Actor,
  revision: number,
  document: StoredDocument,
) {
  assertAdmin(actor);
  return withStore((store) => {
    const index = store.reports.findIndex(
      (r) => r.id === id && r.companyId === actor.companyId,
    );
    const current = store.reports[index];
    if (!current || current.revision !== revision)
      throw new Error("別の更新が反映されています。再読み込みしてください。");
    const next = applyOperation(current, "edit", actor.id);
    const publicDocument = {
      id: document.id,
      title: document.title,
      category: document.category,
      period: document.period,
      basis: document.basis,
      description: document.description,
      fileName: document.fileName,
      bytes: document.bytes,
      checksum: document.checksum,
      uploadedAt: document.uploadedAt,
    };
    next.content.documents = [
      ...(next.content.documents || []),
      publicDocument,
    ];
    next.contentHash = contentHash(next.content);
    store.reports[index] = next;
    store.documents ??= [];
    store.documents.push(document);
    audit(
      store,
      actor,
      "document-attached",
      id,
      "Mock PDFを添付。承認を解除。",
    );
    return next;
  }, true);
}
export async function listDocuments(actor: Actor) {
  assertActor(actor);
  return withStore((store) =>
    (store.documents || []).filter(
      (d) =>
        d.companyId === actor.companyId &&
        d.status === "ready" &&
        (actor.role === "admin" ||
          store.reports.some(
            (r) =>
              r.state === "published" &&
              r.content.documents?.some((meta) => meta.id === d.id),
          )),
    ),
  );
}
export async function detachDocument(
  id: string,
  actor: Actor,
  revision: number,
  documentId: string,
) {
  const report = await getAdminReport(id, actor);
  if (!report) throw new Error("レポートがありません。");
  const content = structuredClone(report.content);
  content.documents = (content.documents || []).filter(
    (d) => d.id !== documentId,
  );
  return saveContent(id, actor, revision, content, report.analysis);
}
