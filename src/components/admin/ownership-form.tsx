"use client";
import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  saveOwnershipAction,
  type OwnershipActionState,
} from "@/app/ownership-actions";
import {
  SHAREHOLDER_GROUPS,
  validOwnership,
  type OwnershipSnapshot,
  type ShareholderGroup,
} from "@/lib/domain/ownership";
import { OwnershipView } from "@/components/ownership-view";
import type { OwnershipImport } from "@/lib/domain/ownership-import";
import { formatReportTimestamp } from "@/lib/domain/provenance";
type InputRow = {
  group: ShareholderGroup;
  name: string;
  shareClass: string;
  shares: string;
};
const blank = (): InputRow => ({
  group: "founder",
  name: "",
  shareClass: "普通株式",
  shares: "",
});
export function OwnershipForm({
  id,
  revision,
  initial,
  mock = false,
  cloudPreview = false,
  imported = null,
  initialUnsaved = false,
}: {
  id: string;
  revision: number;
  initial: OwnershipSnapshot | null;
  mock?: boolean;
  cloudPreview?: boolean;
  imported?: OwnershipImport | null;
  initialUnsaved?: boolean;
}) {
  const [dirty, setDirty] = useState(initialUnsaved);
  const [confirmed, setConfirmed] = useState(false);
  const [expectedRevision, setExpectedRevision] = useState(revision);
  const [state, action, pending] = useActionState<
    OwnershipActionState,
    FormData
  >(async (previous, form) => {
    const result = await saveOwnershipAction(previous, form);
    if (result.success) {
      setDirty(false);
      if (result.revision) setExpectedRevision(result.revision);
    }
    return result;
  }, {});
  const [asOf, setAsOf] = useState(initial?.asOf || ""),
    [issued, setIssued] = useState(initial ? String(initial.issuedShares) : ""),
    [display, setDisplay] = useState<"grouped" | "named">(
      initial?.display || "named",
    ),
    [source, setSource] = useState(initial?.sourceLabel || ""),
    [notes, setNotes] = useState(initial?.notes || "");
  const [rows, setRows] = useState<InputRow[]>(
    initial?.rows.map((r) => ({ ...r, shares: String(r.shares) })) || [blank()],
  );
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const confirmNavigation = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const link =
        e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target === "_blank" ||
        link.hasAttribute("download")
      )
        return;
      const destination = new URL(link.href, window.location.href);
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      )
        return;
      if (
        !window.confirm(
          "株主構成の入力がまだ保存されていません。この画面を離れますか？",
        )
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", confirmNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", confirmNavigation, true);
    };
  }, [dirty]);
  const payload = {
    asOf,
    basis: "issued-shares",
    display,
    issuedShares: Number(issued),
    sourceLabel: source,
    notes,
    rows: rows.map((r) => ({
      ...r,
      name: display === "grouped" ? "" : r.name,
      shares: Number(r.shares),
    })),
  };
  const preview = validOwnership(payload);
  function markDirty() {
    setDirty(true);
    setConfirmed(false);
  }
  function loadImported() {
    if (
      !imported ||
      (dirty &&
        !window.confirm("未保存の入力を、取得済みの株主名簿で置き換えますか？"))
    )
      return;
    const s = imported.snapshot;
    setAsOf(s.asOf);
    setIssued(String(s.issuedShares));
    setDisplay(s.display);
    setSource(s.sourceLabel);
    setNotes(s.notes);
    setRows(s.rows.map((row) => ({ ...row, shares: String(row.shares) })));
    markDirty();
  }
  function changeRow(i: number, key: keyof InputRow, value: string) {
    setRows((old) => old.map((r, n) => (n === i ? { ...r, [key]: value } : r)));
    markDirty();
  }
  return (
    <div className="ownership-form-layout">
      <form action={action} className="ownership-form">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="revision" value={expectedRevision} />
        <input type="hidden" name="ownership" value={JSON.stringify(payload)} />
        <fieldset disabled={pending}>
          <legend>株主へ公開する株主構成を入力</legend>
          {imported && (
            <section
              className="ownership-source-import"
              aria-label="取得済みの株主名簿"
            >
              <span className="portal-chip">
                {mock
                  ? "Mockの取得サンプル · 未接続"
                  : "smartround · 管理者専用"}
              </span>
              <h2>取得済みの株主名簿</h2>
              <p>
                基準日 {imported.snapshot.asOf} · 発行済{" "}
                {imported.snapshot.issuedShares.toLocaleString("ja-JP")}株
              </p>
              <p>取得日時 {formatReportTimestamp(imported.retrievedAt)}</p>
              <p>
                名簿を取り込んだ時点の情報です。元資料を確認して、下書きへ保存してください。
              </p>
              <p>
                公開する名称・株主区分も確認してください。元データの区分が未設定の場合は「その他」で取り込みます。
              </p>
              <button
                className="button secondary"
                type="button"
                onClick={loadImported}
              >
                取得した名簿を読み込む
              </button>
            </section>
          )}
          <p className="ownership-form-note">
            株主名簿・資本政策表で確認した発行済株式を入力します。下書きの保存だけでは公開されません。
          </p>
          {mock && (
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                setAsOf("2026-08-31");
                setIssued("1000");
                setDisplay("named");
                setSource("Mockの確認用名簿");
                setNotes("すべて架空の数値です。");
                setRows([
                  {
                    group: "founder",
                    name: "Mock 創業株主A",
                    shareClass: "普通株式",
                    shares: "550",
                  },
                  {
                    group: "fund",
                    name: "Mock 投資家B",
                    shareClass: "普通株式",
                    shares: "450",
                  },
                ]);
                markDirty();
              }}
            >
              架空のサンプルを入れる
            </button>
          )}
          <div className="ownership-input-grid">
            <label>
              基準日
              <input
                type="date"
                required
                value={asOf}
                onChange={(e) => {
                  setAsOf(e.target.value);
                  markDirty();
                }}
              />
            </label>
            <label>
              発行済株式数
              <input
                type="number"
                required
                min="1"
                max="1000000000000"
                step="1"
                value={issued}
                onChange={(e) => {
                  setIssued(e.target.value);
                  markDirty();
                }}
              />
            </label>
            <label>
              株主への表示範囲
              <select
                value={display}
                onChange={(e) => {
                  setDisplay(e.target.value as "grouped" | "named");
                  markDirty();
                }}
              >
                <option value="named">氏名・法人名と保有状況を表示</option>
                <option value="grouped">株主区分ごとの集計</option>
              </select>
            </label>
            <label>
              元資料の名称
              <input
                required
                maxLength={120}
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  markDirty();
                }}
                placeholder="確認した株主名簿・資本政策表の名称"
              />
            </label>
          </div>
          <div className="ownership-editor-rows">
            {rows.map((r, i) => (
              <div className="ownership-editor-row" key={i}>
                <span className="ownership-row-number">{i + 1}</span>
                <label>
                  株主区分
                  <select
                    value={r.group}
                    onChange={(e) => changeRow(i, "group", e.target.value)}
                  >
                    {Object.entries(SHAREHOLDER_GROUPS).map(([key, label]) => (
                      <option value={key} key={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {display === "named" && (
                  <label>
                    公開する氏名・法人名
                    <input
                      required
                      maxLength={100}
                      value={r.name}
                      onChange={(e) => changeRow(i, "name", e.target.value)}
                    />
                  </label>
                )}
                <label>
                  株式の種類
                  <input
                    required
                    maxLength={80}
                    value={r.shareClass}
                    onChange={(e) => changeRow(i, "shareClass", e.target.value)}
                  />
                </label>
                <label>
                  保有株数
                  <input
                    type="number"
                    required
                    min="1"
                    max="1000000000000"
                    step="1"
                    value={r.shares}
                    onChange={(e) => changeRow(i, "shares", e.target.value)}
                  />
                </label>
                <button
                  className="text-button"
                  type="button"
                  disabled={rows.length === 1}
                  aria-label={`${i + 1}行目を削除`}
                  onClick={() => {
                    setRows((old) => old.filter((_, n) => n !== i));
                    markDirty();
                  }}
                >
                  削除
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="button secondary"
            disabled={rows.length >= 40}
            onClick={() => {
              setRows((old) => [...old, blank()]);
              markDirty();
            }}
          >
            内訳を追加
          </button>
          <p
            className={`ownership-total ${preview ? "" : "ownership-incomplete"}`}
          >
            内訳合計{" "}
            {rows
              .reduce((sum, r) => sum + (Number(r.shares) || 0), 0)
              .toLocaleString("ja-JP")}
            株 / 発行済 {Number(issued || 0).toLocaleString("ja-JP")}株
            {issued &&
            rows.reduce((sum, r) => sum + (Number(r.shares) || 0), 0) !==
              Number(issued)
              ? " · 合計を一致させてください"
              : ""}
          </p>
          <label>
            株主向けの補足（任意）
            <textarea
              maxLength={600}
              rows={3}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                markDirty();
              }}
            />
          </label>
          <label className="ownership-confirm">
            <input
              type="checkbox"
              name="confirmed"
              value="yes"
              required
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            元資料と数値を照合し、この表示範囲を株主へ公開する内容として確認しました。
          </label>
          <button
            className="button primary"
            disabled={!preview || cloudPreview}
          >
            {pending ? "保存しています…" : "株主構成を下書きに保存"}
          </button>
          {cloudPreview && (
            <p className="ownership-form-note">
              確認用デモではサンプルとプレビューのみ利用できます。入力は保存されません。
            </p>
          )}
        </fieldset>
        {state.error && (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        )}
        {state.success && !dirty && (
          <p className="form-success" role="status">
            {state.success}
          </p>
        )}
        {dirty ? (
          <p role="status" className="ownership-form-note">
            未保存の変更があります。保存してから内容確認へ進んでください。
          </p>
        ) : (
          <Link className="button secondary" href={`/admin/reports/${id}`}>
            レポートの内容確認・承認・公開へ進む
          </Link>
        )}
      </form>
      <aside className="ownership-form-preview">
        <p className="portal-chip">株主への表示プレビュー · 未公開</p>
        {preview ? (
          <OwnershipView snapshot={preview} />
        ) : (
          <div className="empty-state">
            <h3>入力後に表示を確認できます。</h3>
            <p>
              基準日・元資料・発行済株式数・内訳を入力してください。まだ数字は作成されていません。
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
