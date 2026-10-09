import type { FinancialSnapshot, ReportVersion } from "./types";

export function financialProvenance(financial: FinancialSnapshot) {
  const available =
    financial.available !== false && financial.source !== "not-entered";
  return {
    available,
    source: !available
      ? "財務KPI未入力"
      : financial.isMock
        ? "Synthetic freee fixture"
        : financial.source === "freee"
          ? "freee"
          : "管理者入力",
    status: !available
      ? "未入力"
      : financial.isMock
        ? "サンプル読込済み"
        : financial.source === "freee"
          ? "取込済み"
          : "入力済み",
    // A source does not establish that an automatic sync actually ran.
    sync: financial.isMock ? "Mock · freee未接続" : "保存時点のSnapshot",
    updatedAt: available ? financial.updatedAt : null,
  };
}

export function formatReportTimestamp(value: string) {
  return `${new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value))} JST`;
}

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
  const label = report.analysis === "not-generated" ? "分析待ち" : method;
  const review = report.approvedBy ? "Human approved" : "Human review required";
  return {
    label,
    summaryLabel: `${label} · ${review}`,
    statement: `${method}. ${report.approvedBy ? "Human approved" : "Human review required"}.`,
  };
}
