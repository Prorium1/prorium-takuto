import { z } from "zod";
import type { FinancialSnapshot } from "./types";
import { compareYoY } from "./finance";

// Stored only in the existing, admin-only monthly_inputs.notes column.
// Investor content and the AI payload are built from an explicit allowlist below.
const PREFIX = "PRORIUM_REFLECTION_V1\n";
const answer = z.string().trim().max(1200);
export const reflectionSchema = z
  .object({
    events: z.string().trim().max(12000),
    revenueReason: answer,
    profitReason: answer,
    risksAndActions: answer,
    aiImpact: answer,
    outlook: answer,
    hypotheses: answer,
    voiceScript: z.string().trim().max(3000).default(""),
    privateNotes: z.string().trim().max(3000),
  })
  .strict();
export type MonthlyReflection = z.infer<typeof reflectionSchema>;
export type PublicReflection = Omit<MonthlyReflection, "privateNotes" | "voiceScript">;

export function emptyReflection(): MonthlyReflection {
  return {
    events: "",
    revenueReason: "",
    profitReason: "",
    risksAndActions: "",
    aiImpact: "",
    outlook: "",
    hypotheses: "",
    voiceScript: "",
    privateNotes: "",
  };
}
export function decodeReflection(notes: string): MonthlyReflection {
  if (!notes.startsWith(PREFIX)) return { ...emptyReflection(), events: notes };
  return reflectionSchema.parse(JSON.parse(notes.slice(PREFIX.length)));
}
export function encodeReflection(raw: unknown): string {
  const reflection = reflectionSchema.parse(raw);
  if (!Object.values(reflection).some(Boolean))
    throw new Error("振り返りを1項目以上入力してください。");
  const encoded = PREFIX + JSON.stringify(reflection);
  if (encoded.length > 12000)
    throw new Error(
      "振り返り全体が保存上限を超えています。入力を少し短くしてください（合計約11,000文字まで）。",
    );
  return encoded;
}
export function publicReflection(raw: unknown): PublicReflection {
  const r = reflectionSchema.parse(raw);
  return {
    events: r.events,
    revenueReason: r.revenueReason,
    profitReason: r.profitReason,
    risksAndActions: r.risksAndActions,
    aiImpact: r.aiImpact,
    outlook: r.outlook,
    hypotheses: r.hypotheses,
  };
}
function validatedPublicReflection(period: string, raw: unknown) {
  z.string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .parse(period);
  const reflection = publicReflection(raw);
  if (Object.values(reflection).join("").length < 10)
    throw new Error(
      "下書きに使用する振り返りを10文字以上入力してください。非公開メモは生成に使用しません。",
    );
  return reflection;
}
const excerpt = (value: string, limit: number) =>
  value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;

export function structureReflection(period: string, raw: unknown) {
  const r = validatedPublicReflection(period, raw);
  // An explanation is management's account, not a computed attribution.
  const reasons = [
    r.revenueReason &&
      `売上の変化理由（経営者の説明）：${excerpt(r.revenueReason, 500)}`,
    r.profitReason &&
      `利益の変化理由（経営者の説明）：${excerpt(r.profitReason, 500)}`,
    r.aiImpact && `AIの寄与・計測状況：${excerpt(r.aiImpact, 400)}`,
    r.hypotheses && `未検証の見立て：${excerpt(r.hypotheses, 400)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  // Each topic has its own space: a long progress note must not crowd out risk.
  // Keep the original wording; this fallback is editorial, not AI inference.
  const summaryLines = [
    r.events && `今月の動き：${excerpt(r.events, 350)}`,
    r.revenueReason &&
      `売上の背景（経営者の説明）：${excerpt(r.revenueReason, 220)}`,
    r.profitReason &&
      `利益の背景（経営者の説明）：${excerpt(r.profitReason, 220)}`,
    r.risksAndActions && `課題と対応：${excerpt(r.risksAndActions, 350)}`,
    r.aiImpact && `AIの取り組み・計測状況：${excerpt(r.aiImpact, 350)}`,
  ].filter(Boolean);
  const points = [
    r.events && `進捗：${excerpt(r.events, 250)}`,
    (r.revenueReason || r.profitReason) &&
      `変化の理由（経営者の説明）：${excerpt([r.revenueReason, r.profitReason].filter(Boolean).join(" / "), 250)}`,
    r.risksAndActions && `課題と対応：${excerpt(r.risksAndActions, 250)}`,
    r.aiImpact && `AI・計測状況：${excerpt(r.aiImpact, 250)}`,
  ].filter(Boolean);
  // Future-only and hypothesis-only notes must retain their classification.
  if (!summaryLines.length) {
    summaryLines.push(
      "今月の実績・進捗は未入力です。見通しや未検証事項を実績とは分けて掲載しています。",
    );
    if (r.outlook) points.push(`見通し・予定：${excerpt(r.outlook, 250)}`);
    if (r.hypotheses)
      points.push(`未検証の見立て：${excerpt(r.hypotheses, 250)}`);
  }
  return {
    summary: {
      headline: `${Number(period.slice(5))}月の事業と経営のアップデート`,
      text: summaryLines.join("\n\n"),
      points,
      outlook: r.outlook ? excerpt(`見通し・予定：${r.outlook}`, 500) : "",
    },
    financialAnalysis: reasons,
  };
}

export function reflectionModelInput(
  period: string,
  raw: unknown,
  financial?: FinancialSnapshot,
) {
  const reflection = validatedPublicReflection(period, raw);
  if (financial && financial.period !== period)
    throw new Error("財務Snapshotと振り返りの対象月が一致しません。");
  const metric = (value: FinancialSnapshot["revenue"]) => ({
    current: value.current,
    previous: value.previous,
    ...compareYoY(value.current, value.previous),
  });
  return {
    period,
    reflection,
    financial:
      !financial || financial.available === false
        ? null
        : {
            currency: financial.currency,
            comparison: "前年同月" as const,
            source: financial.source,
            updatedAt: financial.updatedAt,
            revenue: metric(financial.revenue),
            operatingProfit: metric(financial.operatingProfit),
            ordinaryProfit: metric(financial.ordinaryProfit),
            cash: metric(financial.cash),
          },
  };
}
