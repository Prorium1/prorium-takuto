import "server-only";
import type { Actor, WorkflowOperation } from "../domain/types";
import { isMockEnvironment, productionConfigured } from "./environment";
async function backend() {
  if (isMockEnvironment()) return import("./mock-repository");
  if (productionConfigured()) return import("./production-repository");
  throw new Error("本番接続が未設定です。");
}
export async function listPublishedReports(actor: Actor) {
  return (await backend()).listPublishedReports(actor);
}
export async function getPublishedReport(
  period: string,
  actor: Actor,
  version?: string,
) {
  return (await backend()).getPublishedReport(period, actor, version);
}
export async function getAdminReports(actor: Actor) {
  return (await backend()).getAdminReports(actor);
}
export async function getAdminReport(id: string, actor: Actor) {
  return (await backend()).getAdminReport(id, actor);
}
export async function getAdminStore(actor: Actor) {
  return (await backend()).getAdminStore(actor);
}
export async function createReport(
  period: string,
  actor: Actor,
  summaryOnly = false,
) {
  return (await backend()).createReport(period, actor, summaryOnly);
}
export async function reviseReport(
  id: string,
  actor: Actor,
  kind: "minor" | "major" = "minor",
) {
  return (await backend()).reviseReport(id, actor, kind);
}
export async function mutateReport(
  id: string,
  actor: Actor,
  revision: number,
  operation: WorkflowOperation,
  payload?: unknown,
) {
  return (await backend()).mutateReport(
    id,
    actor,
    revision,
    operation,
    payload,
  );
}
export async function recordPdfExport(id: string, actor: Actor) {
  return (await backend()).recordPdfExport(id, actor);
}
