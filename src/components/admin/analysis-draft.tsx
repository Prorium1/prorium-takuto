import type { AnalysisRun } from "@/lib/domain/types";
export function AnalysisDraftView({ run }: { run: AnalysisRun | undefined }) {
  if (!run) return null;
  const groups = [
    ["Why It Changed", run.output.whyItChanged],
    ["Positive Factors", run.output.positiveFactors],
    ["Negative Factors", run.output.negativeFactors],
    ["Risks Draft", run.output.riskDraft],
    ["Forward Indicators Draft", run.output.forwardDraft],
  ] as const;
  return (
    <details className="admin-panel analysis-draft">
      <summary>Mock AI Analysis · 生成された分析を確認</summary>
      <p className="admin-info">
        サマリーと財務分析はEditorに反映済みです。以下は確認用の叩き台です。Risk・Forward
        Indicatorsへの反映はEditorで行います。人による承認まで公開されません。
      </p>
      <div className="analysis-groups">
        {groups.map(([name, items]) => (
          <section key={name}>
            <h3>{name}</h3>
            <ul>
              {items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </details>
  );
}
