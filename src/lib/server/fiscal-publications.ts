import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { Actor } from "../domain/types";
import {
  emptyFiscalEditor,
  fiscalEditorSchema,
  fiscalPublicationContentSchema,
  fiscalReviewIssues,
  investorFiscalSource,
  type FiscalPublication,
  type FiscalEditor,
} from "../domain/fiscal-publication";
import { isMockEnvironment, isCloudMockPreview } from "./environment";
import { productionClient, databaseError } from "./production-repository";
import { withFiscalPublications } from "./mock-repository";
import { getFiscalSource } from "./fiscal";
import { getOwnershipImport } from "./ownership-import";
import { getAdminReports } from "./repository";
async function mockSources(actor: Actor, year: number) {
  const [source, ownership, reports] = await Promise.all([
    getFiscalSource(actor, year),
    getOwnershipImport(actor),
    getAdminReports(actor),
  ]);
  if (!source) throw new Error("会計データを確認してください。");
  const newest = new Map<string, (typeof reports)[number]>();
  for (const r of reports.toSorted(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  ))
    if (!newest.has(r.period)) newest.set(r.period, r);
  const event = [...newest.values()]
    .sort((a, b) => b.period.localeCompare(a.period))
    .filter((r) => r.period >= `${year - 1}-11` && r.period <= `${year}-10`)
    .map((r) => r.content.eventSpotlight)
    .find((e) => e?.videoUrl);
  return {
    source: investorFiscalSource(source),
    ownership: ownership?.snapshot || null,
    video: event
      ? { occurredOn: event.occurredOn, videoUrl: event.videoUrl }
      : null,
  };
}
const checksum = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
function map(r: Record<string, unknown>): FiscalPublication {
  return {
    id: String(r.id),
    companyId: String(r.company_id),
    year: Number(r.fiscal_end_year),
    version: Number(r.version),
    revision: Number(r.revision),
    state: r.state as FiscalPublication["state"],
    content: fiscalPublicationContentSchema.parse(r.content),
    contentHash: String(r.content_hash),
    approvedHash: r.approved_hash as string | null,
    publishedAt: r.published_at as string | null,
  };
}
export async function listFiscalPublications(
  actor: Actor,
  publishedOnly = true,
): Promise<FiscalPublication[]> {
  if (!publishedOnly && actor.role !== "admin")
    throw new Error("管理者権限が必要です。");
  if (isMockEnvironment())
    return withFiscalPublications(actor, (rows) =>
      rows
        .filter(
          (r) =>
            r.companyId === actor.companyId &&
            (!publishedOnly || r.state === "published"),
        )
        .sort((a, b) => b.year - a.year || b.version - a.version),
    );
  const client = await productionClient(actor);
  let query = client
    .from("fiscal_publications")
    .select("*")
    .eq("company_id", actor.companyId)
    .order("fiscal_end_year", { ascending: false })
    .order("version", { ascending: false });
  if (publishedOnly) query = query.eq("state", "published");
  const { data, error } = await query;
  databaseError(error);
  return (data || []).map(map);
}
export async function getFiscalPublication(
  actor: Actor,
  year: number,
  version?: number,
  preview = false,
) {
  if (
    !Number.isInteger(year) ||
    year < 2020 ||
    year > 2099 ||
    (version !== undefined && (!Number.isInteger(version) || version < 1))
  )
    return null;
  if (preview && actor.role !== "admin") return null;
  return (
    (await listFiscalPublications(actor, !preview)).find(
      (r) =>
        r.year === year && (version === undefined || r.version === version),
    ) || null
  );
}
export async function prepareFiscalPublication(actor: Actor, year: number) {
  if (actor.role !== "admin") throw new Error("管理者権限が必要です。");
  if (isMockEnvironment()) {
    const sources = await mockSources(actor, year);
    return withFiscalPublications(
      actor,
      (rows) => {
        const existing = rows.find(
          (r) => r.year === year && r.state !== "published",
        );
        if (existing) return existing;
        const previous = rows
          .filter((r) => r.year === year)
          .sort((a, b) => b.version - a.version)[0];
        const editor = previous
          ? {
              organization: previous.content.organization,
              notes: previous.content.notes,
            }
          : emptyFiscalEditor(sources.source.asOf);
        if (!previous) {
          editor.organization = {
            ...editor.organization,
            employees: 8,
            onLeave: 2,
            partTime: null,
            confirmed: false,
            sourceLabel: "Mock 経営者確認",
            areas: ["事業運営", "制作・開発", "顧客サポート", "管理"],
          };
          editor.notes.risks = "架空の会計値には未締め月を含みます。";
        }
        const content = fiscalPublicationContentSchema.parse({
          ...editor,
          ...sources,
        });
        const row: FiscalPublication = {
          id: randomUUID(),
          companyId: actor.companyId,
          year,
          version:
            Math.max(
              0,
              ...rows.filter((r) => r.year === year).map((r) => r.version),
            ) + 1,
          revision: 1,
          state: "draft",
          content,
          contentHash: checksum(content),
          approvedHash: null,
          publishedAt: null,
        };
        rows.push(row);
        return row;
      },
      true,
    );
  }
  const client = await productionClient(actor, true),
    { data, error } = await client.rpc("ir_prepare_fiscal_publication", {
      p_company: actor.companyId,
      p_year: year,
    });
  databaseError(error);
  return map(data);
}
export async function refreshFiscalPublication(
  actor: Actor,
  id: string,
  revision: number,
) {
  if (actor.role !== "admin") throw new Error("管理者権限が必要です。");
  if (isMockEnvironment()) {
    const current = (await listFiscalPublications(actor, false)).find(
      (r) => r.id === id,
    );
    if (!current || current.state === "published")
      throw new Error("公開済みの版は変更できません。");
    const sources = await mockSources(actor, current.year);
    return withFiscalPublications(
      actor,
      (rows) => {
        const r = rows.find(
          (r) => r.id === id && r.companyId === actor.companyId,
        );
        if (!r || r.revision !== revision)
          throw new Error("別の更新があります。再読み込みしてください。");
        if (r.state === "published")
          throw new Error("公開済みの版は変更できません。");
        r.content = fiscalPublicationContentSchema.parse({
          ...r.content,
          ...sources,
        });
        r.contentHash = checksum(r.content);
        r.state = "draft";
        r.revision++;
        r.approvedHash = null;
        return r;
      },
      true,
    );
  }
  const client = await productionClient(actor, true),
    { data, error } = await client.rpc("ir_refresh_fiscal_publication", {
      p_id: id,
      p_revision: revision,
    });
  databaseError(error);
  return map(data);
}
export async function editFiscalPublication(
  actor: Actor,
  id: string,
  revision: number,
  input: unknown,
) {
  if (actor.role !== "admin") throw new Error("管理者権限が必要です。");
  const editor = fiscalEditorSchema.parse(input);
  if (isMockEnvironment())
    return withFiscalPublications(
      actor,
      (rows) => {
        const r = rows.find(
          (r) => r.id === id && r.companyId === actor.companyId,
        );
        if (!r || r.revision !== revision)
          throw new Error("別の更新があります。再読み込みしてください。");
        if (r.state === "published")
          throw new Error("公開済みの資料は改訂版を作成してください。");
        r.content = fiscalPublicationContentSchema.parse({
          ...r.content,
          ...editor,
        });
        r.state = "draft";
        r.revision++;
        r.approvedHash = null;
        r.contentHash = checksum(r.content);
        return r;
      },
      true,
    );
  const client = await productionClient(actor, true),
    { data, error } = await client.rpc("ir_edit_fiscal_publication", {
      p_id: id,
      p_revision: revision,
      p_editor: editor,
    });
  databaseError(error);
  return map(data);
}
export async function transitionFiscalPublication(
  actor: Actor,
  id: string,
  revision: number,
  operation: "review" | "approve" | "publish",
  acknowledged: boolean,
) {
  if (actor.role !== "admin") throw new Error("管理者権限が必要です。");
  if (isMockEnvironment())
    return withFiscalPublications(
      actor,
      (rows) => {
        const r = rows.find(
          (r) => r.id === id && r.companyId === actor.companyId,
        );
        if (!r || r.revision !== revision)
          throw new Error("別の更新があります。再読み込みしてください。");
        const next = {
            review: "review",
            approve: "approved",
            publish: "published",
          } as const,
          prior = { review: "draft", approve: "review", publish: "approved" };
        if (r.state !== prior[operation])
          throw new Error("確認・承認・公開の順番を確認してください。");
        if (
          operation === "review" &&
          (!acknowledged || fiscalReviewIssues(r.content).length)
        )
          throw new Error("会計値と人数・確認中の情報を確認してください。");
        if (operation === "publish" && r.approvedHash !== r.contentHash)
          throw new Error("再承認が必要です。");
        r.state = next[operation];
        r.revision++;
        if (operation === "approve") r.approvedHash = r.contentHash;
        if (operation === "publish") r.publishedAt = new Date().toISOString();
        return r;
      },
      true,
    );
  const client = await productionClient(actor, true),
    { data, error } = await client.rpc("ir_fiscal_transition", {
      p_id: id,
      p_revision: revision,
      p_operation: operation,
      p_acknowledged: acknowledged,
    });
  databaseError(error);
  return map(data);
}
export async function recordFiscalExport(actor: Actor, id: string) {
  if (isMockEnvironment()) return;
  const client = await productionClient(actor),
    { error } = await client.rpc("ir_record_fiscal_export", { p_id: id });
  databaseError(error);
}
export function fiscalPublicationWritesEnabled() {
  return !isCloudMockPreview();
}
export type { FiscalEditor };
