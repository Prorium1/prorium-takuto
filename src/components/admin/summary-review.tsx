import type { ReportContent } from "@/lib/domain/types";
import { summaryReview } from "@/lib/domain/summary-quality";

export function SummaryReview({ content }: { content: ReportContent }) {
  const checks = summaryReview(content);
  return (
    <aside className="summary-review" aria-label="サマリーの編集ガイド">
      <div className="summary-review-heading">
        <strong>株主に伝わるサマリーへ</strong>
        <span>本文 {content.summary.text.length}文字 / 目安400文字</span>
      </div>
      <p>結論 → 理由 → 次の打ち手。良い変化と課題の両方を伝えます。</p>
      {checks.length > 0 ? (
        <ul>
          {checks.map((check) => (
            <li key={check.id}>
              <strong>{check.title}</strong>
              <span>{check.detail}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="summary-review-ready">
          文章量と記入状況のチェックでは追加の指摘はありません。数値・因果関係・見通しの確度は原資料と照合してください。
        </p>
      )}
      <details>
        <summary>公開前に人が確認する4つのこと</summary>
        <ol>
          <li>数字は対象月・前年同月・単位が財務資料と一致しているか。</li>
          <li>変化の理由には根拠があり、仮説を事実と書いていないか。</li>
          <li>今後の予定・未確約の商談を、実績や確定契約と書いていないか。</li>
          <li>AIの効果は実測と推計を分け、未計測を改善実績としていないか。</li>
        </ol>
      </details>
    </aside>
  );
}
