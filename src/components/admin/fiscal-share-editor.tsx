"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import {
  fiscalPublicationAction,
  type FiscalActionState,
} from "@/app/fiscal-publication-actions";
import {
  fiscalReviewIssues,
  fiscalVersionLabel,
  type FiscalPublication,
  type FiscalEditor,
} from "@/lib/domain/fiscal-publication";
import { PdfButton } from "@/components/report/pdf-button";
export function FiscalShareEditor({
  year,
  report: r,
  cloudPreview = false,
}: {
  year: number;
  report: FiscalPublication | null;
  cloudPreview?: boolean;
}) {
  const [state, action, pending] = useActionState<FiscalActionState, FormData>(
    fiscalPublicationAction,
    {},
  );
  const [editor, setEditor] = useState<FiscalEditor | null>(
    r ? { organization: r.content.organization, notes: r.content.notes } : null,
  );
  const [dirty, setDirty] = useState(false),
    [copied, setCopied] = useState(false);
  const update = (next: FiscalEditor) => {
    setEditor(next);
    setDirty(true);
  };
  const fields = (
    <>
      <input type="hidden" name="year" value={year} />
      {r && (
        <>
          <input type="hidden" name="id" value={r.id} />
          <input type="hidden" name="revision" value={r.revision} />
        </>
      )}
    </>
  );
  const issues = r ? fiscalReviewIssues(r.content) : [];
  const status = {
    draft: "下書き",
    review: "確認済み・承認待ち",
    approved: "承認済み・公開待ち",
    published: "株主へ公開済み",
  };
  const publicPath = r ? `/fiscal/${year}?version=${r.version}` : "";
  return (
    <section className="fiscal-share-editor">
      <header>
        <span className="eyebrow">INVESTOR SHARING</span>
        <h1>{year}年10月期を、株主へ。</h1>
        <p>内容を整える → 投資家の見え方を確認 → 承認 → 公開</p>
      </header>
      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="success-message">
          {state.success}
        </p>
      )}
      {!r ? (
        <form action={action}>
          {fields}
          <input type="hidden" name="operation" value="prepare" />
          <p>取得済みの会計データと経営サマリーから、共有用の版を作ります。</p>
          <button className="button primary" disabled={pending || cloudPreview}>
            株主共有用の下書きを作成
          </button>
        </form>
      ) : (
        <>
          <div className="fiscal-sharing-bar">
            <div>
              <strong>{status[r.state]}</strong>
              <p>
                {fiscalVersionLabel(r.version)} · 会計実績{" "}
                {r.content.source.months.at(-1)?.period}まで · 未取得{" "}
                {12 - r.content.source.months.length}か月
              </p>
            </div>
            <Link
              href={`/admin/fiscal/${year}/preview?version=${r.version}`}
              className="button secondary"
              target="_blank"
            >
              投資家の見え方を確認
            </Link>
            <PdfButton
              period={`${year}-10`}
              version={fiscalVersionLabel(r.version)}
              endpoint={`/api/fiscal/${year}/pdf?version=${r.version}${r.state === "published" ? "" : "&preview=1"}`}
              filename={`Prorium-FY${year}-${fiscalVersionLabel(r.version)}${r.state === "published" ? "" : "-review"}.pdf`}
              browserPrint={cloudPreview}
            />
          </div>
          {r.state === "published" ? (
            <div className="fiscal-share-ready">
              <h2>このURLを株主に共有できます</h2>
              <p>
                登録されたメールアドレスでログインすると、資料とPDFを閲覧できます。
              </p>
              <Link href={publicPath}>{publicPath}</Link>
              <button
                className="button primary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      new URL(publicPath, window.location.origin).href,
                    );
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? "コピーしました" : "共有URLをコピー"}
              </button>
              <Link className="button secondary" href="/admin/investors">
                株主のメールアドレスを登録
              </Link>
              <form action={action}>
                {fields}
                <input type="hidden" name="operation" value="prepare" />
                <button className="button" disabled={pending || cloudPreview}>
                  改訂版を作成
                </button>
              </form>
            </div>
          ) : (
            <>
              <form action={action} className="fiscal-refresh">
                {fields}
                <input type="hidden" name="operation" value="refresh" />
                <p>
                  追加・修正された会計データ、経営サマリー、株主構成と大会映像を取り込み直せます。入力した人数・文章は引き継ぎ、確認・承認はやり直します。
                </p>
                <button
                  className="button secondary"
                  disabled={pending || dirty || cloudPreview}
                >
                  最新の取得済みデータで下書きを更新
                </button>
              </form>
              <form action={action} className="fiscal-editor-form">
                {fields}
                <input type="hidden" name="operation" value="save" />
                <input
                  type="hidden"
                  name="editor"
                  value={JSON.stringify(
                    editor
                      ? {
                          ...editor,
                          organization: {
                            ...editor.organization,
                            areas: editor.organization.areas
                              .map((x) => x.trim())
                              .filter(Boolean),
                          },
                        }
                      : editor,
                  )}
                />
                <h2>在籍人数と体制</h2>
                <p>
                  社員数に休業中の社員を含めます。不明な区分は空欄にしてください。
                </p>
                {editor && (
                  <>
                    <div className="fiscal-editor-grid">
                      <label>
                        組織情報の基準日
                        <input
                          type="date"
                          value={editor.organization.asOf}
                          onChange={(e) =>
                            update({
                              ...editor,
                              organization: {
                                ...editor.organization,
                                asOf: e.target.value,
                              },
                            })
                          }
                        />
                      </label>
                      {(
                        [
                          ["employees", "社員数"],
                          ["onLeave", "うち休業中"],
                          ["partTime", "アルバイト"],
                          ["directors", "役員"],
                          ["contractors", "業務委託"],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key}>
                          {label}
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={editor.organization[key] ?? ""}
                            placeholder="未確認"
                            onChange={(e) =>
                              update({
                                ...editor,
                                organization: {
                                  ...editor.organization,
                                  [key]:
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value),
                                },
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <label>
                      人数の確認元
                      <input
                        value={editor.organization.sourceLabel}
                        maxLength={160}
                        onChange={(e) =>
                          update({
                            ...editor,
                            organization: {
                              ...editor.organization,
                              sourceLabel: e.target.value,
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      担当領域（1行に1つ）
                      <textarea
                        value={editor.organization.areas.join("\n")}
                        onChange={(e) =>
                          update({
                            ...editor,
                            organization: {
                              ...editor.organization,
                              areas: e.target.value.split("\n"),
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      人数・編成の補足
                      <textarea
                        value={editor.organization.note}
                        maxLength={1200}
                        onChange={(e) =>
                          update({
                            ...editor,
                            organization: {
                              ...editor.organization,
                              note: e.target.value,
                            },
                          })
                        }
                      />
                    </label>
                    <label className="fiscal-confirm">
                      <input
                        type="checkbox"
                        checked={editor.organization.confirmed}
                        onChange={(e) =>
                          update({
                            ...editor,
                            organization: {
                              ...editor.organization,
                              confirmed: e.target.checked,
                            },
                          })
                        }
                      />
                      人数の対象範囲と基準日を確認しました（不明な区分は空欄）
                    </label>
                    <h2>事業の報告と株主へのお願い</h2>
                    {(
                      [
                        ["development", "開発・サービスの進捗"],
                        ["hiring", "採用・組織の方針"],
                        ["requests", "株主にお願いしたいこと"],
                        ["risks", "リスクと確認中の事項"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <textarea
                          maxLength={3000}
                          rows={4}
                          value={editor.notes[key]}
                          onChange={(e) =>
                            update({
                              ...editor,
                              notes: { ...editor.notes, [key]: e.target.value },
                            })
                          }
                        />
                      </label>
                    ))}
                  </>
                )}
                <button
                  className="button primary"
                  disabled={pending || cloudPreview}
                >
                  {pending ? "保存中…" : "入力内容を保存"}
                </button>
                {dirty && (
                  <p role="status">
                    変更があります。確認・承認へ進む前に保存してください。
                  </p>
                )}
              </form>
              <div className="fiscal-review-step">
                <h2>公開前の確認</h2>
                <p>
                  会計の対象月・未締めの数値・未確認の項目・人数の範囲を、プレビューで確認してください。
                </p>
                {issues.length > 0 && (
                  <ul>
                    {issues.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                )}
                <form action={action}>
                  {fields}
                  <input
                    type="hidden"
                    name="operation"
                    value={
                      r.state === "draft"
                        ? "review"
                        : r.state === "review"
                          ? "approve"
                          : "publish"
                    }
                  />
                  {r.state === "draft" && (
                    <label className="fiscal-confirm">
                      <input
                        type="checkbox"
                        name="acknowledged"
                        value="yes"
                        required
                      />
                      取得済み実績、締め状況、未取得月と組織情報の表示を確認しました
                    </label>
                  )}
                  <button
                    className="button primary"
                    disabled={
                      pending || dirty || cloudPreview || issues.length > 0
                    }
                  >
                    {r.state === "draft"
                      ? "内容の確認を完了"
                      : r.state === "review"
                        ? "この版を承認"
                        : "株主専用ページへ公開"}
                  </button>
                </form>
                <Link href="/admin/investors">
                  閲覧できる株主を登録・管理 →
                </Link>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
