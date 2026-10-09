"use client";
import { useActionState, useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { enterDemoAction, loginAction } from "@/app/actions";
import { ProductionLogin } from "./production-login";

export function LoginForm({
  mockEnabled,
  productionEnabled = false,
  googleEnabled = false,
}: {
  mockEnabled: boolean;
  productionEnabled?: boolean;
  googleEnabled?: boolean;
}) {
  const [state, action, pending] = useActionState(loginAction, {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const passwordForm = (
    <form action={action} className="login-form">
      <label>
        メールアドレス
        <input
          type="email"
          name="email"
          autoComplete="username"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={!mockEnabled && !productionEnabled}
        />
      </label>
      <label>
        パスワード
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="パスワードを入力"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={!mockEnabled && !productionEnabled}
        />
      </label>
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      <button
        className="button primary"
        disabled={pending || (!mockEnabled && !productionEnabled)}
      >
        {pending ? "認証中…" : "ログイン"}
        <ArrowRight size={17} />
      </button>
    </form>
  );
  return (
    <>
      {productionEnabled && !mockEnabled ? (
        <>
          <ProductionLogin googleEnabled={googleEnabled} />
          <details className="login-password-alternative">
            <summary>パスワードでログインする場合</summary>
            {passwordForm}
          </details>
        </>
      ) : (
        passwordForm
      )}
      {mockEnabled ? (
        <div className="demo-entry">
          <div className="demo-divider">
            <span>MOCK EXPERIENCE</span>
          </div>
          <p>実際の財務情報を含まない、開発用デモです。</p>
          <form action={enterDemoAction}>
            <input name="role" type="hidden" value="investor" />
            <button className="button secondary">
              株主としてデモを見る
              <ArrowRight size={16} />
            </button>
          </form>
          <form action={enterDemoAction}>
            <input name="role" type="hidden" value="admin" />
            <button className="text-button">
              管理者デモを開く
              <ArrowRight size={14} />
            </button>
          </form>
        </div>
      ) : !productionEnabled ? (
        <p className="form-error">
          本番認証は未接続です。Mock環境で起動してください。
        </p>
      ) : null}
      <div className="login-secure">
        <LockKeyhole size={13} />
        アクセス権を付与された株主・管理者専用
      </div>
    </>
  );
}
