import Link from "next/link";
import type { FiscalPublication } from "@/lib/domain/fiscal-publication";
import { fiscalVersionLabel } from "@/lib/domain/fiscal-publication";
import { PdfButton } from "./pdf-button";
import { fiscalSummary } from "@/lib/domain/fiscal";
import { yen } from "@/lib/domain/finance";
export function PublishedFiscalCard({
  report: r,
  browserPrint = false,
  showMetrics = false,
}: {
  report: FiscalPublication;
  browserPrint?: boolean;
  showMetrics?: boolean;
}) {
  if (r.state !== "published") return null;
  const path = `/fiscal/${r.year}?version=${r.version}`;
  const actual = fiscalSummary(r.content.source).actual,
    latest = r.content.source.months.at(-1)!;
  return (
    <section className="fiscal-portal-card">
      <div>
        <span className="eyebrow">
          ANNUAL INVESTOR REPORT · {fiscalVersionLabel(r.version)}
        </span>
        <h2>{r.year}年10月期 事業・経営報告</h2>
        <p>
          {!showMetrics && (
            <>
              期全体の業績、事業の進捗、組織体制と今後の方針。
              <br />
            </>
          )}
          会計実績：{r.content.source.months.at(-1)?.period}まで · 資料基準日：
          {r.content.source.asOf}
        </p>
      </div>
      <div className="fiscal-card-actions">
        <Link className="button primary" href={path}>
          年次レポートを読む →
        </Link>
        {browserPrint ? (
          <Link className="button secondary" href={path}>
            レポートを開いてPDF保存
          </Link>
        ) : (
          <PdfButton
            period={`${r.year}-10`}
            version={fiscalVersionLabel(r.version)}
            endpoint={`/api/fiscal/${r.year}/pdf?version=${r.version}`}
            filename={`Prorium-FY${r.year}-${fiscalVersionLabel(r.version)}.pdf`}
          />
        )}
      </div>
      {showMetrics && (
        <div className="fiscal-portal-metrics">
          <p className="fiscal-portal-basis">
            期首〜{latest.period}の会計実績 · 未締め月を含む
          </p>
          <div className="kpi-grid">
            {(
              [
                ["売上高 · 累計", actual.revenue],
                ["営業利益 · 累計", actual.operatingProfit],
                ["経常利益 · 累計", actual.ordinaryProfit],
                [
                  `現預金 · ${Number(latest.period.slice(5))}月末`,
                  latest.bsTotals.cash,
                ],
              ] as const
            ).map(([label, value]) => (
              <article className="kpi-card" key={label}>
                <span className="kpi-label">{label}</span>
                <strong className="kpi-value">
                  {value === null ? "未取得" : yen(value)}
                </strong>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
