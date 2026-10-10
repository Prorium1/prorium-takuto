import { yoyPresentation } from "./finance";
import type { StagedFreeeRow } from "./freee-staging";

export function freeeReviewFacts(row: StagedFreeeRow) {
  const metrics = [
    { key: "revenue", label: "売上高", values: row.candidate.revenue },
    { key: "operatingProfit", label: "営業利益", values: row.candidate.operatingProfit },
    { key: "ordinaryProfit", label: "経常利益", values: row.candidate.ordinaryProfit },
    { key: "cash", label: "現預金候補", values: row.candidate.cash },
  ] as const;
  return metrics.map(({ key, label, values }) => ({
    key,
    label,
    current: values.current,
    previous: values.previous,
    yoy: yoyPresentation(values.current, values.previous),
  }));
}
