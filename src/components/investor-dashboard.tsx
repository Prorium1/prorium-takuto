import Link from "next/link";
import { ArrowRight, FileText, ShieldCheck } from "lucide-react";
import type { ReportVersion } from "@/lib/domain/types";
import { periodLabel } from "@/lib/domain/finance";
import {
  financialBasis,
  financialProvenance,
  formatReportTimestamp,
} from "@/lib/domain/provenance";
import { KpiGrid } from "./report/kpi";
import { PdfButton } from "./report/pdf-button";
import { latestOwnershipReport } from "@/lib/domain/ownership";

export function InvestorDashboard({
  reports,
  browserPrint = false,
}: {
  reports: ReportVersion[];
  browserPrint?: boolean;
}) {
  // Defence in depth: even an admin must see only published snapshots here.
  const published = reports
    .filter((r) => r.state === "published")
    .sort(
      (a, b) =>
        b.period.localeCompare(a.period) ||
        b.createdAt.localeCompare(a.createdAt),
    );
  const months = published.filter(
    (r, i) => published.findIndex((x) => x.period === r.period) === i,
  );
  const latest = months[0];
  const path = latest
    ? `/reports/${latest.period}?version=${encodeURIComponent(latest.version)}`
    : "/reports";
  const source = latest ? financialProvenance(latest.content.financial) : null;
  const requests =
    latest?.content.briefing?.filter((item) => item.topic === "asks") || [];
  const ownership = latestOwnershipReport(published)?.content.ownership;
  return (
    <div className="investor-dashboard">
      <header className="investor-dashboard-heading">
        <div>
          <span className="eyebrow">PRORIUM / INVESTOR UPDATE</span>
          <h1>株主ポータル</h1>
          <p>今月の報告、財務資料、株主構成を確認できます。</p>
        </div>
        <span className="investor-audience">
          <ShieldCheck size={14} /> 承認・公開済みの情報
        </span>
      </header>
      <nav className="portal-entries" aria-label="株主向けの3つの情報">
        <Link
          href={latest ? path : "/reports"}
          className="portal-entry portal-entry-main"
        >
          <span className="portal-entry-number">01</span>
          <h2>月次レポート</h2>
          <p>業績と変化の理由、事業の進捗、今後の見通し。</p>
          <strong>
            {latest
              ? `${periodLabel(latest.period)} · 公開済み`
              : "まだ公開されていません"}
          </strong>
          <span>
            {latest ? "今月の報告を読む" : "レポートの公開状況を見る"}{" "}
            <ArrowRight size={14} />
          </span>
        </Link>
        <Link href="/documents" className="portal-entry">
          <span className="portal-entry-number">02</span>
          <h2>財務資料・PDF</h2>
          <p>月次のPL・BS・試算表と、ダウンロード資料。</p>
          <strong>
            {published.some((r) => (r.content.documents || []).length > 0)
              ? "公開済みの財務資料があります"
              : "財務資料の公開準備中"}
          </strong>
          <span>
            資料を確認する <ArrowRight size={14} />
          </span>
        </Link>
        <Link href="/shareholders" className="portal-entry">
          <span className="portal-entry-number">03</span>
          <h2>株主構成</h2>
          <p>基準日と発行済株式数、確認済みの保有比率。</p>
          <strong>
            {ownership
              ? `${ownership.asOf} 時点 · 公開済み`
              : "株主構成はまだ公開されていません"}
          </strong>
          <span>
            株主構成を確認する <ArrowRight size={14} />
          </span>
        </Link>
      </nav>
      {!latest ? (
        <section className="empty-state">
          <h2>月次レポートはまだ公開されていません。</h2>
          <p>
            経営者が内容を確認・承認したレポートと財務資料が、ここに表示されます。
          </p>
          <p>
            公開後、このページから対象月のレポート・数値の根拠・添付資料を確認できます。
          </p>
        </section>
      ) : (
        <>
          <section
            className="investor-latest"
            aria-labelledby="investor-latest-title"
          >
            <div className="investor-latest-top">
              <div>
                <span className="eyebrow">
                  LATEST REPORT · {latest.version}
                </span>
                <h2 id="investor-latest-title">{periodLabel(latest.period)}</h2>
              </div>
              <div className="investor-dashboard-actions">
                <Link className="button primary" href={path}>
                  今月のレポートを読む <ArrowRight size={16} />
                </Link>
                {browserPrint ? (
                  <Link className="button" href={`${path}#summary`}>
                    レポートを開いてPDF保存
                  </Link>
                ) : (
                  <PdfButton period={latest.period} version={latest.version} />
                )}
              </div>
            </div>
            {source?.available ? (
              <>
                <KpiGrid financial={latest.content.financial} />
                <p className="investor-basis-line">
                  {financialBasis(latest.content.financial).label} ·
                  現預金は月末残高 · {source.source}
                  {source.updatedAt
                    ? ` · ${formatReportTimestamp(source.updatedAt)}取得・入力`
                    : ""}
                </p>
              </>
            ) : (
              <p className="investor-basis-line">
                財務KPIは未入力です。掲載済みの財務資料をご確認ください。
              </p>
            )}
            <details className="portal-report-summary">
              <summary>今月の要点・見通し・株主へのお願いを読む</summary>
              <div className="investor-overview">
                <div>
                  <span className="eyebrow">今月の要点</span>
                  <h3>{latest.content.summary.headline}</h3>
                  <p>
                    {latest.content.summary.text ||
                      "詳細は今月のレポートをご確認ください。"}
                  </p>
                  {latest.content.summary.points.length > 0 && (
                    <ul>
                      {latest.content.summary.points.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  )}
                  <div className="investor-outlook">
                    <h4>今後の見通し</h4>
                    <p>
                      {latest.content.summary.outlook ||
                        "見通しは掲載されていません。"}
                    </p>
                    <h4>リスクと対応</h4>
                    {latest.content.risks[0] ? (
                      <p>
                        <strong>{latest.content.risks[0].title}</strong>：
                        {latest.content.risks[0].action}
                      </p>
                    ) : (
                      <p>
                        リスクは未掲載です。リスクがないことを意味しません。
                      </p>
                    )}
                    <Link href={`${path}#risks`}>
                      リスク・対応の全項目を見る →
                    </Link>
                  </div>
                </div>
                <aside>
                  <span className="eyebrow">株主の皆さまへ</span>
                  <h3>お願いしたいこと</h3>
                  {requests.length ? (
                    requests.map((r, i) => (
                      <div key={i}>
                        <h4>{r.title}</h4>
                        <p>{r.body}</p>
                      </div>
                    ))
                  ) : (
                    <p>今月のお願いは掲載されていません。</p>
                  )}
                  <Link href={`${path}#briefing`}>
                    事業・開発・採用の報告を見る →
                  </Link>
                </aside>
              </div>
            </details>
          </section>
          <nav className="investor-shortcuts" aria-label="知りたいことから読む">
            {[
              ["drivers", "数字が変わった理由", "売上と利益の増減、その背景。"],
              ["forward", "見通しとリスク", "実績・確定・予測を分けて確認。"],
              ["documents", "財務資料・PDF", "PL・BS・試算表などの掲載資料。"],
            ].map(([id, title, note]) => (
              <Link key={id} href={`${path}#${id}`}>
                <span>
                  <strong>{title}</strong>
                  <small>{note}</small>
                </span>
                <ArrowRight size={16} />
              </Link>
            ))}
          </nav>
          <section className="investor-recent">
            <div>
              <h2>これまでの月次レポート</h2>
              <Link href="/reports">すべての月を見る →</Link>
            </div>
            <nav aria-label="公開レポートの対象月">
              {months.slice(0, 4).map((r) => (
                <Link
                  href={`/reports/${r.period}?version=${encodeURIComponent(r.version)}`}
                  key={r.id}
                >
                  <FileText size={14} />
                  {periodLabel(r.period)}
                  <span>{r.version}</span>
                </Link>
              ))}
            </nav>
          </section>
        </>
      )}
      <p className="investor-snapshot-note">
        <ShieldCheck size={14} />{" "}
        公開時点の記録です。後日の会計変更では自動更新されません。
      </p>
    </div>
  );
}
