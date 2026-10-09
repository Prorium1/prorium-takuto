import Link from "next/link";
import {
  buildFreeeImportPlan,
  novemberFiscalStart,
} from "@/lib/domain/freee-plan";
import { periodLabel } from "@/lib/domain/finance";
import type { ReportVersion } from "@/lib/domain/types";

export function FreeeImportPlan({
  reports,
  mock,
}: {
  reports: ReportVersion[];
  mock: boolean;
}) {
  const now = new Date();
  const plan = buildFreeeImportPlan(novemberFiscalStart(now), now);
  return (
    <section className="admin-panel freee-plan">
      <div className="panel-heading">
        <h2>今期の取り込み準備</h2>
        <span className="badge badge-neutral">freee 自動取込は未接続</span>
      </div>
      <p className="admin-info">
        11月始まりの今期を月ごとに整理します。前年同月のデータも合わせて取り込み、振り返りと紐づけます。月途中の数値は参考値とし、締め確認・承認が済んだ月から公開します。
        {mock &&
          "この画面はMock環境です。実データを取り込む機能は有効になっていません。"}
      </p>
      <details className="import-plan-details" open>
        <summary>
          {periodLabel(plan[0].period)} — {periodLabel(plan.at(-1)!.period)} ·{" "}
          {plan.length}か月
        </summary>
        <div className="table-wrap">
          <table className="data-table" aria-label="今期の取り込み対象">
            <thead>
              <tr>
                <th>対象月</th>
                <th>前年同月</th>
                <th>会計期間</th>
                <th>レポート</th>
              </tr>
            </thead>
            <tbody>
              {plan.map((month) => {
                const report =
                  reports.find(
                    (r) => r.period === month.period && r.state !== "published",
                  ) || reports.find((r) => r.period === month.period);
                return (
                  <tr key={month.period}>
                    <td>{month.period}</td>
                    <td>{month.previousPeriod}</td>
                    <td>
                      {month.status === "in-progress"
                        ? "月途中 · 参考値"
                        : "締め確認が必要"}
                    </td>
                    <td>
                      {report ? (
                        <Link href={`/admin/reports/${report.id}`}>
                          {report.state === "published"
                            ? "公開済み"
                            : "振り返りを入力"}{" "}
                          →
                        </Link>
                      ) : (
                        <span>未作成</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
      <p className="workflow-info">
        freeeの接続情報は本番サーバーで管理します。取り込みは下書き用Snapshotを作成し、公開済みの数値・文章は変更しません。
      </p>
    </section>
  );
}
