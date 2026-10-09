"use client";
import { useActionState } from "react";
import {
  confirmEmailLinkAction,
  sendLoginLinkAction,
} from "@/app/auth-actions";
export function ProductionLogin() {
  const [state, action, pending] = useActionState(sendLoginLinkAction, {});
  const [confirmState, confirm, confirming] = useActionState(
    confirmEmailLinkAction,
    {},
  );
  return (
    <div className="demo-entry">
      <div className="demo-divider">
        <span>INVITATION ONLY</span>
      </div>
      <p>
        登録されたメールアドレスへ認証リンクを送ります。届いたメールの最新のリンクを一度開いてください。
      </p>
      <form action={action} className="login-form">
        <label>
          認証リンクの送信先
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <button className="button primary" disabled={pending}>
          {pending ? "送信中…" : "認証リンクを受け取る"}
        </button>
      </form>
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
      <details className="login-password-alternative">
        <summary>メールのリンクを開けない場合</summary>
        <form action={confirm} className="login-form email-confirmation-form">
          <label>
            メールの認証リンクを貼り付ける
            <input
              name="confirmationLink"
              type="url"
              autoComplete="off"
              maxLength={5000}
              placeholder="メール内のリンクをコピーして貼り付け"
              required
            />
          </label>
          <button className="button secondary" disabled={confirming}>
            {confirming ? "確認中…" : "リンクを確認してログイン"}
          </button>
        </form>
      </details>
      {confirmState.error && (
        <p role="alert" className="form-error">
          {confirmState.error}
        </p>
      )}
    </div>
  );
}
