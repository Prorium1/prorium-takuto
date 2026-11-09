"use client";
import { useId, useState, useTransition } from "react";
import { issueInvestorPasswordAction } from "@/app/investor-actions";
import {
  investorInvitationText,
  type InvestorCredentials,
} from "@/lib/domain/investor-credentials";

function CredentialResult({
  credentials: c,
  onDismiss,
  sample,
}: {
  credentials: InvestorCredentials;
  onDismiss: () => void;
  sample: boolean;
}) {
  const passwordId = useId();
  const [visible, setVisible] = useState(false),
    [copyStatus, setCopyStatus] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(investorInvitationText(c));
      setCopyStatus(
        "案内文をコピーしました。ご本人へのメールなどに貼り付けて送ってください。",
      );
    } catch {
      setCopyStatus(
        "コピーできませんでした。下の「案内文を開く」から文章を選択してコピーしてください。",
      );
    }
  }
  return (
    <section
      className="investor-credential-result"
      aria-label="発行したログイン情報"
    >
      <h3>{sample ? "確認用のログイン情報" : "パスワードを発行しました"}</h3>
      <p>
        この画面を閉じると、パスワードは再表示できません。案内文をコピーして、投資家ご本人へお送りください。
      </p>
      <dl>
        <div>
          <dt>ログインURL</dt>
          <dd>
            <a href={c.loginUrl}>{c.loginUrl}</a>
          </dd>
        </div>
        <div>
          <dt>メールアドレス</dt>
          <dd>{c.email}</dd>
        </div>
      </dl>
      <div className="password-field">
        <label htmlFor={passwordId}>発行したパスワード</label>
        <div className="password-input">
          <input
            id={passwordId}
            type={visible ? "text" : "password"}
            value={c.password}
            readOnly
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          >
            {visible ? "隠す" : "表示"}
          </button>
        </div>
      </div>
      <div className="credential-actions">
        <button type="button" className="button primary" onClick={copy}>
          案内文をコピー
        </button>
        <button type="button" className="button secondary" onClick={onDismiss}>
          ログイン情報を閉じる
        </button>
      </div>
      {copyStatus && <p role="status">{copyStatus}</p>}
      <details>
        <summary>案内文を開く</summary>
        <textarea
          aria-label="投資家に送る案内文"
          value={investorInvitationText(c)}
          readOnly
          rows={10}
          autoComplete="off"
          onFocus={(e) => e.currentTarget.select()}
        />
      </details>
      <p className="credential-note">
        メールは自動送信されません。
        {sample && "こちらは架空のデモアカウントです。"}
      </p>
    </section>
  );
}
export function InvestorCredentialsForm({
  email,
  issued = false,
  mock = false,
}: {
  email?: string;
  issued?: boolean;
  mock?: boolean;
}) {
  const [credentials, setCredentials] = useState<InvestorCredentials | null>(
    null,
  );
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  function issue(form: FormData) {
    setError("");
    startTransition(async () => {
      try {
        const result = await issueInvestorPasswordAction(form);
        if (result.credentials) setCredentials(result.credentials);
        else
          setError(
            result.error || "発行できませんでした。もう一度お試しください。",
          );
      } catch {
        setError(
          "通信を完了できませんでした。登録一覧を確認してから、再度お試しください。",
        );
      }
    });
  }
  if (credentials)
    return (
      <CredentialResult
        credentials={credentials}
        onDismiss={() => setCredentials(null)}
        sample={mock}
      />
    );
  return (
    <div className="investor-credential-form">
      <form action={issue}>
        {email ? (
          <input type="hidden" name="email" value={email} />
        ) : (
          <label>
            投資家のメールアドレス
            <input
              type="email"
              name="email"
              maxLength={254}
              autoComplete="off"
              placeholder="investor@example.com"
              required
              disabled={mock || pending}
            />
          </label>
        )}
        <input
          type="hidden"
          name="mode"
          value={email ? (issued ? "reset" : "issue") : "create"}
        />
        {email && (
          <label className="credential-confirm">
            <input
              type="checkbox"
              name="acknowledged"
              value="yes"
              required
              disabled={pending || mock}
            />
            新しいパスワードを発行し、ご本人に伝えます。以前のパスワードは使えなくなります。
          </label>
        )}
        <button
          className={`button ${email ? "secondary" : "primary"}`}
          disabled={pending || mock}
        >
          {pending
            ? "パスワードを発行しています…"
            : email
              ? issued
                ? "新しいパスワードを発行"
                : "パスワードを発行"
              : "登録してパスワードを発行"}
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {mock && !email && (
        <div className="credential-sample">
          <p>確認用の画面です。本番の投資家情報は入力しないでください。</p>
          <button
            type="button"
            className="button secondary"
            onClick={() =>
              setCredentials({
                email: "investor@prorium.example",
                password: "prorium-demo",
                loginUrl: new URL("/login", window.location.origin).href,
              })
            }
          >
            発行後のサンプルを見る
          </button>
        </div>
      )}
    </div>
  );
}
