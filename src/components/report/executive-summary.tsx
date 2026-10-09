import { ArrowRight, Sparkles } from "lucide-react";
import type { ReportVersion } from "@/lib/domain/types";
import { reportAttribution } from "@/lib/domain/provenance";
import { priorityRisk } from "@/lib/domain/summary-quality";

export function ExecutiveSummary({ report }: { report: ReportVersion }) {
  const { summary, risks } = report.content;
  const risk = priorityRisk(risks);
  return (
    <section
      id="summary"
      className="report-section summary-section"
      aria-labelledby="summary-title"
    >
      <div className="executive-card">
        <div className="executive-top">
          <span className="section-kicker">
            <span>01</span>EXECUTIVE SUMMARY · 今月のサマリー
          </span>
          <span className="ai-badge">
            <Sparkles size={12} />
            {reportAttribution(report).summaryLabel}
          </span>
        </div>
        <div className="executive-content">
          <div className="executive-lead">
            <span className="summary-reading-label">
              まず、今月の結論から。
            </span>
            <h2 id="summary-title">{summary.headline}</h2>
            {summary.text.trim() ? (
              summary.text
                .split(/\n\s*\n/)
                .filter(Boolean)
                .map((paragraph, i) => <p key={i}>{paragraph}</p>)
            ) : (
              <p>サマリーは準備中です。</p>
            )}
          </div>
          <div className="executive-takeaways">
            <h3>
              今月の要点<span>KEY TAKEAWAYS</span>
            </h3>
            <ol>
              {summary.points.map((point, i) => (
                <li key={i}>
                  <span aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p>{point}</p>
                </li>
              ))}
            </ol>
            {!summary.points.length && <p>要点はまだ掲載されていません。</p>}
          </div>
        </div>
        <div className="summary-context">
          <div className="summary-next">
            <span className="summary-context-label">NEXT · 見通し・予定</span>
            <h3>次に取り組むこと</h3>
            <p>
              {summary.outlook ||
                "見通しはまだ掲載されていません。確定した情報からお知らせします。"}
            </p>
            <a href="#forward">
              確約・予測・商談の内訳
              <ArrowRight size={14} aria-hidden="true" />
            </a>
          </div>
          <div className="summary-risk">
            <span className="summary-context-label">
              WATCH · リスクと対応{risk && ` / 影響度 ${risk.impact}`}
            </span>
            <h3>{risk?.title || "注視するリスク"}</h3>
            <p>
              {risk
                ? risk.description
                : "リスク情報は未掲載です。リスクがないことを意味しません。"}
            </p>
            {risk && (
              <p className="summary-risk-action">
                <span>対応</span>
                {risk.action || "対応策は未掲載です。"}
              </p>
            )}
            <a href="#risks">
              {risks.length > 1
                ? `全${risks.length}件のリスクと対策`
                : "リスクと対策の詳細"}
              <ArrowRight size={14} aria-hidden="true" />
            </a>
          </div>
        </div>
        <nav
          className="summary-reading-nav"
          aria-label="サマリーから詳しく読む"
        >
          <span>詳しく読む</span>
          <a href="#drivers">
            なぜ変化したか
            <ArrowRight size={13} aria-hidden="true" />
          </a>
          <a href="#business">
            事業の進捗
            <ArrowRight size={13} aria-hidden="true" />
          </a>
          <a href="#ai">
            AIの売上・効率への寄与
            <ArrowRight size={13} aria-hidden="true" />
          </a>
        </nav>
      </div>
    </section>
  );
}
