import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Database,
  Layers,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { AIKpi, ReportVersion } from "@/lib/domain/types";
import { margin, millions, periodLabel } from "@/lib/domain/finance";
import { KpiGrid } from "./kpi";
import { TrendChart } from "./trend-chart";
import { DriverBridge } from "./driver-bridge";
import { PdfButton } from "./pdf-button";
import { ReportProvenance } from "./report-provenance";
import { ExecutiveSummary } from "./executive-summary";
import { InvestorBriefing } from "./investor-briefing";
import { EventSpotlight } from "./event-spotlight";
import { DocumentList } from "@/components/document-list";
import { reportAttribution } from "@/lib/domain/provenance";

function SectionHeading({
  number,
  title,
  subtitle,
}: {
  number: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="section-heading">
      <span className="section-number">{number}</span>
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}
function AiMetric({ item }: { item: AIKpi }) {
  return (
    <div className="ai-metric">
      <span>{item.label}</span>
      <strong>
        {item.unit === "JPY"
          ? millions(item.value)
          : item.value.toLocaleString("en-US")}
        <small>
          {item.unit === "JPY"
            ? "百万円"
            : item.unit === "hours"
              ? "時間 / 月"
              : "%"}
        </small>
      </strong>
    </div>
  );
}
function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function ReportView({
  report,
  preview = false,
  print = false,
  browserPrint = false,
}: {
  report: ReportVersion;
  preview?: boolean;
  print?: boolean;
  browserPrint?: boolean;
}) {
  const c = report.content;
  const f = c.financial;
  const currentMargin = margin(f.operatingProfit.current, f.revenue.current);
  const oldMargin = margin(f.operatingProfit.previous, f.revenue.previous);
  const month = Number(report.period.slice(5));
  const year = Number(report.period.slice(0, 4));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return (
    <article className={`monthly-report ${print ? "print-report" : ""}`}>
      {preview && (
        <div className="preview-banner">
          <ShieldCheck size={16} />
          管理者プレビュー · {report.state} · 株主には公開されていません
        </div>
      )}
      <div className="report-heading">
        <div>
          <div className="report-eyebrow">
            <span className="eyebrow">MONTHLY SHAREHOLDER REPORT</span>
            <span className="report-edition">
              VOL. {String(month).padStart(2, "0")}
            </span>
          </div>
          <h1>
            <span className="report-title">Monthly Report</span>
            <span className="report-period">{periodLabel(report.period)}</span>
            <span
              className={`badge ${report.state === "published" ? "badge-green" : "badge-purple"}`}
            >
              <span className="badge-dot" />
              {report.state === "published" ? "Published" : "Preview"}
            </span>
          </h1>
          <p>
            株式会社Prorium <span>·</span> 月次株主レポート
          </p>
        </div>
        <div className="report-heading-side">
          <div className="issue-folio" aria-hidden="true">
            <span>{year} / ISSUE</span>
            <strong>{String(month).padStart(2, "0")}</strong>
          </div>
          {!preview && !print && (
            <PdfButton
              period={report.period}
              version={report.version}
              browserPrint={browserPrint}
            />
          )}
        </div>
      </div>
      <div className="report-meta">
        <span>
          {report.period.replace("-", ".")}.01 —{" "}
          {report.period.replace("-", ".")}.{lastDay}
        </span>
        <span>
          {f.available === false
            ? "月次サマリー / 添付財務資料"
            : "単月実績 / 前年同月比"}
        </span>
        <span>JPY</span>
        <span className="report-version">
          {report.version}
          <Layers size={12} />
        </span>
      </div>
      {f.available !== false ? (
        <KpiGrid financial={f} />
      ) : (
        <div className="financial-unavailable">
          <Database size={18} />
          <div>
            <strong>今月の経営アップデート</strong>
            <p>
              財務KPIは未入力です。数値は下記の添付財務資料をご確認ください。
            </p>
          </div>
          <a href="#documents">財務資料を見る →</a>
        </div>
      )}
      <ExecutiveSummary report={report} />
      <ReportProvenance report={report} />
      <nav className="report-chapter-nav" aria-label="レポートの目次">
        <span>IN THIS REPORT</span>
        <a href="#performance">財務報告</a>
        <a href="#drivers">数字が変わった理由</a>
        <a href="#business">事業報告</a>
        {c.eventSpotlight && <a href="#event">大会・イベント</a>}
        {!!c.briefing?.length && <a href="#briefing">Proriumの今</a>}
        <a href="#ai">AIの売上・効率</a>
        <a href="#risks">リスク</a>
      </nav>
      <section id="performance" className="report-section">
        <SectionHeading
          number="02"
          title="Financial Performance"
          subtitle="成長と収益性を、前年同月との比較で。"
        />
        {f.available !== false ? (
          <>
            {f.trend.length > 1 && <TrendChart financial={f} />}
            <div className="performance-note">
              <div className="margin-stat">
                <span>営業利益率</span>
                <strong>
                  {currentMargin.toFixed(1)}
                  <small>%</small>
                </strong>
                <span
                  className={
                    currentMargin >= oldMargin ? "positive" : "negative"
                  }
                >
                  {currentMargin - oldMargin >= 0 ? "+" : ""}
                  {(currentMargin - oldMargin).toFixed(1)}pt <small>YoY</small>
                </span>
              </div>
              <p>
                営業利益率は営業利益を売上高で割った値です。前年同月との収益性の変化を示しています。
              </p>
            </div>
          </>
        ) : (
          <p className="section-empty">
            財務数値は未入力です。添付の損益計算書・残高試算表をご確認ください。
          </p>
        )}
      </section>
      <section id="drivers" className="report-section">
        <SectionHeading
          number="03"
          title="Why It Changed"
          subtitle="数字の変化には、事業の理由がある。"
        />
        {c.financialAnalysis &&
          c.financialAnalysis !== "財務資料をご確認ください。" && (
            <div className="management-explanation">
              <span className="eyebrow">
                MANAGEMENT PERSPECTIVE · 経営者の説明
              </span>
              <p>{c.financialAnalysis}</p>
            </div>
          )}
        {f.available !== false ? (
          <>
            <div className="two-column">
              <DriverBridge
                title="売上変化の内訳"
                previous={f.revenue.previous}
                current={f.revenue.current}
                drivers={c.revenueDrivers}
              />
              <DriverBridge
                title="営業利益変化の内訳"
                previous={f.operatingProfit.previous}
                current={f.operatingProfit.current}
                drivers={c.profitDrivers}
              />
            </div>
          </>
        ) : (
          <p className="section-empty">
            今月の変化とその理由は、上記サマリーと事業ハイライトをご確認ください。
          </p>
        )}
      </section>
      <section id="business" className="report-section">
        <SectionHeading
          number="04"
          title="Business Highlights"
          subtitle="成長の現場から。今月の事業トピックス。"
        />
        {!c.highlights.length && (
          <p className="section-empty">
            今月の事業の進捗はサマリーをご確認ください。
          </p>
        )}
        <div className="business-grid">
          {c.highlights.map((h, i) => (
            <article className="business-card" key={h.id}>
              <span className="business-index" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="business-unit">{h.business_unit}</span>
              <h3>{h.title}</h3>
              <div className="business-metric">
                <strong>{h.metric_value}</strong>
                <span>{h.metric}</span>
              </div>
              <p>{h.description}</p>
              <div className="business-card-bottom">
                <span>
                  <i />
                  {h.status}
                </span>
                <small>{h.period.replace("-", ".")}</small>
              </div>
            </article>
          ))}
        </div>
      </section>
      <InvestorBriefing stories={c.briefing ?? []} />
      {c.eventSpotlight && (
        <EventSpotlight
          event={c.eventSpotlight}
          period={report.period}
          print={print}
        />
      )}
      <section id="ai" className="report-section">
        <SectionHeading
          number="05"
          title="AI Transformation"
          subtitle="AIを販売する。そして、AIで経営する。"
        />
        {c.ai.revenue.length > 0 && c.ai.efficiency.length > 0 ? (
          <>
            <div className="ai-heading-note">
              <Sparkles size={18} />
              <p>{c.ai.narrative}</p>
              <span>PRORIUM, AI NATIVE.</span>
            </div>
            <div className="two-column">
              <article className="ai-impact-card">
                <div className="ai-impact-title">
                  <span className="ai-impact-icon">
                    <TrendingUp size={19} />
                  </span>
                  <div>
                    <span className="eyebrow">AI AS REVENUE</span>
                    <h3>新しい売上をつくる。</h3>
                  </div>
                  <ArrowUpRight size={19} />
                </div>
                <div className="ai-featured">
                  <AiMetric item={c.ai.revenue[0]} />
                  <span className="badge badge-purple">Actual</span>
                </div>
                <div className="ai-small-metrics">
                  {c.ai.revenue.slice(1).map((item) => (
                    <AiMetric key={item.key} item={item} />
                  ))}
                </div>
                <div className="ai-tags">
                  {["SHIMEI.AI", "SBA", "AI Products", "Video AI"].map((v) => (
                    <span key={v}>{v}</span>
                  ))}
                </div>
                <p className="ai-card-note">{c.ai.revenue[0].description}</p>
              </article>
              <article className="ai-impact-card">
                <div className="ai-impact-title">
                  <span className="ai-impact-icon">
                    <Zap size={19} />
                  </span>
                  <div>
                    <span className="eyebrow">AI AS EFFICIENCY</span>
                    <h3>利益を生む仕組みをつくる。</h3>
                  </div>
                  <ArrowUpRight size={19} />
                </div>
                <div className="ai-featured">
                  <AiMetric item={c.ai.efficiency[0]} />
                  <span className="badge badge-neutral">推定効果</span>
                </div>
                <div className="ai-small-metrics">
                  {c.ai.efficiency.slice(1).map((item) => (
                    <AiMetric key={item.key} item={item} />
                  ))}
                </div>
                <div className="automation-uses">
                  {[
                    "Video Editing",
                    "Marketing",
                    "Content",
                    "Internal Workflow",
                  ].map((v) => (
                    <span key={v}>
                      <CheckCircle2 size={13} />
                      {v}
                    </span>
                  ))}
                </div>
                <p className="ai-card-note">{c.ai.efficiency[0].description}</p>
              </article>
            </div>
            <p className="footnote">
              {c.ai.attributionNote} 自動化率は対象業務の処理件数ベース。
            </p>
          </>
        ) : (
          <p className="section-empty">
            当月のAI売上・業務効率化の定量指標は未掲載です。確認済みの指標を順次追加します。
          </p>
        )}
      </section>
      <section id="position" className="report-section">
        <SectionHeading
          number="06"
          title="Financial Position"
          subtitle="成長を支える、財務の安定性。"
        />
        {f.available !== false ? (
          <>
            <div className="position-grid">
              <article className="position-main">
                <span className="eyebrow">CASH & RESILIENCE</span>
                <h3>次の投資へ、着実な余力。</h3>
                <div>
                  <strong>
                    {millions(f.cash.current)}
                    <span>百万円</span>
                  </strong>
                  <span className="badge badge-green">月末現預金</span>
                </div>
                <p>
                  月次固定費 {millions(f.monthlyFixedCosts)} 百万円に対し、
                  <b>
                    {f.monthlyFixedCosts > 0
                      ? (f.cash.current / f.monthlyFixedCosts).toFixed(1)
                      : "—"}
                    か月分
                  </b>
                  の現預金。将来の資金繰りを保証する値ではなく、現在の固定費との単純比較です。
                </p>
              </article>
              <article className="balance-card">
                <div>
                  <span>総資産</span>
                  <strong>
                    {millions(f.assets)}
                    <small>百万円</small>
                  </strong>
                </div>
                <div>
                  <span>負債</span>
                  <strong>
                    {millions(f.liabilities)}
                    <small>百万円</small>
                  </strong>
                </div>
                <div>
                  <span>純資産</span>
                  <strong>
                    {millions(f.equity)}
                    <small>百万円</small>
                  </strong>
                </div>
                <div className="equity-ratio">
                  <span>自己資本比率</span>
                  <strong>
                    {f.assets > 0
                      ? ((f.equity / f.assets) * 100).toFixed(1)
                      : "—"}
                    <small>%</small>
                  </strong>
                </div>
              </article>
            </div>
          </>
        ) : (
          <p className="section-empty">
            財務状態は、添付の貸借対照表・残高試算表をご確認ください。
          </p>
        )}
      </section>
      <section id="forward" className="report-section">
        <SectionHeading
          number="07"
          title="Forward Indicators"
          subtitle="実績と、これからの可能性を分けて見る。"
        />
        <div className="forward-legend">
          <span>
            <i className="kind-actual" />
            Actual <small>計上済み</small>
          </span>
          <span>
            <i className="kind-committed" />
            Committed <small>契約済み</small>
          </span>
          <span>
            <i className="kind-forecast" />
            Forecast <small>見込み</small>
          </span>
          <span>
            <i className="kind-pipeline" />
            Pipeline <small>商談中</small>
          </span>
        </div>
        {!c.forward.length && (
          <p className="section-empty">当月の将来指標は未掲載です。</p>
        )}
        <div className="forward-grid">
          {c.forward.map((item) => (
            <article className="forward-card" key={item.id}>
              <span
                className={`indicator-kind kind-${item.kind.toLowerCase()}`}
              >
                {item.kind}
              </span>
              <h3>{item.title}</h3>
              <strong>{item.value}</strong>
              <p>{item.description}</p>
              <span className="forward-timing">{item.timing}</span>
            </article>
          ))}
        </div>
        <p className="footnote">
          Committed・Forecast・Pipelineは将来情報です。未計上の金額・件数を当月の財務実績に合算していません。
        </p>
      </section>
      <section id="risks" className="report-section">
        <SectionHeading
          number="08"
          title="Risks & Actions"
          subtitle="リスクを認識し、具体的な行動で向き合う。"
        />
        {!c.risks.length && (
          <p className="section-empty">
            個別のリスク・対応策は当月のサマリーをご確認ください。
          </p>
        )}
        <div className="risk-list">
          {c.risks.map((risk, i) => (
            <article className="risk-card" key={risk.id}>
              <div className="risk-description">
                <span className="risk-index">0{i + 1}</span>
                <div>
                  <div className="risk-title">
                    <h3>{risk.title}</h3>
                    <span
                      className={`badge ${risk.impact === "高" ? "badge-orange" : "badge-neutral"}`}
                    >
                      影響度：{risk.impact}
                    </span>
                  </div>
                  <p>{risk.description}</p>
                </div>
              </div>
              <div className="risk-action">
                <span className="eyebrow">ACTION</span>
                <p>{risk.action}</p>
                <span>
                  {risk.owner}
                  <span>·</span>
                  {risk.due}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section id="ceo" className="report-section">
        <SectionHeading
          number="09"
          title="CEO Commentary"
          subtitle="株主の皆さまへ。"
        />
        <div className="ceo-card">
          <span className="ceo-quote-mark" aria-hidden="true">
            “
          </span>
          <div className="ceo-content">
            <h3>{c.ceo.quote}</h3>
            <p>{c.ceo.message}</p>
            <div className="ceo-signature">
              <div>
                <strong>{c.ceo.name}</strong>
                <span>{c.ceo.title}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section id="documents" className="financial-documents-section">
        <SectionHeading
          number="+"
          title="Financial Documents"
          subtitle="月ごとの財務資料を、必要なときに。"
        />
        {c.documents?.length ? (
          <DocumentList documents={c.documents} print={print} />
        ) : (
          <p className="section-empty">
            当月の財務PDFはまだ添付されていません。
          </p>
        )}
      </section>
      <div className="report-colophon">
        <div>
          <Database size={13} />
          <span>
            Data source:{" "}
            {f.isMock
              ? "Synthetic freee fixture"
              : f.source === "not-entered"
                ? "Management update"
                : f.source}{" "}
            · 更新 {formatDate(f.updatedAt)} · {report.version}
          </span>
        </div>
        <p>
          {f.isMock
            ? "このレポートは開発用Mockです。数値、事業状況、AI効果、経営コメントはすべてサンプルであり、株式会社Proriumの実際の経営情報ではありません。"
            : "このレポートは経営確認済みの公開時点の情報です。将来情報は見込みを含み、実際の結果を保証するものではありません。財務資料の対象期間・単月／累計も併せてご確認ください。"}
        </p>
        <div>
          <span>{reportAttribution(report).statement}</span>
          <span>
            PRORIUM MONTHLY SHAREHOLDER REPORT
            <ArrowRight size={12} />
          </span>
        </div>
      </div>
    </article>
  );
}
