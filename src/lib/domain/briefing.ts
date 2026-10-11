import type { BriefingTopic } from "./types";

export const briefingTopics: {
  key: BriefingTopic;
  label: string;
  eyebrow: string;
  prompt: string;
}[] = [
  {
    key: "development",
    label: "開発状況",
    eyebrow: "PRODUCT & ENGINEERING",
    prompt: "何を公開・改善し、利用者にどんな変化がありましたか。",
  },
  {
    key: "people",
    label: "組織・採用",
    eyebrow: "TEAM",
    prompt: "採用・組織体制にどんな変化がありましたか。",
  },
  {
    key: "funding",
    label: "資金調達",
    eyebrow: "CAPITAL",
    prompt: "調達の実績・進行状況を分類して記載してください。",
  },
  {
    key: "pr",
    label: "PR・告知",
    eyebrow: "IN THE SPOTLIGHT",
    prompt: "発表したニュースと、その事業上の意味は何ですか。",
  },
  {
    key: "market",
    label: "競合・市場",
    eyebrow: "MARKET INTELLIGENCE",
    prompt: "市場・競合の変化と、自社への影響は何ですか。",
  },
  {
    key: "services",
    label: "自社サービスの詳細",
    eyebrow: "THE PORTFOLIO",
    prompt: "誰に何を提供し、どの指標を追っていますか。",
  },
  {
    key: "customers",
    label: "ユーザー・講師",
    eyebrow: "PEOPLE BEHIND THE NUMBERS",
    prompt:
      "利用者や講師から何が分かりましたか。個人情報は含めないでください。",
  },
  {
    key: "asks",
    label: "株主にお願いしたいこと",
    eyebrow: "INVESTOR ACTION",
    prompt: "紹介・助言など、株主にお願いしたい具体的な行動は何ですか。",
  },
  {
    key: "other",
    label: "その他",
    eyebrow: "ADDITIONAL NOTES",
    prompt: "上記に入らない重要な経営情報を記載してください。",
  },
];
