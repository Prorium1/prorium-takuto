"use client";
import { useActionState, useId, useState } from "react";
import { Plus, Save } from "lucide-react";
import { reportOperationAction } from "@/app/actions";
import type { ReportVersion } from "@/lib/domain/types";
import { SummaryReview } from "./summary-review";
import type { ContentEdit } from "@/lib/domain/validation";
import { briefingTopics } from "@/lib/domain/briefing";
import { EventEditor } from "./event-editor";

function Field({
  label,
  value,
  onChange,
  multiline = false,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
      ) : (
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
      )}
    </div>
  );
}
function patchItems<T extends { id: string }>(
  items: T[],
  id: string,
  patch: Partial<T>,
) {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}
export function ReportEditor({ report }: { report: ReportVersion }) {
  const [state, action, pending] = useActionState(reportOperationAction, {});
  return (
    <form action={action} className="admin-editor">
      <input type="hidden" name="id" value={report.id} />
      <input type="hidden" name="revision" value={report.revision} />
      <input type="hidden" name="operation" value="edit" />
      <EditorFields key={report.contentHash} report={report} />
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
      <div className="save-bar">
        <span>保存するとDraftに戻り、既存の承認は解除されます。</span>
        <button disabled={pending} className="button primary">
          <Save size={15} />
          {pending ? "保存中…" : "変更を保存"}
        </button>
      </div>
    </form>
  );
}
function EditorFields({ report }: { report: ReportVersion }) {
  const c = report.content;
  const [edit, setEdit] = useState<ContentEdit>({
    headline: c.summary.headline,
    summary: c.summary.text,
    summaryPoints: c.summary.points,
    summaryOutlook: c.summary.outlook,
    financialAnalysis: c.financialAnalysis,
    highlights: c.highlights,
    briefing: c.briefing ?? [],
    eventSpotlight: c.eventSpotlight ?? null,
    forward: c.forward,
    risks: c.risks,
    ceoQuote: c.ceo.quote,
    ceoMessage: c.ceo.message,
  });
  const [pointsText, setPointsText] = useState(c.summary.points.join("\n"));
  function update(patch: Partial<ContentEdit>) {
    setEdit((e) => ({ ...e, ...patch }));
  }
  return (
    <>
      <input
        type="hidden"
        name="payload"
        value={JSON.stringify({
          ...edit,
          eventSpotlight: edit.eventSpotlight
            ? {
                ...edit.eventSpotlight,
                outcomes: edit.eventSpotlight.outcomes
                  .map((value) => value.trim())
                  .filter(Boolean),
              }
            : null,
          summaryPoints: pointsText
            .split("\n")
            .map((point) => point.trim())
            .filter(Boolean),
        })}
      />
      <section className="editor-section">
        <h2>01 · Executive Summary</h2>
        <SummaryReview
          content={{
            ...c,
            summary: {
              headline: edit.headline,
              text: edit.summary,
              points: pointsText
                .split("\n")
                .map((p) => p.trim())
                .filter(Boolean),
              outlook: edit.summaryOutlook,
            },
            financialAnalysis: edit.financialAnalysis,
            risks: edit.risks,
            forward: edit.forward,
          }}
        />
        <Field
          label="見出し"
          value={edit.headline}
          onChange={(headline) => update({ headline })}
        />
        <Field
          label="Executive Summary 本文"
          multiline
          value={edit.summary}
          onChange={(summary) => update({ summary })}
        />
        <Field
          label="数字の変化理由（Why It Changed）"
          multiline
          value={edit.financialAnalysis}
          onChange={(financialAnalysis) => update({ financialAnalysis })}
        />
        <Field
          label="サマリーの要点（1行に1つ）"
          multiline
          required={false}
          value={pointsText}
          onChange={setPointsText}
        />
        <p>
          最大5件・各300文字です。非公開の情報や誤りを削除し、不要な場合は空にしてください。
        </p>
        <Field
          label="今後の見通し（任意）"
          multiline
          required={false}
          value={edit.summaryOutlook}
          onChange={(summaryOutlook) => update({ summaryOutlook })}
        />
      </section>
      <section className="editor-section">
        <h2>04 · Business Highlights</h2>
        <p>
          株主画面に表示する事業カード。将来情報は説明文で明示してください。
        </p>
        {edit.highlights.map((item, i) => (
          <div className="editor-subcard" key={item.id}>
            <div className="editor-subcard-top">
              <span>Highlight {i + 1}</span>
              <button
                type="button"
                className="remove-button"
                onClick={() =>
                  update({
                    highlights: edit.highlights.filter((v) => v.id !== item.id),
                  })
                }
              >
                削除
              </button>
            </div>
            <div className="field-row">
              <Field
                label="事業名"
                value={item.title}
                onChange={(title) =>
                  update({
                    highlights: patchItems(edit.highlights, item.id, { title }),
                  })
                }
              />
              <Field
                label="Business Unit"
                value={item.business_unit}
                onChange={(business_unit) =>
                  update({
                    highlights: patchItems(edit.highlights, item.id, {
                      business_unit,
                    }),
                  })
                }
              />
            </div>
            <div className="field-row three">
              <Field
                label="Metric"
                value={item.metric}
                onChange={(metric) =>
                  update({
                    highlights: patchItems(edit.highlights, item.id, {
                      metric,
                    }),
                  })
                }
              />
              <Field
                label="Metric Value"
                value={item.metric_value}
                onChange={(metric_value) =>
                  update({
                    highlights: patchItems(edit.highlights, item.id, {
                      metric_value,
                    }),
                  })
                }
              />
              <Field
                label="Status"
                value={item.status}
                onChange={(status) =>
                  update({
                    highlights: patchItems(edit.highlights, item.id, {
                      status,
                    }),
                  })
                }
              />
            </div>
            <Field
              label="事業の説明"
              multiline
              value={item.description}
              onChange={(description) =>
                update({
                  highlights: patchItems(edit.highlights, item.id, {
                    description,
                  }),
                })
              }
            />
            <label>
              期間
              <input
                type="month"
                required
                value={item.period}
                onChange={(e) =>
                  update({
                    highlights: patchItems(edit.highlights, item.id, {
                      period: e.target.value,
                    }),
                  })
                }
              />
            </label>
          </div>
        ))}
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            update({
              highlights: [
                ...edit.highlights,
                {
                  id: crypto.randomUUID(),
                  title: "新しい事業",
                  business_unit: "BUSINESS UNIT",
                  metric: "指標",
                  metric_value: "0",
                  description: "事業の進捗を入力してください。",
                  status: "In progress",
                  period: report.period,
                },
              ],
            })
          }
        >
          <Plus size={14} />
          Highlightを追加
        </button>
      </section>
      <section className="editor-section">
        <h2>04A · Investor Briefing</h2>
        <p>
          株主に伝える事実をテーマ別に記録します。将来情報は分類を選び、未入力のテーマは株主画面に表示しません。
        </p>
        {briefingTopics.map((topic) => {
          const stories = edit.briefing.filter(
            (story) => story.topic === topic.key,
          );
          return (
            <details className="editor-briefing-topic" key={topic.key}>
              <summary>
                {topic.label}
                <span>
                  {stories.length ? `${stories.length} 件` : "未入力"}
                </span>
              </summary>
              <p>{topic.prompt}</p>
              {stories.map((story) => (
                <div className="editor-subcard" key={story.id}>
                  <div className="editor-subcard-top">
                    <span>{topic.label}</span>
                    <button
                      type="button"
                      className="remove-button"
                      onClick={() =>
                        update({
                          briefing: edit.briefing.filter(
                            (item) => item.id !== story.id,
                          ),
                        })
                      }
                    >
                      削除
                    </button>
                  </div>
                  <Field
                    label="見出し"
                    value={story.title}
                    onChange={(title) =>
                      update({
                        briefing: patchItems(edit.briefing, story.id, {
                          title,
                        }),
                      })
                    }
                  />
                  <div className="form-field">
                    <label htmlFor={`story-kind-${story.id}`}>情報の種類</label>
                    <select
                      id={`story-kind-${story.id}`}
                      value={story.kind}
                      onChange={(event) =>
                        update({
                          briefing: patchItems(edit.briefing, story.id, {
                            kind: event.target.value as typeof story.kind,
                          }),
                        })
                      }
                    >
                      <option value="Actual">Actual · 実績</option>
                      <option value="Committed">Committed · 確約済み</option>
                      <option value="Forecast">Forecast · 見込み</option>
                      <option value="Pipeline">Pipeline · 進行中</option>
                    </select>
                  </div>
                  <Field
                    label="株主に伝える内容"
                    multiline
                    value={story.body}
                    onChange={(body) =>
                      update({
                        briefing: patchItems(edit.briefing, story.id, { body }),
                      })
                    }
                  />
                </div>
              ))}
              <button
                type="button"
                className="button secondary"
                disabled={edit.briefing.length >= 24}
                onClick={() =>
                  update({
                    briefing: [
                      ...edit.briefing,
                      {
                        id: crypto.randomUUID(),
                        topic: topic.key,
                        kind: "Actual",
                        title: "",
                        body: "",
                      },
                    ],
                  })
                }
              >
                <Plus size={14} />
                {topic.label}を追加
              </button>
            </details>
          );
        })}
      </section>
      <EventEditor
        event={edit.eventSpotlight ?? null}
        onChange={(eventSpotlight) => update({ eventSpotlight })}
      />
      <section className="editor-section">
        <h2>07 · Forward Indicators</h2>
        <p>
          Actualは計上済みの実績のみ。契約済み・見込み・商談はそれぞれ別の分類にします。
        </p>
        {edit.forward.map((item, i) => (
          <div className="editor-subcard" key={item.id}>
            <div className="editor-subcard-top">
              <span>Indicator {i + 1}</span>
              <button
                type="button"
                className="remove-button"
                onClick={() =>
                  update({
                    forward: edit.forward.filter((v) => v.id !== item.id),
                  })
                }
              >
                削除
              </button>
            </div>
            <div className="field-row">
              <Field
                label="指標名"
                value={item.title}
                onChange={(title) =>
                  update({
                    forward: patchItems(edit.forward, item.id, { title }),
                  })
                }
              />
              <label>
                情報の分類
                <select
                  value={item.kind}
                  onChange={(e) =>
                    update({
                      forward: patchItems(edit.forward, item.id, {
                        kind: e.target.value as typeof item.kind,
                      }),
                    })
                  }
                >
                  {["Actual", "Committed", "Forecast", "Pipeline"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="field-row">
              <Field
                label="指標の値"
                value={item.value}
                onChange={(value) =>
                  update({
                    forward: patchItems(edit.forward, item.id, { value }),
                  })
                }
              />
              <Field
                label="対象時期"
                value={item.timing}
                onChange={(timing) =>
                  update({
                    forward: patchItems(edit.forward, item.id, { timing }),
                  })
                }
              />
            </div>
            <Field
              label="指標の説明"
              multiline
              value={item.description}
              onChange={(description) =>
                update({
                  forward: patchItems(edit.forward, item.id, { description }),
                })
              }
            />
          </div>
        ))}
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            update({
              forward: [
                ...edit.forward,
                {
                  id: crypto.randomUUID(),
                  kind: "Pipeline",
                  title: "新しい将来指標",
                  value: "0 件",
                  description: "前提と不確実性を入力してください。",
                  timing: "未確定",
                },
              ],
            })
          }
        >
          <Plus size={14} />
          Indicatorを追加
        </button>
      </section>
      <section className="editor-section">
        <h2>08 · Risks & Actions</h2>
        {edit.risks.map((item, i) => (
          <div className="editor-subcard" key={item.id}>
            <div className="editor-subcard-top">
              <span>Risk {i + 1}</span>
              <button
                type="button"
                className="remove-button"
                onClick={() =>
                  update({ risks: edit.risks.filter((v) => v.id !== item.id) })
                }
              >
                削除
              </button>
            </div>
            <div className="field-row">
              <Field
                label="リスク名"
                value={item.title}
                onChange={(title) =>
                  update({ risks: patchItems(edit.risks, item.id, { title }) })
                }
              />
              <label>
                影響度
                <select
                  value={item.impact}
                  onChange={(e) =>
                    update({
                      risks: patchItems(edit.risks, item.id, {
                        impact: e.target.value as typeof item.impact,
                      }),
                    })
                  }
                >
                  {["高", "中", "低"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
            <Field
              label="リスクの説明"
              multiline
              value={item.description}
              onChange={(description) =>
                update({
                  risks: patchItems(edit.risks, item.id, { description }),
                })
              }
            />
            <Field
              label="対応するAction"
              multiline
              value={item.action}
              onChange={(action) =>
                update({ risks: patchItems(edit.risks, item.id, { action }) })
              }
            />
            <div className="field-row">
              <Field
                label="担当"
                value={item.owner}
                onChange={(owner) =>
                  update({ risks: patchItems(edit.risks, item.id, { owner }) })
                }
              />
              <Field
                label="対応期限"
                value={item.due}
                onChange={(due) =>
                  update({ risks: patchItems(edit.risks, item.id, { due }) })
                }
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            update({
              risks: [
                ...edit.risks,
                {
                  id: crypto.randomUUID(),
                  title: "新しいリスク",
                  impact: "中",
                  description: "リスクの内容を入力してください。",
                  action: "対応策を入力してください。",
                  owner: "経営管理",
                  due: "継続監視",
                },
              ],
            })
          }
        >
          <Plus size={14} />
          Riskを追加
        </button>
      </section>
      <section className="editor-section">
        <h2>09 · CEO Commentary</h2>
        <Field
          label="CEO 見出し"
          value={edit.ceoQuote}
          onChange={(ceoQuote) => update({ ceoQuote })}
        />
        <Field
          label="CEO コメント"
          multiline
          value={edit.ceoMessage}
          onChange={(ceoMessage) => update({ ceoMessage })}
        />
      </section>
    </>
  );
}
