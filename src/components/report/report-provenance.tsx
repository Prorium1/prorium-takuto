import {
  Check,
  CircleDot,
  Database,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { ReportVersion } from "@/lib/domain/types";
import {
  financialProvenance,
  formatReportTimestamp,
  reportAttribution,
} from "@/lib/domain/provenance";

export function ReportProvenance({ report }: { report: ReportVersion }) {
  const data = financialProvenance(report.content.financial);
  return (
    <div className="report-provenance" aria-label="データとレポートの作成状況">
      <div className="automation-strip">
        <div>
          <Database size={15} />
          <span>
            財務データ
            <small>
              {data.status}
              {data.available && <Check size={11} />}
            </small>
          </span>
        </div>
        <div>
          <Sparkles size={15} />
          <span>
            文章・分析<small>{reportAttribution(report).label}</small>
          </span>
        </div>
        <div>
          <ShieldCheck size={15} />
          <span>
            経営者の確認
            <small>
              {report.approvedBy ? "承認済み" : "レビュー待ち"}
              {report.approvedBy && <Check size={11} />}
            </small>
          </span>
        </div>
        <div>
          <CircleDot size={15} />
          <span>
            公開日
            <small>
              {report.publishedAt
                ? new Date(report.publishedAt).toLocaleDateString("ja-JP", {
                    timeZone: "Asia/Tokyo",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  })
                : "未公開"}
            </small>
          </span>
        </div>
      </div>
      <div className="source-provenance">
        <span>
          データ元 <strong>{data.source}</strong>
        </span>
        <span>
          取得・入力日時{" "}
          {data.updatedAt ? (
            <time dateTime={data.updatedAt}>
              {formatReportTimestamp(data.updatedAt)}
            </time>
          ) : (
            "—"
          )}
        </span>
        <span className="source-sync">{data.sync}</span>
      </div>
    </div>
  );
}
