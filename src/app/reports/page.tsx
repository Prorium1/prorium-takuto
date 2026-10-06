import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
} from "lucide-react";
import { Shell } from "@/components/shell";
import { requireActor } from "@/lib/server/auth";
import { listPublishedReports } from "@/lib/server/repository";
import {
  compareYoY,
  millions,
  percent,
  periodLabel,
} from "@/lib/domain/finance";

export const dynamic = "force-dynamic";
export default async function ArchivePage() {
  const actor = await requireActor();
  const all = await listPublishedReports(actor);
  const reports = all.filter(
    (r, i, arr) => arr.findIndex((v) => v.period === r.period) === i,
  );
  return (
    <Shell role={actor.role}>
      <div className="page-heading">
        <span className="eyebrow">THE PRORIUM JOURNEY</span>
        <h1>Report Archive</h1>
        <p>毎月の変化を、積み重ねて。</p>
      </div>
      <div className="archive-heading">
        <span>Published archive</span>
        <span>{reports.length} reports · 公開済みのみ</span>
      </div>
      {!reports.length && (
        <div className="empty-state">
          <h2>最初の月次レポートを準備しています。</h2>
          <p>公開されたレポートと財務資料を、毎月こちらでご覧いただけます。</p>
        </div>
      )}
      <div className="archive-grid">
        {reports.map((report, i) => {
          const yoy = compareYoY(
            report.content.financial.revenue.current,
            report.content.financial.revenue.previous,
          );
          return (
            <Link
              className="archive-card"
              href={`/reports/${report.period}`}
              key={report.id}
            >
              <div className="archive-top">
                <span className="archive-icon">
                  <FileText size={21} />
                </span>
                <span
                  className={`badge ${i === 0 ? "badge-purple" : "badge-neutral"}`}
                >
                  {i === 0 ? "Latest report" : report.version}
                </span>
              </div>
              <span className="eyebrow">MONTHLY SHAREHOLDER REPORT</span>
              <h2>{periodLabel(report.period)}</h2>
              <p>{report.content.summary.headline}</p>
              {report.content.financial.available !== false ? (
                <div className="archive-metrics">
                  <div>
                    <span>売上高</span>
                    <strong>
                      {millions(report.content.financial.revenue.current)}
                      <small>百万円</small>
                    </strong>
                  </div>
                  <span className={yoy.delta < 0 ? "negative" : "positive"}>
                    {yoy.percent !== null &&
                      (yoy.delta < 0 ? (
                        <ArrowDownRight size={15} />
                      ) : (
                        <ArrowUpRight size={15} />
                      ))}
                    {percent(yoy.percent)}
                  </span>
                </div>
              ) : (
                <p className="footnote">
                  今月のサマリー · 財務PDF{" "}
                  {(report.content.documents || []).length}件
                </p>
              )}
              <div className="archive-bottom">
                <span>レポートを読む</span>
                <ArrowRight size={17} />
              </div>
            </Link>
          );
        })}
      </div>
      <div className="archive-note">
        <ShieldIcon />
        各レポートは公開時点のSnapshotです。後日の会計データ変更で更新されることはありません。
      </div>
    </Shell>
  );
}
function ShieldIcon() {
  return <FileText size={16} />;
}
