import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/login-form";
import { getActor } from "@/lib/server/auth";
import { googleProviderEnabled } from "@/lib/domain/google-provider";
import {
  isMockEnvironment,
  productionConfiguration,
  productionConfigured,
} from "@/lib/server/environment";

export const dynamic = "force-dynamic";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const actor = await getActor();
  if (actor) redirect(actor.role === "admin" ? "/admin" : "/dashboard");
  const { reason } = await searchParams;
  const productionEnabled = productionConfigured();
  const googleEnabled = productionEnabled
    ? await googleProviderEnabled(productionConfiguration())
    : false;
  return (
    <main className="login-page">
      <section className="login-story">
        <Brand />
        <div className="login-story-main">
          <span className="eyebrow">株主専用の報告ページ</span>
          <h1>
            会社のいまが、
            <br />
            ひと目でわかる。
          </h1>
          <p>
            売上と利益、事業の進み具合、これからの見通し。
            <br />
            Proriumからのご報告をまとめて確認できます。
          </p>
          <ul className="login-benefits">
            <li>会社の状況を知る</li>
            <li>報告書を保存・印刷する</li>
            <li>株主構成を確認する</li>
          </ul>
        </div>
        <span className="login-copyright">
          © 2026 Prorium Inc. · Investor Relations
        </span>
      </section>
      <section className="login-panel">
        <div className="login-panel-inner">
          <span className="eyebrow">ご本人の確認</span>
          <h2>報告を見るためにログイン</h2>
          <p className="login-intro">
            案内されたメールアドレスとパスワードを入力してください。
          </p>
          {(reason === "oauth" ||
            reason === "access" ||
            reason === "platform") && (
            <p role="alert" className="form-error">
              {reason === "platform"
                ? "Proriumのログイン連携を完了できませんでした。プラットフォームのマスターアカウントでログインして、もう一度お試しください。"
                : reason === "oauth"
                  ? "Google認証を完了できませんでした。もう一度お試しください。"
                  : "認証を完了できませんでした。新しい認証リンクでお試しください。"}
            </p>
          )}
          <LoginForm
            mockEnabled={isMockEnvironment()}
            productionEnabled={productionEnabled}
            googleEnabled={googleEnabled}
          />
          {productionEnabled && (
            <details className="login-platform-entry">
              <summary>経営者・管理者の方はこちら</summary>
              <a
                className="button secondary"
                href={`${productionConfiguration().origin}/auth/platform`}
              >
                Proriumプラットフォームから管理画面へ
              </a>
              <p className="login-helper">
                登録済みのマスターアカウントで、そのまま管理・編集できます。
              </p>
            </details>
          )}
        </div>
      </section>
    </main>
  );
}
