export type Role = "investor" | "admin";
export type Actor = {
  id: string;
  role: Role;
  companyId: string;
  needsMfa?: boolean;
};
export type ReportState = "draft" | "review" | "approved" | "published";
export type IndicatorKind = "Actual" | "Committed" | "Forecast" | "Pipeline";
export type Metric = { current: number; previous: number; status: string };
export type TrendPoint = {
  month: string;
  revenue: number;
  previousRevenue: number;
  profit: number;
  previousProfit: number;
};
export type FinancialSnapshot = {
  id: string;
  period: string;
  currency: "JPY";
  isMock: boolean;
  available?: boolean;
  source:
    "synthetic-freee-fixture" | "management-entry" | "not-entered" | "freee";
  updatedAt: string;
  revenue: Metric;
  operatingProfit: Metric;
  ordinaryProfit: Metric;
  cash: Metric;
  trend: TrendPoint[];
  assets: number;
  liabilities: number;
  equity: number;
  monthlyFixedCosts: number;
};
export type Driver = { label: string; amount: number; description: string };
export type BusinessHighlight = {
  id: string;
  title: string;
  business_unit: string;
  metric: string;
  metric_value: string;
  description: string;
  status: string;
  period: string;
};
export type BriefingTopic =
  | "development"
  | "people"
  | "funding"
  | "pr"
  | "other"
  | "asks"
  | "market"
  | "services"
  | "customers";
export type BriefingStory = {
  id: string;
  topic: BriefingTopic;
  kind: IndicatorKind;
  title: string;
  body: string;
};
export type ForwardIndicator = {
  id: string;
  kind: IndicatorKind;
  title: string;
  value: string;
  description: string;
  timing: string;
};
export type Risk = {
  id: string;
  title: string;
  impact: "高" | "中" | "低";
  description: string;
  action: string;
  owner: string;
  due: string;
};
export type AIKpi = {
  key: string;
  label: string;
  value: number;
  unit: "JPY" | "%" | "hours";
  description: string;
};
export type ReportContent = {
  eventSpotlight?: {
    title: string;
    occurredOn: string;
    summary: string;
    outcomes: string[];
    nextAction: string;
    videoUrl: string;
    videoTitle: string;
  } | null;
  documents?: FinancialDocument[];
  financial: FinancialSnapshot;
  summary: {
    headline: string;
    text: string;
    points: string[];
    outlook: string;
  };
  financialAnalysis: string;
  revenueDrivers: Driver[];
  profitDrivers: Driver[];
  highlights: BusinessHighlight[];
  briefing?: BriefingStory[];
  ai: {
    revenue: AIKpi[];
    efficiency: AIKpi[];
    narrative: string;
    attributionNote: string;
  };
  forward: ForwardIndicator[];
  risks: Risk[];
  ceo: { quote: string; message: string; name: string; title: string };
};
export type ReportVersion = {
  id: string;
  companyId: string;
  period: string;
  version: string;
  state: ReportState;
  revision: number;
  contextRequired?: boolean;
  content: ReportContent;
  contentHash: string;
  analysis:
    | "reviewed-mock"
    | "generated-mock"
    | "not-generated"
    | "human-authored"
    | "generated-ai"
    | "reviewed";
  approvedHash: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
};
export type AuditEvent = {
  id: string;
  at: string;
  actorId: string;
  action: string;
  reportId: string | null;
  detail: string;
};
export type ImportJob = {
  id: string;
  period: string;
  snapshotId: string;
  source: string;
  status: "validated";
  at: string;
  isMock: boolean;
};
export type AnalysisDraft = {
  summary: ReportContent["summary"];
  financialAnalysis: string;
  whyItChanged: string[];
  positiveFactors: string[];
  negativeFactors: string[];
  riskDraft: string[];
  forwardDraft: string[];
};
export type AnalysisRun = {
  id: string;
  reportId: string;
  at: string;
  snapshotId: string;
  provider: "mock" | "openai" | "editorial";
  output: AnalysisDraft;
};
export type MockStore = {
  reports: ReportVersion[];
  snapshots: FinancialSnapshot[];
  imports: ImportJob[];
  audit: AuditEvent[];
  analyses: AnalysisRun[];
  monthlyInputs?: MonthlyInput[];
  documents?: StoredDocument[];
};
export type MonthlyInput = {
  reportId: string;
  notes: string;
  updatedAt: string;
};
export type DocumentCategory =
  "pl" | "bs" | "trial-balance" | "cash-flow" | "other";
export type FinancialDocument = {
  id: string;
  title: string;
  category: DocumentCategory;
  period: string;
  basis: "monthly" | "ytd" | "year-end" | "other";
  description: string;
  fileName: string;
  bytes: number;
  checksum: string;
  uploadedAt: string;
};
export type StoredDocument = FinancialDocument & {
  companyId: string;
  versionId: string;
  storagePath: string;
  status: "pending" | "ready" | "removed";
};
export type WorkflowOperation =
  "edit" | "generate" | "import" | "review" | "approve" | "publish";
