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
  const [copyError, setCopyError] = useState(false);
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
  const step = { draft: 0, review: 1, approved: 2, published: 3 }[
    r?.state || "draft"
  ];
  const guidance = [
    [
      "まず、報告の内容を確認しましょう",
      "金額や人数、まだ確認中の情報を見て、必要なところを直します。",
    ],
    [
      "この内容で公開してよいか決めましょう",
      "承認するだけでは、まだ株主には公開されません。",
    ],
    [
      "準備ができました。株主に公開します",
      "公開ボタンを押すと、登録済みの株主がこの報告を読めます。",
    ],
    [
      "株主に共有できる状態です",
      "閲覧する株主を登録し、共有リンクを送ってください。",
    ],
  ][step];
  const publicPath = r ? `/fiscal/${year}?version=${r.version}` : "";
  return (
    <section className="fiscal-share-editor">
      <header>
        <span className="eyebrow">経営者用 · 株主へのご報告</span>
        <h1>{year}年10月期の報告</h1>
        <p>
          {year - 1}年11月〜{year}年10月のご報告をまとめます。
        </p>
        <ol className="fiscal-workflow" aria-label="公開までの手順">
          {["内容を確認", "公開を承認", "株主に公開", "共有する"].map(
            (label, i) => (
              <li
                key={label}
                aria-current={i === step ? "step" : undefined}
                className={i < step ? "is-done" : ""}
              >
                <span>{i + 1}</span>
                <strong>{label}</strong>
              </li>
            ),
          )}
        </ol>
      </header>
      {cloudPreview && (
        <p className="simple-notice">
          確認用デモのため、保存・承認・公開はできません。
        </p>
      )}
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
              <strong>
                {status[r.state]}
                {r.state !== "published" && " · 株主にはまだ見えません"}
              </strong>
              <p>
                会計データ：{r.content.source.months.at(-1)?.period}
                まで。まだ入っていない月：{12 - r.content.source.months.length}
                か月。{fiscalVersionLabel(r.version)}
              </p>
            </div>
            <Link
              href={`/admin/fiscal/${year}/preview?version=${r.version}`}
              className="button secondary"
              aria-disabled={dirty}
              onClick={(event) => {
                if (dirty) event.preventDefault();
              }}
            >
              報告を開いて確認する
            </Link>
            <PdfButton
              period={`${year}-10`}
              version={fiscalVersionLabel(r.version)}
              endpoint={`/api/fiscal/${year}/pdf?version=${r.version}${r.state === "published" ? "" : "&preview=1"}`}
              filename={`Prorium-FY${year}-${fiscalVersionLabel(r.version)}${r.state === "published" ? "" : "-review"}.pdf`}
              browserPrint={cloudPreview}
              disabled={dirty}
            />
          </div>
          {r.state === "published" ? (
            <div className="fiscal-share-ready">
              <h2>株主に報告を送りましょう</h2>
              <p>
                登録されたメールアドレスでログインすると、資料とPDFを閲覧できます。
              </p>
              <ol className="fiscal-sharing-instructions">
                <li>
                  下のボタンから、閲覧する株主のメールアドレスを登録します。
                </li>
                <li>共有リンクをコピーして、メールなどで株主に送ります。</li>
              </ol>
              <Link href={publicPath}>公開した報告を開く →</Link>
              <button
                className="button primary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      new URL(publicPath, window.location.origin).href,
                    );
                    setCopied(true);
                    setCopyError(false);
                  } catch {
                    setCopied(false);
                    setCopyError(true);
                  }
                }}
              >
                {copied ? "コピーしました" : "共有リンクをコピー"}
              </button>
              {copyError && (
                <p role="alert">
                  コピーできませんでした。「公開した報告を開く」を押し、ブラウザの共有ボタンからリンクを送ってください。
                </p>
              )}
              <Link className="button secondary" href="/admin/investors">
                株主のメールアドレスを登録
              </Link>
              <form action={action}>
                {fields}
                <input type="hidden" name="operation" value="prepare" />
                <button className="button" disabled={pending || cloudPreview}>
                  内容を直して新しい版を作る
                </button>
              </form>
            </div>
          ) : (
            <>
              <div className="fiscal-review-step">
                <span className="simple-step-label">いま、すること</span>
                <h2>{guidance[0]}</h2>
                <p>{guidance[1]}</p>
                <p>
                  上の「報告を開いて確認する」から内容を見られます。会計が未確定の月や未入力の情報も、表示を確認してください。
                </p>
                {issues.length > 0 && (
                  <ul>
                    {issues.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                )}
                {dirty && (
                  <p role="status">変更した内容を先に保存してください。</p>
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
                      金額・人数・未確定の情報の表示を確認しました
                    </label>
                  )}
                  <button
                    className="button primary"
                    disabled={
                      pending || dirty || cloudPreview || issues.length > 0
                    }
                  >
                    {r.state === "draft"
                      ? "確認して次へ進む"
                      : r.state === "review"
                        ? "この内容で承認する"
                        : "株主に公開する"}
                  </button>
                </form>
              </div>
              <details
                className="fiscal-edit-details"
                id="fiscal-edit"
                open={issues.length > 0}
              >
                <summary>人数や文章を確認・修正する</summary>
                <p>
                  必要な項目だけ直し、最後に「入力内容を保存」を押してください。保存すると、公開前の確認をやり直します。
                </p>
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
                                notes: {
                                  ...editor.notes,
                                  [key]: e.target.value,
                                },
                              })
                            }
                          />
                        </label>
                      ))}
                    </>
                  )}
                  <button
                    className={`button ${dirty || issues.length ? "primary" : "secondary"}`}
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
              </details>
              <details className="fiscal-refresh-details">
                <summary>会計データなどを更新したいとき</summary>
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
              </details>
            </>
          )}
        </>
      )}
    </section>
  );
}
