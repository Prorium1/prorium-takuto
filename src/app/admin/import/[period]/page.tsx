import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, AudioLines, CircleAlert, Database, ShieldCheck } from "lucide-react";
import { Shell } from "@/components/shell";
import { TrendChart } from "@/components/report/trend-chart";
import { FreeePromoteForm } from "@/components/admin/freee-promote-form";
import { requireAdmin } from "@/lib/server/auth";
import { productionClient, databaseError } from "@/lib/server/production-repository";
import { isMockEnvironment } from "@/lib/server/environment";
import { periodSchema } from "@/lib/domain/validation";
import { periodLabel, millions, margin } from "@/lib/domain/finance";
import { stagedRowSchema } from "@/lib/domain/freee-staging";
import { stagedTrend } from "@/lib/domain/staged-trend";
import { freeeReviewFacts } from "@/lib/domain/freee-review";
import { getAdminReports } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export default async function FreeeMonthReview({ params }: { params: Promise<{ period: string }> }) {
  const actor = await requireAdmin();
  if (isMockEnvironment()) notFound();
  const { period } = await params;
  if (!periodSchema.safeParse(period).success) notFound();
  const client = await productionClient(actor, true);
  const [{ data, error }, reports] = await Promise.all([
    client.rpc("ir_list_freee_staged", { p_company: actor.companyId }),
    getAdminReports(actor),
  ]);
  databaseError(error);
  const entries: unknown[] = Array.isArray(data) ? data : [];
  const rows = entries.flatMap((entry) => {
    const parsed = stagedRowSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
  const row = rows.find((entry) => entry.period === period);
  if (!row) notFound();
  const report = reports.find((entry) => entry.period === period);
  const chart = stagedTrend(rows.filter((entry) => entry.period <= period));
  const incomplete = row.candidate.completeness === "month-to-date";
  const yen = (value: number) => `${value.toLocaleString("ja-JP")}円`;
  const retrieved = new Date(row.provenance.retrievedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "short" });
  const operatingMargin = margin(row.candidate.operatingProfit.current, row.candidate.revenue.current);

  return (
    <Shell role="admin">
      <div className="freee-review">
        <Link className="admin-back" href="/admin/import"><ArrowLeft size={14} /> 財務データへ戻る</Link>
        <div className="freee-review-hero">
          <div>
            <span className="eyebrow">MONTHLY FINANCIAL REVIEW / {period.replace("-", ".")}</span>
            <h1>{periodLabel(period)}<br /><em>数字から、経営の説明へ。</em></h1>
            <p>freee取得値では、売上高は{millions(row.candidate.revenue.current)}百万円、営業利益は{millions(row.candidate.operatingProfit.current)}百万円。営業利益率は{operatingMargin.toFixed(1)}%。会計締め・現預金科目・増減理由を確認するまで株主向けの確定実績にはしません。</p>
          </div>
          <div className="freee-review-state"><span className="freee-review-pulse" />{incomplete ? "月途中の参考値" : report?.content.financial.source === "freee" ? "下書きへ反映済み" : "会計確認待ち"}</div>
        </div>
        <div className="freee-review-source"><span><Database size={14} /> SOURCE · freee会計</span><span>取得 {retrieved} JST</span><span><ShieldCheck size={14} /> 株主には非公開</span></div>
        <div className="freee-review-kpis">
          {freeeReviewFacts(row).map((item) => (
            <article key={item.key} className="freee-review-kpi">
              <span>{item.label}</span>
              <strong>{millions(item.current)}<small>百万円</small></strong>
              <div className="freee-review-kpi-bottom"><span>前年 {millions(item.previous)}百万円</span><b className={item.yoy.delta < 0 ? "negative" : item.yoy.delta > 0 ? "positive" : ""}>{item.yoy.label}</b></div>
              {item.yoy.note && <small>{item.yoy.note}</small>}
            </article>
          ))}
        </div>
        <div className="freee-review-grid">
          <section className="freee-review-panel">
            <span className="section-kicker">01 / CHANGE</span>
            <h2>何が変わったか</h2>
            <p>前年同月との差額と増減率はfreee取得値から算出。事業上の理由は、経営者の振り返りを追加して確定します。</p>
            <div className="freee-review-comparison">
              {freeeReviewFacts(row).slice(0, 3).map((item) => <div key={item.key}><span>{item.label}</span><strong>{item.yoy.delta > 0 ? "+" : ""}{yen(item.yoy.delta)}</strong></div>)}
            </div>
          </section>
          <section className="freee-review-panel freee-review-next">
            <span className="section-kicker">02 / MANAGEMENT CONTEXT</span>
            <h2>なぜ変わったか</h2>
            <p>売上・利益の増減理由、事業の進捗、リスク、AIの寄与は数値だけでは判断できません。月次の振り返りを入力し、AIの下書きを人が確認します。</p>
            <div className="freee-review-pending"><CircleAlert size={17} /> 経営者の説明待ち</div>
          </section>
        </div>
        {chart && <section className="freee-review-chart"><div className="freee-review-section-head"><span className="section-kicker">03 / TRAJECTORY</span><h2>今期の推移</h2><p>実線が当期、比較線が前年同月。月途中の数値は除いています。</p></div><TrendChart financial={chart} provisional /></section>}
        <div className="freee-review-grid">
          <section className="freee-review-panel"><span className="section-kicker">04 / BALANCE SHEET</span><h2>財務状態</h2><div className="freee-review-comparison"><div><span>総資産</span><strong>{yen(row.candidate.assets)}</strong></div><div><span>負債</span><strong>{yen(row.candidate.liabilities)}</strong></div><div><span>純資産</span><strong>{yen(row.candidate.equity)}</strong></div></div><p>現預金候補の科目ID：{row.provenance.cashAccountIds.current.join("、")}。対象科目を残高試算表で確認してください。</p></section>
          <section className="freee-review-panel freee-review-voice"><AudioLines size={25} /><span className="section-kicker">05 / CEO VOICE</span><h2>経営者の声を添える</h2><p>会計確認後のレポート編集画面で、音声入力を使って当月の状況・業績の背景を記録できます。株主向けの音声配信は、録音データと公開前確認を整えてから追加します。</p>{report && <Link href={`/admin/reports/${report.id}`}>振り返りを編集 <ArrowUpRight size={14} /></Link>}</section>
        </div>
        <section className="freee-review-publish"><div><span className="section-kicker">FINAL CHECK / HUMAN IN THE LOOP</span><h2>会計を確認し、非公開の月次下書きへ</h2><p>未確認の候補値は株主に公開されません。確認後も「振り返り → レビュー → 承認 → 公開」が必要です。</p></div>{incomplete ? <p className="freee-review-pending">月途中のため、月次レポートへの反映はできません。</p> : report?.content.financial.source === "freee" ? <Link className="button primary" href={`/admin/reports/${report.id}`}>下書きを編集する</Link> : <FreeePromoteForm id={row.id} period={period} cashAccountIds={row.provenance.cashAccountIds.current} />}</section>
      </div>
    </Shell>
  );
}
