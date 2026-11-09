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
      <ol className="login-steps">
        <li>メールアドレスを入力します。</li>
        <li>届いたメールのリンクを押すと、報告を見られます。</li>
      </ol>
      <form action={action} className="login-form">
        <label>
          登録済みのメールアドレス
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <button className="button primary" disabled={pending}>
          {pending ? "送信中…" : "ログイン用のメールを受け取る"}
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
        <summary>メールのリンクが開けない場合</summary>
        <p>
          まだ開いていない最新のリンクだけをコピーしてください。開いた後のリンクは再利用できません。
        </p>
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
