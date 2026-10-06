import "server-only";
import type { Actor, ReportContent, ReportVersion } from "../domain/types";
import { isMockEnvironment } from "./environment";
export async function saveContent(
  id: string,
  actor: Actor,
  revision: number,
  content: ReportContent,
  analysis: ReportVersion["analysis"],
  notes?: string,
) {
  const repository = isMockEnvironment()
    ? await import("./mock-repository")
    : await import("./production-repository");
  return repository.saveContent(id, actor, revision, content, analysis, notes);
}
