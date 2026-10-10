import "server-only";
import type {
  Actor,
  ReportVersion,
  ReportContent,
  WorkflowOperation,
  MockStore,
} from "../domain/types";
import { contentEditSchema, periodSchema } from "../domain/validation";
import { emptyReport } from "../domain/monthly";
import { humanEditAnalysis } from "../domain/provenance";
import { createSupabaseClient } from "./supabase";
import { productionConfiguration } from "./environment";

type Row = Record<string, unknown>;
export async function productionClient(actor: Actor, admin = false) {
  const client = await createSupabaseClient();
  const config = productionConfiguration();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (
    error ||
    !user ||
    user.id !== actor.id ||
    actor.companyId !== config.companyId
  )
    throw new Error("アクセス権がありません。");
  const { data, error: roleError } = await client.rpc("ir_current_actor", {
    p_company: config.companyId,
  });
  if (
    roleError ||
    !data ||
    data.role !== actor.role ||
    (admin && data.role !== "admin")
  )
    throw new Error("管理者権限とアクセス権を確認してください。");
  return client;
}
export function databaseError(error: { message: string } | null) {
  if (!error) return;
  if (/concurrent|revision/i.test(error.message))
    throw new Error(
      "別の更新が反映されています。画面を再読み込みしてください。",
    );
  if (/unique|duplicate/i.test(error.message))
    throw new Error("この月のレポートまたは未公開の改訂版が既に存在します。");
  if (/immutable|published/i.test(error.message))
    throw new Error(
      "公開済みの内容は変更できません。改訂版を作成してください。",
    );
  if (/MFA|Admin/i.test(error.message))
    throw new Error("管理者権限が必要です。");
  if (/Summary|commentary/i.test(error.message))
    throw new Error("サマリーとCEOコメントを入力してください。");
  throw new Error(
    "保存できませんでした。入力内容・権限・接続設定を確認してください。",
  );
}
function mapVersion(row: Row): ReportVersion {
  const header = row.reports as { company_id: string; period: string };
  return {
    id: String(row.id),
    companyId: header.company_id,
    period: header.period.slice(0, 7),
    version: String(row.version),
    state: row.state as ReportVersion["state"],
    revision: Number(row.revision),
    content: row.content as ReportContent,
    contentHash: String(row.content_hash),
    analysis: row.analysis as ReportVersion["analysis"],
    approvedHash: row.approved_hash as string | null,
    approvedBy: row.approved_by as string | null,
    approvedAt: row.approved_at as string | null,
    publishedAt: row.published_at as string | null,
    createdAt: String(row.created_at),
  };
}
const selection = "*,reports!inner(company_id,period)";
export async function listPublishedReports(actor: Actor) {
  const client = await productionClient(actor);
  const { data, error } = await client
    .from("report_versions")
    .select(selection)
    .eq("reports.company_id", actor.companyId)
    .eq("state", "published")
    .order("created_at", { ascending: false });
  databaseError(error);
  return (data || [])
    .map((r) => mapVersion(r as unknown as Row))
    .sort(
      (a, b) =>
        b.period.localeCompare(a.period) ||
        b.createdAt.localeCompare(a.createdAt),
    );
}
export async function getPublishedReport(
  period: string,
  actor: Actor,
  version?: string,
) {
  periodSchema.parse(period);
  return (
    (await listPublishedReports(actor)).find(
      (r) => r.period === period && (!version || r.version === version),
    ) || null
  );
}
export async function getAdminReports(actor: Actor) {
  const client = await productionClient(actor, true);
  const { data, error } = await client
    .from("report_versions")
    .select(selection)
    .eq("reports.company_id", actor.companyId)
    .order("created_at", { ascending: false });
  databaseError(error);
  return (data || [])
    .map((r) => mapVersion(r as unknown as Row))
    .sort(
      (a, b) =>
        b.period.localeCompare(a.period) ||
        b.createdAt.localeCompare(a.createdAt),
    );
}
export async function getAdminReport(id: string, actor: Actor) {
  const client = await productionClient(actor, true);
  const { data, error } = await client
    .from("report_versions")
    .select(selection)
    .eq("id", id)
    .eq("reports.company_id", actor.companyId)
    .maybeSingle();
  databaseError(error);
  return data ? mapVersion(data as unknown as Row) : null;
}
export async function getAdminStore(actor: Actor) {
  const client = await productionClient(actor, true);
  const results = await Promise.all([
    client
      .from("audit_logs")
      .select("*")
      .eq("company_id", actor.companyId)
      .order("created_at", { ascending: false })
      .limit(200),
    client
      .from("monthly_inputs")
      .select("*,report_versions!inner(reports!inner(company_id))")
      .eq("report_versions.reports.company_id", actor.companyId),
    client
      .from("analysis_runs")
      .select("*,report_versions!inner(reports!inner(company_id))")
      .eq("report_versions.reports.company_id", actor.companyId)
      .order("created_at", { ascending: true })
      .limit(200),
  ]);
  for (const r of results) databaseError(r.error);
  return {
    imports: [],
    snapshots: [],
    audit: (results[0].data || []).map((r) => ({
      id: r.id,
      at: r.created_at,
      actorId: r.actor_id,
      action: r.action,
      reportId: r.record_id,
      detail: JSON.stringify(r.metadata),
    })),
    monthlyInputs: (results[1].data || []).map((r) => ({
      reportId: r.version_id,
      notes: r.notes,
      updatedAt: r.updated_at,
    })),
    analyses: (results[2].data || []).map((r) => ({
      id: r.id,
      reportId: r.version_id,
      at: r.created_at,
      snapshotId: r.snapshot_id,
      provider: r.provider,
      output: r.output,
    })),
  } as Pick<
    MockStore,
    "imports" | "snapshots" | "audit" | "analyses" | "monthlyInputs"
  >;
}
export async function createReport(
  period: string,
  actor: Actor,
  summaryOnly = false,
) {
  void summaryOnly;
  const client = await productionClient(actor, true);
  const report = emptyReport(period, actor.companyId);
  const { data, error } = await client.rpc("ir_create_report", {
    p_company: actor.companyId,
    p_period: period,
    p_content: report.content,
  });
  databaseError(error);
  const row = Array.isArray(data) ? data[0] : data;
  return (await getAdminReport(row.id, actor))!;
}
export async function reviseReport(
  id: string,
  actor: Actor,
  kind: "minor" | "major" = "minor",
) {
  const client = await productionClient(actor, true);
  const { data, error } = await client.rpc("ir_revise_report", {
    p_id: id,
    p_kind: kind,
  });
  databaseError(error);
  const row = Array.isArray(data) ? data[0] : data;
  return (await getAdminReport(row.id, actor))!;
}
export async function saveContent(
  id: string,
  actor: Actor,
  revision: number,
  content: ReportContent,
  analysis: ReportVersion["analysis"],
  notes?: string,
) {
  const client = await productionClient(actor, true);
  const { error } = await client.rpc("ir_save_report", {
    p_id: id,
    p_revision: revision,
    p_content: content,
    p_analysis: analysis,
    p_notes: notes ?? null,
  });
  databaseError(error);
  return (await getAdminReport(id, actor))!;
}
export async function mutateReport(
  id: string,
  actor: Actor,
  expectedRevision: number,
  operation: WorkflowOperation,
  payload?: unknown,
) {
  const client = await productionClient(actor, true);
  if (operation === "generate" || operation === "import")
    throw new Error(
      "本番では今月のサマリー入力または財務数値入力をご利用ください。freeeは未接続です。",
    );
  if (operation === "edit") {
    const report = await getAdminReport(id, actor);
    if (!report) throw new Error("レポートが見つかりません。");
    const edit = contentEditSchema.parse(payload),
      content = structuredClone(report.content);
    content.summary.headline = edit.headline;
    content.summary.text = edit.summary;
    content.summary.points = edit.summaryPoints;
    content.summary.outlook = edit.summaryOutlook;
    content.financialAnalysis = edit.financialAnalysis;
    content.highlights = edit.highlights;
    content.briefing = edit.briefing;
    if (edit.eventSpotlight !== undefined)
      content.eventSpotlight = edit.eventSpotlight;
    content.forward = edit.forward;
    content.risks = edit.risks;
    content.ceo.quote = edit.ceoQuote;
    content.ceo.message = edit.ceoMessage;
    return saveContent(
      id,
      actor,
      expectedRevision,
      content,
      humanEditAnalysis(report.analysis),
    );
  }
  const { error } = await client.rpc("ir_transition_report", {
    p_id: id,
    p_revision: expectedRevision,
    p_operation: operation,
  });
  databaseError(error);
  return (await getAdminReport(id, actor))!;
}
export async function recordPdfExport(id: string, actor: Actor) {
  const client = await productionClient(actor);
  const { error } = await client.rpc("ir_record_pdf_export", { p_id: id });
  databaseError(error);
}
