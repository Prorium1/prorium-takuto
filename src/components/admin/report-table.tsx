import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ReportVersion } from "@/lib/domain/types";
import { periodLabel } from "@/lib/domain/finance";

const labels = {
  draft: "Draft",
  review: "Human Review",
  approved: "Approved",
  published: "Published",
};
export function ReportTable({ reports }: { reports: ReportVersion[] }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>REPORT</th>
            <th>VERSION</th>
            <th>STATUS</th>
            <th>ANALYSIS</th>
            <th>DATA SOURCE</th>
            <th />
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
              <td>
                <span
                  className={`badge ${r.state === "published" ? "badge-green" : r.state === "draft" ? "badge-neutral" : "badge-purple"}`}
                >
                  {r.contextRequired ? "経営者の説明待ち" : labels[r.state]}
                </span>
              </td>
              <td>
                {r.analysis === "not-generated"
                  ? "未生成"
                  : r.analysis === "generated-mock"
                    ? "Mock AI Draft"
                    : r.analysis === "generated-ai"
                      ? r.state === "published"
                        ? "AI assisted · Approved"
                        : "AI Draft · レビュー待ち"
                      : r.analysis === "human-authored"
                        ? "管理者作成"
                        : "Human reviewed"}
              </td>
              <td>
                {r.content.financial.isMock
                  ? "Mock snapshot"
                  : r.content.financial.available === false
                    ? "財務数値未入力"
                    : r.content.financial.source === "freee"
                      ? "freee snapshot"
                      : "管理者確認のSnapshot"}
              </td>
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
  );
}
