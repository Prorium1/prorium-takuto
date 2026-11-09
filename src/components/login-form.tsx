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
  const [showPassword, setShowPassword] = useState(false);
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
      <div className="password-field">
        <label htmlFor="login-password">パスワード</label>
        <div className="password-input">
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            placeholder="パスワードを入力"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            maxLength={256}
            disabled={!mockEnabled && !productionEnabled}
          />
          <button
            type="button"
            aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? "隠す" : "表示"}
          </button>
        </div>
      </div>
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
      {mockEnabled ? (
        <>
          <div className="demo-entry demo-entry-primary">
            <form action={enterDemoAction}>
              <input name="role" type="hidden" value="investor" />
              <button className="button primary">
                株主としてデモを見る
                <ArrowRight size={17} />
              </button>
            </form>
            <form action={enterDemoAction}>
              <input name="role" type="hidden" value="admin" />
              <button className="button secondary">
                管理者デモを開く
                <ArrowRight size={16} />
              </button>
            </form>
            <p>
              画面の数字は確認用のサンプルです。実際の財務情報は含まれません。
            </p>
          </div>
          <details className="login-demo-credentials">
            <summary>メールアドレス・パスワード入力も試す</summary>
            <p className="login-helper">
              デモのメールアドレス：investor@prorium.example
              <br />
              パスワード：prorium-demo
            </p>
            {passwordForm}
          </details>
        </>
      ) : (
        passwordForm
      )}
      {productionEnabled && !mockEnabled && (
        <details className="login-password-alternative">
          <summary>パスワードがわからない方・メールのリンクで入る</summary>
          <ProductionLogin googleEnabled={googleEnabled} />
        </details>
      )}
      {!mockEnabled && !productionEnabled ? (
        <p className="form-error">
          本番認証は未接続です。Mock環境で起動してください。
        </p>
      ) : null}
      <div className="login-secure">
        <LockKeyhole size={13} />
        {mockEnabled
          ? "確認用サンプルデータの画面です"
          : "アクセス権を付与された株主・管理者専用"}
      </div>
    </>
  );
}
