import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ReportVersion } from "@/lib/domain/types";
import { periodLabel } from "@/lib/domain/finance";
import styles from "./report-table.module.css";

const labels = {
  draft: "下書き",
  review: "レビュー待ち",
  approved: "承認済み",
  published: "公開済み",
};
function analysisLabel(report: ReportVersion) {
  switch (report.analysis) {
    case "not-generated":
      return "未生成";
    case "generated-mock":
      return "Mock AI下書き";
    case "generated-ai":
      return report.state === "published"
        ? "AI分析・承認済み"
        : "AI下書き・確認待ち";
    case "human-authored":
      return "管理者作成";
    default:
      return "レビュー済み";
  }
}
function sourceLabel(report: ReportVersion) {
  const financial = report.content.financial;
  if (financial.isMock) return "Mockデータ";
  if (financial.available === false) return "財務数値未入力";
  return financial.source === "freee"
    ? "freee・取込時点の数値"
    : "管理者確認の数値";
}
function statusBadge(report: ReportVersion) {
  return (
    <span
      className={`badge ${report.state === "published" ? "badge-green" : report.state === "draft" ? "badge-neutral" : "badge-purple"}`}
    >
      {report.contextRequired ? "振り返りの入力待ち" : labels[report.state]}
    </span>
  );
}
export function ReportTable({ reports }: { reports: ReportVersion[] }) {
  if (reports.length === 0)
    return (
      <p className={styles.empty}>
        レポートはまだありません。データを取り込み、最初の下書きを作成してください。
      </p>
    );
  return (
    <>
      <div className={`table-wrap ${styles.desktop}`}>
        <table className="data-table">
          <thead>
            <tr>
              <th>対象月</th>
              <th>バージョン</th>
              <th>状況</th>
              <th>分析</th>
              <th>データ元</th>
              <th>
                <span className="sr-only">操作</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/admin/reports/${r.id}`}>
                    {periodLabel(r.period)}
                  </Link>
                </td>
                <td>{r.version}</td>
                <td>{statusBadge(r)}</td>
                <td>{analysisLabel(r)}</td>
                <td>{sourceLabel(r)}</td>
                <td>
                  <Link
                    href={`/admin/reports/${r.id}`}
                    aria-label={`${periodLabel(r.period)} ${r.version}を管理`}
                  >
                    <ArrowUpRight size={15} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className={styles.mobile} aria-label="月次レポート一覧">
        {reports.map((report) => (
          <li key={report.id}>
            <Link
              className={styles.card}
              href={`/admin/reports/${report.id}`}
              aria-label={`${periodLabel(report.period)} ${report.version}を管理`}
            >
              <div className={styles.cardHeading}>
                <strong>{periodLabel(report.period)}</strong>
                <span>{report.version}</span>
              </div>
              <div className={styles.status}>{statusBadge(report)}</div>
              <dl className={styles.facts}>
                <div>
                  <dt>データ元</dt>
                  <dd>{sourceLabel(report)}</dd>
                </div>
                <div>
                  <dt>分析</dt>
                  <dd>{analysisLabel(report)}</dd>
                </div>
              </dl>
              <div className={styles.cardAction}>
                <span>
                  {report.state === "published" ? "内容を確認" : "編集する"}
                </span>
                <ArrowUpRight size={16} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
