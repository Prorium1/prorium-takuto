import { Shell } from "@/components/shell";
import { requireAdmin } from "@/lib/server/auth";
import { isMockEnvironment } from "@/lib/server/environment";
import {
  productionClient,
  databaseError,
} from "@/lib/server/production-repository";
import { InvestorAccessForm } from "@/components/admin/investor-access";
import { InvestorCredentialsForm } from "@/components/admin/investor-credentials";
import { formatReportTimestamp } from "@/lib/domain/provenance";
import { investorInitialPassword } from "@/lib/server/investor-initial-password";
export const dynamic = "force-dynamic";
export default async function InvestorsPage() {
  const actor = await requireAdmin();
  const mock = isMockEnvironment();
  const shared = mock || investorInitialPassword() !== null;
  let invitations: {
    email: string;
    active: boolean;
    created_at: string;
    password_issued_at: string | null;
  }[] = [];
  if (!mock) {
    const client = await productionClient(actor, true);
    const { data, error } = await client.rpc("ir_list_investor_access", {
      p_company: actor.companyId,
    });
    databaseError(error);
    invitations = data || [];
  }
  return (
    <Shell role={actor.role}>
      <div className="investor-access-page">
        <div className="page-heading">
          <span className="eyebrow">経営者用 · 株主の登録</span>
          <h1>株主のログイン管理</h1>
          <p>
            {shared
              ? "投資家は、登録したメールアドレスと共通の初期パスワードでログインできます。"
              : "投資家ごとにパスワードを発行します。"}
            登録した方は、公開済みの報告と資料を閲覧できます。
          </p>
        </div>
        <ol className="investor-access-steps">
          <li>メールアドレスを登録</li>
          <li>案内文をコピー</li>
          <li>ご本人へ送る</li>
        </ol>
        <section className="admin-panel investor-register-panel">
          <h2>新しく登録する</h2>
          <p>
            {shared
              ? "メールアドレスを登録すると、共通の初期パスワードを設定します。"
              : "登録すると、専用のパスワードを自動で作ります。"}
          </p>
          <InvestorCredentialsForm mock={mock} shared={shared} />
          <details className="investor-email-alternative">
            <summary>メールのリンクだけで登録する</summary>
            <p>
              既にアカウントをお持ちで、メールのリンクで入る場合はこちらから登録できます。
            </p>
            <InvestorAccessForm mock={mock} />
          </details>
        </section>
        <section className="investor-access-list" aria-label="登録済みの株主">
          <h2>
            登録済みの株主 <small>{invitations.length}名</small>
          </h2>
          {!invitations.length && (
            <p>まだ登録されていません。上の入力欄から登録できます。</p>
          )}
          {invitations.map((i) => (
            <article className="investor-access-card" key={i.email}>
              <h3>{i.email}</h3>
              <p>
                <strong>{i.active ? "閲覧できます" : "アクセス停止中"}</strong>{" "}
                ·{" "}
                {i.password_issued_at
                  ? `パスワード発行：${formatReportTimestamp(i.password_issued_at)}`
                  : "パスワードは未発行"}
              </p>
              {i.active && (
                <details>
                  <summary>
                    {shared
                      ? "共通の初期パスワードに設定する"
                      : i.password_issued_at
                        ? "パスワードを再発行する"
                        : "パスワードを発行する"}
                  </summary>
                  <InvestorCredentialsForm
                    email={i.email}
                    issued={!!i.password_issued_at}
                    shared={shared}
                  />
                </details>
              )}
              <InvestorAccessForm email={i.email} active={i.active} />
            </article>
          ))}
          <p>
            アクセスを停止すると、次の閲覧・資料保存から利用できなくなります。
          </p>
        </section>
      </div>
    </Shell>
  );
}
