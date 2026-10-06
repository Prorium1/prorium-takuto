"use client";
import { useActionState } from "react";
import { sendLoginLinkAction } from "@/app/auth-actions";
export function ProductionLogin() {
  const [state, action, pending] = useActionState(sendLoginLinkAction, {});
  return (
    <div className="demo-entry">
      <div className="demo-divider">
        <span>INVITATION ONLY</span>
      </div>
      <p>登録されたメールアドレスへ認証リンクを送信します。</p>
      <form action={action} className="login-form">
        <label>
          認証リンクの送信先
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <button className="button secondary" disabled={pending}>
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
    </div>
  );
}
