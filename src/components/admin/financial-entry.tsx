"use client";
import { useActionState } from "react";
import { financialEntryAction } from "@/app/monthly-actions";
import type { ReportVersion } from "@/lib/domain/types";
const fields = [
  ["revenue", "売上高"],
  ["previousRevenue", "前年同月 売上高"],
  ["operatingProfit", "営業利益"],
  ["previousOperatingProfit", "前年同月 営業利益"],
  ["ordinaryProfit", "経常利益"],
  ["previousOrdinaryProfit", "前年同月 経常利益"],
  ["cash", "月末現預金"],
  ["previousCash", "前年同月 月末現預金"],
  ["assets", "総資産"],
  ["liabilities", "負債"],
  ["equity", "純資産"],
  ["monthlyFixedCosts", "月次固定費"],
] as const;
export function FinancialEntryForm({ report }: { report: ReportVersion }) {
  const [state, action, pending] = useActionState(financialEntryAction, {});
  const f = report.content.financial;
  const values = {
    revenue: f.revenue.current,
    previousRevenue: f.revenue.previous,
    operatingProfit: f.operatingProfit.current,
    previousOperatingProfit: f.operatingProfit.previous,
    ordinaryProfit: f.ordinaryProfit.current,
    previousOrdinaryProfit: f.ordinaryProfit.previous,
    cash: f.cash.current,
    previousCash: f.cash.previous,
    assets: f.assets,
    liabilities: f.liabilities,
    equity: f.equity,
    monthlyFixedCosts: f.monthlyFixedCosts,
  };
  return (
    <details className="admin-panel">
      <summary className="panel-heading">
        <h2>財務KPIを入力する</h2>
        <span>任意 · 円単位</span>
      </summary>
      <p className="admin-info">
        確認済みの当月実績と前年同月実績を入力します。資料PDFの添付と月次サマリーだけで公開することもできます。
      </p>
      <form action={action}>
        <input type="hidden" name="id" value={report.id} />
        <input type="hidden" name="revision" value={report.revision} />
        <div className="financial-entry-grid">
          {fields.map(([name, label]) => (
            <div className="form-field" key={name}>
              <label htmlFor={`financial-${name}`}>{label}（円）</label>
              <input
                id={`financial-${name}`}
                name={name}
                type="number"
                step={1}
                required
                defaultValue={f.available === false ? undefined : values[name]}
              />
            </div>
          ))}
        </div>
        <div className="form-field">
          <label htmlFor="revenueReason">売上が変わった理由</label>
          <textarea
            id="revenueReason"
            name="revenueReason"
            required
            maxLength={1000}
          />
        </div>
        <div className="form-field">
          <label htmlFor="profitReason">利益が変わった理由</label>
          <textarea
            id="profitReason"
            name="profitReason"
            required
            maxLength={1000}
          />
        </div>
        <button className="button primary" disabled={pending}>
          財務Snapshotを保存
        </button>
        {state.error && (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        )}
        {state.success && (
          <p className="form-success" role="status">
            {state.success}
          </p>
        )}
      </form>
    </details>
  );
}
