import type { ReportContent } from "./types";

export const SUMMARY_TARGETS = {
  headline: 50,
  text: 400,
  point: 100,
  points: 3,
};

/** Editorial prompts, not a truth score or an approval decision. */
export function summaryReview(content: ReportContent) {
  const { summary, financial, financialAnalysis, risks, forward } = content;
  const checks: { id: string; title: string; detail: string }[] = [];
  if (!summary.headline.trim() || !summary.text.trim())
    checks.push({
      id: "message",
      title: "今月の結論をひと言で",
      detail: "経営状態と一番伝えたい変化を、見出しと本文に記入してください。",
    });
  if (
    summary.headline.length > SUMMARY_TARGETS.headline ||
    summary.text.length > SUMMARY_TARGETS.text
  )
    checks.push({
      id: "length",
      title: "冒頭を短くする",
      detail:
        "見出しは50文字、本文は400文字以内が目安です。細かな説明は「なぜ変化したか」へ。",
    });
  if (
    summary.points.length > SUMMARY_TARGETS.points ||
    summary.points.some((p) => p.length > SUMMARY_TARGETS.point)
  )
    checks.push({
      id: "points",
      title: "要点を絞る",
      detail:
        "特に伝えたい3点を、1点100文字程度にすると読み取りやすくなります。",
    });
  if (financial.available === false)
    checks.push({
      id: "financial",
      title: "数値の裏付けを確認する",
      detail:
        "財務KPIが未入力です。本文中の売上・利益・前年比を、対象月の財務資料と照合してください。",
    });
  if (
    !financialAnalysis.trim() ||
    financialAnalysis === "財務資料をご確認ください。"
  )
    checks.push({
      id: "why",
      title: "変化の理由を添える",
      detail:
        "売上と利益について、何が変わったか・なぜか・一時的か継続的かを説明してください。",
    });
  if (!risks.length || risks.some((r) => !r.action.trim()))
    checks.push({
      id: "risk",
      title: "リスクと対策を確認する",
      detail:
        "課題と対策を「Risks & Actions」に記入してください。本文に書いた内容も、この欄には自動転記されません。",
    });
  if (!summary.outlook.trim() && !forward.some((f) => f.kind !== "Actual"))
    checks.push({
      id: "outlook",
      title: "次の打ち手を添える",
      detail:
        "今後の予定や確認する指標を記入してください。確約・予測・商談の区別も確認します。",
    });
  return checks;
}

export function priorityRisk(risks: ReportContent["risks"]) {
  const rank = { 高: 0, 中: 1, 低: 2 };
  return [...risks].sort((a, b) => rank[a.impact] - rank[b.impact])[0];
}
