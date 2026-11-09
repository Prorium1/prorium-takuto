import { Shell } from "@/components/shell";
import { requireAdmin } from "@/lib/server/auth";
import {
  isMockEnvironment,
  productionConfigured,
  productionConfiguration,
} from "@/lib/server/environment";
import { googleProviderEnabled } from "@/lib/domain/google-provider";
import Link from "next/link";
import {
  productionClient,
  databaseError,
} from "@/lib/server/production-repository";
import { InvestorAccessForm } from "@/components/admin/investor-access";
import { InvestorCredentialsForm } from "@/components/admin/investor-credentials";
import { formatReportTimestamp } from "@/lib/domain/provenance";
export const dynamic = "force-dynamic";
export default async function InvestorsPage() {
  const actor = await requireAdmin();
  const mock = isMockEnvironment();
  const googleEnabled = productionConfigured()
    ? await googleProviderEnabled(productionConfiguration())
    : false;
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
            {googleEnabled
              ? "投資家のGoogleアカウントのメールアドレスを登録します。登録した方だけが、公開済みの報告と資料を閲覧できます。"
              : "投資家ごとにパスワードを発行します。登録した方は、公開済みの報告と資料を閲覧できます。"}
          </p>
        </div>
        <ol className="investor-access-steps">
          <li>メールアドレスを登録</li>
          <li>{googleEnabled ? "ログインページを案内" : "案内文をコピー"}</li>
          <li>ご本人へ送る</li>
        </ol>
        <section className="admin-panel investor-register-panel">
          <h2>新しく登録する</h2>
          {googleEnabled ? (
            <>
              <p>Googleで入る場合、パスワードの発行は不要です。</p>
              <InvestorAccessForm mock={mock} />
              <p>登録後、ご本人に本番のログインページをお知らせください。</p>
              <p>
                <a href={`${productionConfiguration().origin}/login`}>
                  {productionConfiguration().origin}/login
                </a>
              </p>
              <details className="investor-email-alternative">
                <summary>パスワードを発行して案内する</summary>
                <InvestorCredentialsForm mock={mock} />
              </details>
            </>
          ) : (
            <>
              <p>登録すると、専用のパスワードを自動で作ります。</p>
              <InvestorCredentialsForm mock={mock} />
            </>
          )}
          {!googleEnabled && (
            <details className="investor-email-alternative">
              <summary>Google・メールのリンク用に登録する</summary>
              <p>
                メールアドレスを登録します。Googleは連携設定が完了すると利用できます。
              </p>
              <InvestorAccessForm mock={mock} />
              <Link href="/admin/login">Googleログインの設定を確認する →</Link>
            </details>
          )}
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
                    {i.password_issued_at
                      ? "パスワードを再発行する"
                      : "パスワードを発行する"}
                  </summary>
                  <InvestorCredentialsForm
                    email={i.email}
                    issued={!!i.password_issued_at}
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
