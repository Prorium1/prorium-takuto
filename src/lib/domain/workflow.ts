import { createHash } from "node:crypto";
import type { ReportContent, ReportVersion, WorkflowOperation } from "./types";
import { reconcileDrivers } from "./finance";

export function contentHash(content: ReportContent) {
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}
export function applyOperation(
  report: ReportVersion,
  operation: WorkflowOperation,
  actorId: string,
): ReportVersion {
  if (report.state === "published")
    throw new Error(
      "公開済みレポートは変更できません。改訂版を作成してください。",
    );
  const next = structuredClone(report);
  if (["edit", "generate", "import"].includes(operation)) {
    next.state = "draft";
    next.approvedHash = null;
    next.approvedBy = null;
    next.approvedAt = null;
  } else if (operation === "review") {
    if (report.state !== "draft")
      throw new Error("レビューへ提出できるのはDraftのみです。");
    if (
      !report.content.summary.text.trim() ||
      !report.content.ceo.message.trim()
    )
      throw new Error("サマリーとCEOコメントを入力してください。");
    const c = report.content;
    if (
      !reconcileDrivers(
        c.financial.revenue.previous,
        c.financial.revenue.current,
        c.revenueDrivers,
      ) ||
      !reconcileDrivers(
        c.financial.operatingProfit.previous,
        c.financial.operatingProfit.current,
        c.profitDrivers,
      )
    )
      throw new Error("数値と変化要因の合計が一致していません。");
    next.state = "review";
  } else if (operation === "approve") {
    if (report.state !== "review")
      throw new Error("承認には人によるレビューが必要です。");
    next.state = "approved";
    next.approvedHash = report.contentHash;
    next.approvedBy = actorId;
    next.approvedAt = new Date().toISOString();
  } else if (operation === "publish") {
    if (
      report.state !== "approved" ||
      !report.approvedHash ||
      report.approvedHash !== report.contentHash ||
      report.contentHash !== contentHash(report.content) ||
      !report.approvedBy
    )
      throw new Error("現在の内容に対する経営承認が必要です。");
    next.state = "published";
    next.publishedAt = new Date().toISOString();
    next.analysis =
      report.analysis === "generated-mock" ? "reviewed-mock" : report.analysis;
  }
  next.revision += 1;
  return next;
}
