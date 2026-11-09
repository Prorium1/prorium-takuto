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
  const mockEnabled = isMockEnvironment();
  const googleEnabled = productionEnabled
    ? await googleProviderEnabled(productionConfiguration())
    : false;
  const platformEntry = productionEnabled && (
    <section className="login-platform-entry" aria-label="経営者のログイン">
      <h3>経営者の方</h3>
      <a
        className="button secondary"
        href={`${productionConfiguration().origin}/auth/platform`}
      >
        Proriumプラットフォームから入る
      </a>
      <p className="login-helper">
        マスターアカウントで、実際の数字や作成中の報告を確認・編集できます。
      </p>
    </section>
  );
  return (
    <main
      className={`login-page${productionEnabled ? " login-production" : ""}`}
    >
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
          <span className="eyebrow">
            {productionEnabled ? "本番の報告ページ" : "確認用デモ"}
          </span>
          <h2>報告を見るためにログイン</h2>
          <p className="login-intro">
            {mockEnabled
              ? "画面と操作を確認するためのデモです。実際の財務情報は含まれません。"
              : googleEnabled
                ? "Googleアカウントを選ぶだけで入れます。新しいパスワードは不要です。"
                : "経営者の方はプラットフォームから、株主の方はご案内のログイン情報で入れます。"}
          </p>
          {(reason === "oauth" ||
            reason === "access" ||
            reason === "not-invited" ||
            reason === "platform") && (
            <p role="alert" className="form-error">
              {reason === "platform"
                ? "Proriumのログイン連携を完了できませんでした。プラットフォームのマスターアカウントでログインして、もう一度お試しください。"
                : reason === "oauth"
                  ? "Google認証を完了できませんでした。もう一度お試しください。"
                  : reason === "not-invited"
                    ? "このアカウントには閲覧権限がありません。ご案内を受け取ったメールアドレスのアカウントで入り直してください。未登録の場合は、Proriumの担当者へ登録をご依頼ください。"
                    : "ログインを完了できませんでした。もう一度お試しください。メールで入る場合は最新のリンクを開いてください。"}
            </p>
          )}
          {!googleEnabled && platformEntry}
          {productionEnabled && !googleEnabled && (
            <h3 className="login-email-heading">メールアドレスで入る方</h3>
          )}
          <LoginForm
            mockEnabled={mockEnabled}
            productionEnabled={productionEnabled}
            googleEnabled={googleEnabled}
          />
          {googleEnabled && platformEntry}
          {productionEnabled && !googleEnabled && (
            <p className="login-provider-note">Googleログインは準備中です。</p>
          )}
        </div>
      </section>
    </main>
  );
}
