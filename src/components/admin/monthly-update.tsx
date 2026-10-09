"use client";
import { useActionState, useState } from "react";
import { Sparkles, Save, LockKeyhole } from "lucide-react";
import { monthlyUpdateAction } from "@/app/monthly-actions";
import type { ActionResult } from "@/app/actions";
import {
  decodeReflection,
  emptyReflection,
  structureReflection,
  type MonthlyReflection,
} from "@/lib/domain/reflection";
import type { ReportVersion } from "@/lib/domain/types";

const questions = [
  {
    key: "revenueReason",
    label: "売上が変わった理由",
    hint: "何が増減し、何を根拠にそう考えるか。顧客数・単価・継続率など、実測と見立てを区別して。",
  },
  {
    key: "profitReason",
    label: "利益が変わった理由",
    hint: "売上の伸び、原価、固定費、先行投資。改善・悪化と、一時的か今後も続く変化かを。",
  },
  {
    key: "risksAndActions",
    label: "課題と、取っている対策",
    hint: "何がうまくいかなかったか → 影響 → 対策 → 次に確認する時期。未解決の点も残してください。",
  },
  {
    key: "aiImpact",
    label: "AIが事業・業務にもたらした変化",
    hint: "AIで得た売上と、社内の効率化を分けて記入。比較期間・計測方法を添え、不明な効果は「未計測」と。",
  },
  {
    key: "outlook",
    label: "来月以降の見通しと打ち手",
    hint: "確定した契約・予測・商談を区別して記入。予定は実績と分けて整理します。",
  },
] as const;

export function MonthlyUpdateForm({
  report,
  notes,
  aiEnabled,
  cloudPreview = false,
}: {
  report: ReportVersion;
  notes: string;
  aiEnabled: boolean;
  cloudPreview?: boolean;
}) {
  type ReflectionState = ActionResult & {
    previewDraft?: ReturnType<typeof structureReflection>;
  };
  const [state, action, pending] = useActionState<ReflectionState, FormData>(
    cloudPreview
      ? async (_state, form) => {
          try {
            return {
              previewDraft: structureReflection(
                report.period,
                JSON.parse(String(form.get("reflection"))),
              ),
              success:
                "下書きをこの画面に表示しました。保存・公開はされていません。",
            };
          } catch {
            return {
              error:
                "公開用の振り返りを10文字以上入力し、文字数上限を確認してください。",
            };
          }
        }
      : monthlyUpdateAction,
    {},
  );
  const [reflection, setReflection] = useState(() => decodeReflection(notes));
  const update = (key: keyof MonthlyReflection, value: string) =>
    setReflection((current) => ({ ...current, [key]: value }));
  const answered = [
    reflection.events,
    ...questions.map(({ key }) => reflection[key]),
  ].filter((v) => v.trim()).length;
  const financial = report.content.financial;
  return (
    <section className="admin-panel monthly-input">
      <div className="panel-heading">
        <h2>今月を振り返る</h2>
        <span>MONTHLY REFLECTION</span>
      </div>
      <p className="reflection-intro">数字の背景に、経営者の言葉を。</p>
      <p className="admin-info">
        質問に沿って、分かるところから。箇条書きや音声入力で構いません。振り返りから「今月のサマリー」と「なぜ変化したか」の下書きを作ります。
      </p>
      <ol className="reflection-method" aria-label="月次サマリーの作成手順">
        <li>
          <span>01</span>
          <div>
            <strong>事実を残す</strong>
            <p>出来事・数字・対象月</p>
          </div>
        </li>
        <li>
          <span>02</span>
          <div>
            <strong>理由を添える</strong>
            <p>根拠・判断・次の一手</p>
          </div>
        </li>
        <li>
          <span>03</span>
          <div>
            <strong>確かめて届ける</strong>
            <p>下書き → 人が確認 → 公開</p>
          </div>
        </li>
      </ol>
      {cloudPreview && (
        <div className="reflection-demo-intro">
          <p>
            架空の出来事でお試しください。入力はこのブラウザ内で文章として整理し、再読み込みすると消えます。AI接続後は、財務数値と合わせた下書きの生成に対応します。
          </p>
          <button
            type="button"
            className="button secondary"
            onClick={() =>
              setReflection({
                ...emptyReflection(),
                events:
                  "【架空の入力例】既存顧客向けの運用支援を拡大。オンライン講座の募集を開始しました。",
                revenueReason:
                  "既存顧客からの追加依頼が増加。単価を維持しながら提供範囲を広げました。",
                profitReason:
                  "制作手順の共通化で外注工程を削減。一方、講座の準備費用が発生しました。",
                risksAndActions:
                  "担当者への業務集中が課題。手順書を整備し、翌月に分担状況を確認します。",
                aiImpact:
                  "動画の文字起こしと初稿作成をAIで支援。削減時間と原価への効果は未計測です。",
                outlook:
                  "講座の追加募集を予定。法人提案は商談中で、受注は未確定です。",
              })
            }
          >
            サンプルを入れる
          </button>
        </div>
      )}
      {financial.available !== false && (
        <div className="reflection-financials" aria-label="振り返りの参考数値">
          {(
            [
              ["売上", financial.revenue],
              ["営業利益", financial.operatingProfit],
              ["経常利益", financial.ordinaryProfit],
              ["現預金", financial.cash],
            ] as const
          ).map(([label, metric]) => (
            <div key={label}>
              <span>
                {label}
                {financial.isMock ? " · サンプル" : ""}
              </span>
              <strong>
                {metric.current.toLocaleString("ja-JP")}
                <small>円</small>
              </strong>
              <span>前年同月 {metric.previous.toLocaleString("ja-JP")}円</span>
            </div>
          ))}
        </div>
      )}
      <form action={action}>
        <input type="hidden" name="id" value={report.id} />
        <input type="hidden" name="revision" value={report.revision} />
        <input
          type="hidden"
          name="reflection"
          value={JSON.stringify(reflection)}
        />
        <fieldset className="reflection-fields" disabled={pending}>
          <legend className="reflection-progress">
            株主向け下書きの材料 <span>{answered} / 6 項目 · すべて任意</span>
          </legend>
          <div className="reflection-coverage">
            <p>
              資料名や確認した日付も添えると、下書きとの照合がしやすくなります。分からない項目は「未確認」で構いません。
            </p>
            <div aria-label="振り返りの入力状況">
              {[
                { key: "events", label: "出来事", target: "monthly-notes" },
                ...questions.map((q) => ({
                  ...q,
                  target: `reflection-${q.key}`,
                })),
              ].map((q) => (
                <a
                  key={q.key}
                  href={`#${q.target}`}
                  data-filled={Boolean(
                    reflection[q.key as keyof MonthlyReflection].trim(),
                  )}
                >
                  <span>{q.label}</span>
                  <small>
                    {reflection[q.key as keyof MonthlyReflection].trim()
                      ? "入力あり"
                      : "未入力"}
                  </small>
                </a>
              ))}
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="monthly-notes">今月あったこと</label>
            <p id="monthly-notes-hint" className="field-hint">
              一番伝えたい進捗や意思決定。先月の打ち手の結果も残しておきましょう。
            </p>
            <textarea
              id="monthly-notes"
              value={reflection.events}
              onChange={(e) => update("events", e.target.value)}
              placeholder="今月、会社にとって一番大きかった出来事は…"
              maxLength={12000}
              rows={5}
              aria-describedby="monthly-notes-hint"
            />
          </div>
          <div className="reflection-grid">
            {questions.map(({ key, label, hint }) => (
              <div className={`form-field reflection-${key}`} key={key}>
                <label htmlFor={`reflection-${key}`}>{label}</label>
                <p id={`${key}-hint`} className="field-hint">
                  {hint}
                </p>
                <textarea
                  id={`reflection-${key}`}
                  value={reflection[key]}
                  onChange={(e) => update(key, e.target.value)}
                  maxLength={1200}
                  rows={3}
                  aria-describedby={`${key}-hint`}
                />
              </div>
            ))}
          </div>
          <details className="reflection-extra">
            <summary>
              まだ検証できていない見立て{reflection.hypotheses && " · 入力あり"}
            </summary>
            <div className="form-field">
              <label htmlFor="reflection-hypotheses">未検証の見立て</label>
              <p className="field-hint">
                下書きでは「未検証の見立て」と明示します。確かめるべきことも一緒に。
              </p>
              <textarea
                id="reflection-hypotheses"
                value={reflection.hypotheses}
                onChange={(e) => update("hypotheses", e.target.value)}
                rows={3}
                maxLength={1200}
              />
            </div>
          </details>
          <details className="reflection-extra reflection-private">
            <summary>
              <LockKeyhole size={14} /> 非公開メモ
              {reflection.privateNotes && " · 入力あり"}
            </summary>
            <div className="form-field">
              <label htmlFor="reflection-private">管理者専用メモ</label>
              <p id="private-hint" className="field-hint">
                AIにも株主にも送信しません。個人名や交渉条件など、下書きに含めたくない情報はこちらへ。
              </p>
              <textarea
                id="reflection-private"
                value={reflection.privateNotes}
                onChange={(e) => update("privateNotes", e.target.value)}
                rows={3}
                maxLength={3000}
                aria-describedby="private-hint"
              />
            </div>
          </details>
        </fieldset>
        <div className="workflow-controls">
          {!cloudPreview && (
            <button
              className="button secondary"
              name="mode"
              value="save"
              disabled={pending}
            >
              <Save size={14} />
              入力を保存
            </button>
          )}
          <button
            className="button primary"
            name="mode"
            value={aiEnabled ? "generate" : "structure"}
            disabled={pending}
          >
            <Sparkles size={14} />
            {pending
              ? "処理中…"
              : cloudPreview
                ? "下書きを確認"
                : aiEnabled
                  ? "AIで今月のサマリーを作成"
                  : "文章からサマリーの下書きを作成"}
          </button>
          {aiEnabled && !cloudPreview && (
            <button
              className="button secondary"
              name="mode"
              value="structure"
              disabled={pending}
            >
              AIを使わず文章を整理
            </button>
          )}
        </div>
        <p className="workflow-info">
          {cloudPreview ? (
            "現在はAI未接続の文章整理モードです。非公開メモは下書きに含めません。編集後は「下書きを確認」を押すと反映されます。"
          ) : (
            <>
              生成すると、編集欄のサマリーと変化理由が更新されます。非公開メモ以外の入力は下書きに引用されるため、内容をプレビューで確認してください。承認・公開は人が行います。
              {!aiEnabled && "現在は入力した文章の整理モードです。"}
            </>
          )}
        </p>
        {state.error && (
          <p role="alert" className="form-error">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="form-success">
            {state.success}
          </p>
        )}
      </form>
      {cloudPreview && state.previewDraft && (
        <article className="reflection-draft" aria-label="確認用の下書き">
          <div className="panel-heading">
            <h3>株主向け下書き</h3>
            <span>保存・公開されません</span>
          </div>
          <h4>{state.previewDraft.summary.headline}</h4>
          <p>{state.previewDraft.summary.text}</p>
          {state.previewDraft.financialAnalysis && (
            <>
              <h4>なぜ変化したか</h4>
              <p>{state.previewDraft.financialAnalysis}</p>
            </>
          )}
          {state.previewDraft.summary.outlook && (
            <>
              <h4>今後の見通し</h4>
              <p>{state.previewDraft.summary.outlook}</p>
            </>
          )}
        </article>
      )}
    </section>
  );
}
