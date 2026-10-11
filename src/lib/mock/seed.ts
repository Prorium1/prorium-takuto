import type { MockStore, ReportContent, ReportVersion } from "../domain/types";
import { contentHash } from "../domain/workflow";
import { compareYoY, margin } from "../domain/finance";

const augustContent: ReportContent = {
  eventSpotlight: {
    title: "イベントレポート（デザインサンプル）",
    occurredOn: "2026-06-01",
    summary:
      "架空の開催例です。大会の規模だけでなく、事業上の意味、参加者の反応、次の成長につながる施策をまとめるための表示サンプルです。実際の大会情報ではありません。",
    outcomes: [
      "参加者に届けた価値を、確認済みの実績で伝える。",
      "会場で得た発見を、次のサービス改善につなげる。",
    ],
    nextAction:
      "大会資料と完成版動画を確認した後、経営者が内容を編集・承認します。",
    videoUrl: "",
    videoTitle: "",
  },
  financial: {
    id: "snapshot-2026-08-mock",
    period: "2026-08",
    currency: "JPY",
    isMock: true,
    source: "synthetic-freee-fixture",
    updatedAt: "2026-09-05T01:30:00Z",
    revenue: { current: 52_640_000, previous: 40_000_000, status: "成長継続" },
    operatingProfit: {
      current: 8_420_000,
      previous: 4_200_000,
      status: "収益性改善",
    },
    ordinaryProfit: { current: 8_080_000, previous: 3_940_000, status: "増益" },
    cash: { current: 124_800_000, previous: 96_000_000, status: "安定" },
    trend: [
      {
        month: "3月",
        revenue: 43_200_000,
        previousRevenue: 34_200_000,
        profit: 5_200_000,
        previousProfit: 3_300_000,
      },
      {
        month: "4月",
        revenue: 45_600_000,
        previousRevenue: 35_400_000,
        profit: 6_400_000,
        previousProfit: 3_400_000,
      },
      {
        month: "5月",
        revenue: 44_800_000,
        previousRevenue: 36_100_000,
        profit: 6_100_000,
        previousProfit: 3_600_000,
      },
      {
        month: "6月",
        revenue: 48_200_000,
        previousRevenue: 37_400_000,
        profit: 7_200_000,
        previousProfit: 3_800_000,
      },
      {
        month: "7月",
        revenue: 50_800_000,
        previousRevenue: 38_800_000,
        profit: 7_800_000,
        previousProfit: 4_000_000,
      },
      {
        month: "8月",
        revenue: 52_640_000,
        previousRevenue: 40_000_000,
        profit: 8_420_000,
        previousProfit: 4_200_000,
      },
    ],
    assets: 174_800_000,
    liabilities: 50_000_000,
    equity: 124_800_000,
    monthlyFixedCosts: 10_400_000,
  },
  summary: {
    headline: "成長を、利益につなげる。",
    text: "既存事業の着実な成長に、SBAとAI事業が加わり、売上高は前年同月比31.6%増。AIによる業務効率化と固定費の吸収が進み、営業利益は2倍に拡大しました。成長投資を続けながら、収益性と財務の安定性を両立しています。",
    points: [
      "売上高52.64百万円。既存事業と新規事業の双方が成長。",
      "営業利益率16.0%。前年同月から5.5pt改善。",
      "AI関連売上比率18.0%。社内自動化による効率改善も進展。",
    ],
    outlook:
      "次の成長に向けて：スクール開講準備と、AIプロダクトの継続収益化を進めます。",
  },
  financialAnalysis:
    "売上の伸びを上回る利益成長を実現。営業利益率は10.5%から16.0%へ改善しました。AIによる制作・運用コストの削減と固定費の吸収が寄与した一方、新規事業への先行投資を継続しています。",
  briefing: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      topic: "development",
      kind: "Actual",
      title: "学習体験の改善を継続",
      body: "サンプル: 月次の利用行動を確認し、受講開始までの導線を改善しました。成果は次月の継続率で検証します。",
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      topic: "market",
      kind: "Forecast",
      title: "市場の変化をどう捉えるか",
      body: "サンプル: AIを活用した制作需要の広がりを見込み、品質と納期の両立を競争上の焦点として検討しています。",
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      topic: "asks",
      kind: "Pipeline",
      title: "次の対話につながる紹介",
      body: "サンプル: 導入課題を持つ企業との対話機会をご紹介いただけると幸いです。案件化前のご相談も歓迎します。",
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      topic: "pr",
      kind: "Actual",
      title: "新しい取り組みを公開",
      body: "サンプル: 今月発表した取り組みの内容と、顧客にとっての価値を短く伝えます。実際の発表内容は管理者が入力してください。",
    },
  ],
  revenueDrivers: [
    {
      label: "既存事業",
      amount: 4_280_000,
      description: "継続顧客の取引拡大と既存サービスの安定成長。",
    },
    {
      label: "オンラインスクール",
      amount: 3_100_000,
      description: "既存講座の受講者増加と新講座の販売。",
    },
    {
      label: "SBA",
      amount: 2_460_000,
      description: "4月のローンチ以降、受講・利用が拡大。",
    },
    {
      label: "AI事業",
      amount: 1_820_000,
      description: "SHIMEI.AI、AI Products、Video AIの利用増。",
    },
    {
      label: "B2B",
      amount: 980_000,
      description: "法人向け導入支援と継続契約の増加。",
    },
  ],
  profitDrivers: [
    {
      label: "売上成長",
      amount: 3_160_000,
      description: "増収による粗利益の増加。",
    },
    {
      label: "固定費の吸収",
      amount: 1_100_000,
      description: "事業規模の拡大による固定費率の低下。",
    },
    {
      label: "AIによる効率化",
      amount: 840_000,
      description: "制作・マーケティング・社内業務の推定削減効果。",
    },
    {
      label: "成長投資",
      amount: -880_000,
      description: "新規事業開発とスクール開講に向けた先行費用。",
    },
  ],
  highlights: [
    {
      id: "sba",
      title: "SBA",
      business_unit: "EDUCATION × AI",
      metric: "サービス開始",
      metric_value: "2026.04",
      description:
        "AIを活用した学びの体験を拡充。継続的な受講者獲得とコンテンツの充実を進めています。",
      status: "Growing",
      period: "2026-08",
    },
    {
      id: "uchida",
      title: "Uchida School",
      business_unit: "ONLINE SCHOOL",
      metric: "開講準備・申込者数",
      metric_value: "230",
      description:
        "10月開講に向けて準備を進行。申込者数は将来指標であり、当月の売上には含めていません。",
      status: "October launch",
      period: "2026-08",
    },
    {
      id: "shimei",
      title: "SHIMEI.AI",
      business_unit: "AI SOFTWARE",
      metric: "事業モデル",
      metric_value: "AI SaaS",
      description:
        "利用継続率を重視しながらプロダクトを改善。法人利用と継続課金の拡大に取り組んでいます。",
      status: "Expanding",
      period: "2026-08",
    },
  ],
  ai: {
    revenue: [
      {
        key: "aiRevenue",
        label: "AI関連売上",
        value: 9_480_000,
        unit: "JPY",
        description:
          "SHIMEI.AI / SBAのAI関連部分 / AI Products / Video AI。売上の重複計上なし。",
      },
      {
        key: "aiRevenueRatio",
        label: "売上に占める割合",
        value: 18.0,
        unit: "%",
        description: "AI関連売上 ÷ 当月売上高。",
      },
      {
        key: "aiGrossMargin",
        label: "AI事業の粗利率",
        value: 72,
        unit: "%",
        description: "AI関連売上から対応する直接原価を控除。",
      },
    ],
    efficiency: [
      {
        key: "costReduction",
        label: "推定コスト削減",
        value: 840_000,
        unit: "JPY",
        description: "比較対象の業務工数と標準単価に基づく管理上の推定。",
      },
      {
        key: "hoursSaved",
        label: "創出した業務時間",
        value: 280,
        unit: "hours",
        description:
          "動画編集、マーケティング、コンテンツ、社内ワークフローの合計。",
      },
      {
        key: "automationRate",
        label: "対象業務の自動化率",
        value: 42,
        unit: "%",
        description:
          "自動化対象として定義した処理件数ベース。全社業務の割合ではありません。",
      },
    ],
    narrative: "AIを売上の源泉へ。そして、利益を生む仕組みへ。",
    attributionNote:
      "効率化効果は管理上の推定値です。会計上の利益に追加加算するものではありません。売上寄与と業務効率の指標は別々に管理しています。",
  },
  forward: [
    {
      id: "actual",
      kind: "Actual",
      title: "AI関連売上",
      value: "9.48 百万円",
      description: "8月に計上済みの売上。",
      timing: "2026年8月実績",
    },
    {
      id: "committed",
      kind: "Committed",
      title: "法人向け契約",
      value: "3 社",
      description: "締結済み。提供開始後に売上を認識。",
      timing: "2026年9–10月",
    },
    {
      id: "forecast",
      kind: "Forecast",
      title: "Uchida School",
      value: "230 名",
      description: "開講準備中の申込者。入金・受講継続を前提とする見込み。",
      timing: "2026年10月開講予定",
    },
    {
      id: "pipeline",
      kind: "Pipeline",
      title: "AI導入支援",
      value: "8 件",
      description: "商談中の案件。受注・売上は未確定。",
      timing: "2026年下期",
    },
  ],
  risks: [
    {
      id: "launch",
      title: "新規スクールの立ち上げ",
      impact: "中",
      description: "開講時期や受講継続率により、収益化の時期が変動する可能性。",
      action:
        "週次で開講準備と入金状況を確認。段階的な運営体制で固定費を管理。",
      owner: "教育事業責任者",
      due: "2026年9月",
    },
    {
      id: "ai-cost",
      title: "AIサービスの原価変動",
      impact: "中",
      description:
        "モデル利用料や処理量の増加により、AI事業の粗利率が変動する可能性。",
      action:
        "処理単価を月次監視。モデルの使い分けとキャッシュ活用で原価を最適化。",
      owner: "AI事業責任者",
      due: "継続監視",
    },
    {
      id: "capacity",
      title: "成長に伴う運営負荷",
      impact: "低",
      description: "事業拡大に伴い、品質管理と顧客対応の負荷が増加。",
      action:
        "ワークフローを標準化し、AIによる一次対応と人による確認を組み合わせる。",
      owner: "経営管理",
      due: "2026年10月",
    },
  ],
  ceo: {
    quote: "AIを、事業にも、経営にも。",
    message:
      "Proriumは、AIを届けるだけの会社ではありません。私たち自身の制作、マーケティング、業務、そして株主の皆さまへの報告にもAIを組み込み、人が価値を生む仕事に集中できる会社を目指しています。\n\n8月は、その取り組みが成長と収益性の双方に表れる月となりました。次の事業を育てる投資と、足元の利益・キャッシュの規律を両立し、持続的な企業価値の向上に取り組みます。",
    name: "Prorium 経営チーム",
    title: "CEO Commentary · サンプルコメント",
  },
};

export const augustReport: ReportVersion = {
  id: "report-2026-08-v1-0",
  companyId: "prorium",
  period: "2026-08",
  version: "v1.0",
  state: "published",
  revision: 1,
  content: augustContent,
  contentHash: contentHash(augustContent),
  analysis: "reviewed-mock",
  approvedHash: contentHash(augustContent),
  approvedBy: "demo-admin",
  approvedAt: "2026-09-07T03:00:00Z",
  publishedAt: "2026-09-08T00:00:00Z",
  createdAt: "2026-09-05T02:00:00Z",
};

export function mockReportForPeriod(period: string, factor = 1): ReportVersion {
  const r = structuredClone(augustReport);
  r.period = period;
  r.id = `report-${period}-v1-0`;
  const f = r.content.financial;
  f.id = `snapshot-${period}-mock`;
  f.period = period;
  for (const key of [
    "revenue",
    "operatingProfit",
    "ordinaryProfit",
    "cash",
  ] as const) {
    f[key].current = Math.round(f[key].current * factor);
    f[key].previous = Math.round(f[key].previous * factor);
  }
  for (const drivers of [r.content.revenueDrivers, r.content.profitDrivers])
    for (const d of drivers) d.amount = Math.round(d.amount * factor);
  for (const key of [
    "assets",
    "liabilities",
    "equity",
    "monthlyFixedCosts",
  ] as const)
    f[key] = Math.round(f[key] * factor);
  const month = Number(period.slice(5));
  const history = [
    {
      month: "1月",
      revenue: 39_800_000,
      previousRevenue: 32_000_000,
      profit: 4_800_000,
      previousProfit: 3_100_000,
    },
    {
      month: "2月",
      revenue: 41_600_000,
      previousRevenue: 33_100_000,
      profit: 5_000_000,
      previousProfit: 3_200_000,
    },
    ...augustContent.financial.trend,
    {
      month: "9月",
      revenue: 55_272_000,
      previousRevenue: 42_000_000,
      profit: 8_841_000,
      previousProfit: 4_410_000,
    },
  ];
  const actualPoint = period.startsWith("2026-")
    ? history.find((p) => p.month === `${month}月`)
    : undefined;
  if (actualPoint) {
    f.revenue.current = actualPoint.revenue;
    f.revenue.previous = actualPoint.previousRevenue;
    f.operatingProfit.current = actualPoint.profit;
    f.operatingProfit.previous = actualPoint.previousProfit;
    r.content.revenueDrivers[0].amount =
      f.revenue.current -
      f.revenue.previous -
      r.content.revenueDrivers.slice(1).reduce((s, d) => s + d.amount, 0);
    r.content.profitDrivers[0].amount =
      f.operatingProfit.current -
      f.operatingProfit.previous -
      r.content.profitDrivers.slice(1).reduce((s, d) => s + d.amount, 0);
  }
  f.trend = f.trend.map((point, i) => {
    const label = `${((month - 6 + i + 12) % 12) + 1}月`;
    const known = period.startsWith("2026-")
      ? history.find((p) => p.month === label)
      : undefined;
    return known
      ? structuredClone(known)
      : {
          ...point,
          month: label,
          revenue: Math.round(point.revenue * factor),
          previousRevenue: Math.round(point.previousRevenue * factor),
          profit: Math.round(point.profit * factor),
          previousProfit: Math.round(point.previousProfit * factor),
        };
  });
  r.content.highlights.forEach((h) => {
    h.period = period;
  });
  r.content.ai.revenue[0].value =
    Math.round((f.revenue.current * 0.18) / 1000) * 1000;
  r.content.ai.efficiency[0].value = Math.round(840_000 * factor);
  r.content.summary.points[0] = `売上高${(f.revenue.current / 1e6).toFixed(2)}百万円。既存事業と新規事業の双方が成長。`;
  const revenueGrowth = compareYoY(
    f.revenue.current,
    f.revenue.previous,
  ).percent;
  const profitGrowth = compareYoY(
    f.operatingProfit.current,
    f.operatingProfit.previous,
  ).percent;
  const profitMargin = margin(f.operatingProfit.current, f.revenue.current);
  const oldMargin = margin(f.operatingProfit.previous, f.revenue.previous);
  r.content.summary.text = `既存事業の着実な成長に、SBAとAI事業が加わり、売上高は前年同月比${revenueGrowth?.toFixed(1)}%増。AIによる業務効率化と固定費の吸収が進み、営業利益は${profitGrowth?.toFixed(1)}%増となりました。成長投資を続けながら、収益性と財務の安定性を両立しています。`;
  r.content.summary.points[1] = `営業利益率${profitMargin.toFixed(1)}%。前年同月から${(profitMargin - oldMargin).toFixed(1)}pt改善。`;
  r.content.financialAnalysis = `売上の伸びを上回る利益成長を実現。営業利益率は${oldMargin.toFixed(1)}%から${profitMargin.toFixed(1)}%へ改善しました。AIによる制作・運用コストの削減と固定費の吸収が寄与した一方、新規事業への先行投資を継続しています。`;
  r.content.forward[0].value = `${(r.content.ai.revenue[0].value / 1e6).toFixed(2)} 百万円`;
  r.content.forward[0].description = `${month}月に計上済みの売上。`;
  r.content.forward[0].timing = `${period.slice(0, 4)}年${month}月実績`;
  r.content.ceo.message = r.content.ceo.message.replace("8月", `${month}月`);
  const nextMonth = new Date(Date.UTC(Number(period.slice(0, 4)), month, 5));
  f.updatedAt = nextMonth.toISOString();
  r.createdAt = f.updatedAt;
  r.approvedAt = new Date(nextMonth.getTime() + 2 * 86_400_000).toISOString();
  r.publishedAt = new Date(nextMonth.getTime() + 3 * 86_400_000).toISOString();
  r.contentHash = contentHash(r.content);
  r.approvedHash = r.contentHash;
  return r;
}

export function initialStore(): MockStore {
  const july = mockReportForPeriod("2026-07", 0.95);
  const june = mockReportForPeriod("2026-06", 0.9);
  const september = mockReportForPeriod("2026-09", 1.05);
  september.state = "draft";
  september.publishedAt = null;
  september.approvedAt = null;
  september.approvedHash = null;
  september.approvedBy = null;
  september.analysis = "not-generated";
  const reports = [structuredClone(augustReport), july, june, september];
  return {
    reports,
    snapshots: reports.map((r) => structuredClone(r.content.financial)),
    imports: [],
    analyses: [],
    audit: [
      {
        id: "audit-seed",
        at: "2026-09-08T00:00:00Z",
        actorId: "demo-admin",
        action: "publish",
        reportId: augustReport.id,
        detail: "2026年8月 v1.0 · Mock初期公開",
      },
    ],
  };
}
