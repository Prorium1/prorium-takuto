import type { ReportState } from "./types";
export type ReportPreparation = {
  id: string;
  period: string;
  version: string;
  state: ReportState;
  contextRequired: boolean;
};
export function preparationLabel(report: ReportPreparation) {
  return report.state === "approved"
    ? "承認済み・公開待ち"
    : report.state === "review"
      ? "内容確認・承認待ち"
      : report.contextRequired
        ? "業績の背景・サマリーの入力待ち"
        : "下書きを編集中";
}
