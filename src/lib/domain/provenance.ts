import type { ReportVersion } from "./types";

export function humanEditAnalysis(
  previous: ReportVersion["analysis"],
): ReportVersion["analysis"] {
  return ["generated-ai", "generated-mock", "reviewed-mock"].includes(previous)
    ? previous
    : "human-authored";
}
export function reportAttribution(
  report: Pick<ReportVersion, "analysis" | "approvedBy">,
) {
  const method =
    report.analysis === "generated-ai"
      ? "AI assisted"
      : ["generated-mock", "reviewed-mock"].includes(report.analysis)
        ? "Mock analysis"
        : "Management authored";
  return {
    label: report.analysis === "not-generated" ? "分析待ち" : method,
    statement: `${method}. ${report.approvedBy ? "Human approved" : "Human review required"}.`,
  };
}
