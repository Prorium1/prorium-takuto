import Link from "next/link";
import { Shell } from "@/components/shell";
import { requireAdmin } from "@/lib/server/auth";
import {
  productionConfigured,
  productionConfiguration,
} from "@/lib/server/environment";
import { googleProviderEnabled } from "@/lib/domain/google-provider";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function LoginSettingsPage() {
  const actor = await requireAdmin();
  const config = productionConfigured() ? productionConfiguration() : null;
  const enabled = config ? await googleProviderEnabled(config) : false;
  const projectRef = config ? new URL(config.url).hostname.split(".")[0] : "_";
  const dashboard = `https://supabase.com/dashboard/project/${projectRef}/auth`;
  return (
    <Shell role={actor.role}>
      <div className={styles.page}>
        <Link className="simple-back" href="/admin">
          ← 経営者のホームに戻る
        </Link>
        <header className="page-heading">
          <span className="eyebrow">経営者用 · ログイン設定</span>
          <h1>Googleで入れるようにする</h1>
          <p>
            一度設定すると、登録済みの方はGoogleアカウントを選ぶだけで報告を見られます。
          </p>
        </header>
        <section
          className={styles.status}
          aria-label="Googleログインの設定状況"
        >
          <strong>
            {enabled
              ? "Googleの設定は有効です"
              : "Googleの設定は確認できていません"}
          </strong>
          <p>
            {enabled
              ? "別のブラウザで本番のログインページを開き、登録したメールアドレスのGoogleアカウントでお試しください。"
              : config
                ? "下の手順で設定を保存したあと、「設定状況を再確認」を押してください。"
                : "ここは確認用の環境です。設定とログインの確認は本番サイトで行います。"}
          </p>
          <a className="button secondary" href="/admin/login">
            設定状況を再確認
          </a>
        </section>
        <section className={styles.step}>
          <span>1</span>
          <div>
            <h2>Google側でログインの設定を作る</h2>
            <p>
              Google Auth
              Platformで、IR専用の「ウェブアプリケーション」のOAuthクライアントを作成します。
            </p>
            <a
              href="https://console.cloud.google.com/auth/clients"
              target="_blank"
              rel="noreferrer"
              className="button secondary"
            >
              Googleの設定を開く ↗
            </a>
            <dl>
              <dt>アプリ名</dt>
              <dd>Prorium Investor Relations</dd>
              <dt>承認済みのJavaScript生成元</dt>
              <dd>{config?.origin ?? "本番サイトのURL"}</dd>
              <dt>承認済みのリダイレクトURI</dt>
              <dd>
                {config
                  ? `${config.url}/auth/v1/callback`
                  : "SupabaseのGoogle設定に表示されるCallback URL"}
              </dd>
            </dl>
            <p>
              社外の投資家も使うため、対象ユーザーは「外部」にします。テスト中は利用するGoogleアカウントをテストユーザーに追加してください。
            </p>
            <p>
              データアクセスは本人確認用の openid・email・profile
              のみを指定します。
            </p>
          </div>
        </section>
        <section className={styles.step}>
          <span>2</span>
          <div>
            <h2>Supabaseに設定を保存する</h2>
            <p>
              Googleの設定で発行された「Client ID」「Client
              Secret」を、SupabaseのGoogle欄へ直接入力して有効化します。
            </p>
            <a
              href={`${dashboard}/providers?provider=Google`}
              target="_blank"
              rel="noreferrer"
              className="button secondary"
            >
              SupabaseのGoogle設定を開く ↗
            </a>
            <p>Client Secretはこの画面やチャットには貼り付けないでください。</p>
            <p>
              続けて、URL Configurationの「Redirect
              URLs」に次のURLを登録します。
            </p>
            <p className={styles.url}>
              {config
                ? `${config.origin}/auth/callback`
                : "本番サイトのURL/auth/callback"}
            </p>
            <a
              href={`${dashboard}/url-configuration`}
              target="_blank"
              rel="noreferrer"
            >
              ログイン後の戻り先を設定する ↗
            </a>
          </div>
        </section>
        <section className={styles.step}>
          <span>3</span>
          <div>
            <h2>登録したGoogleアカウントで入る</h2>
            <p>
              管理者は、現在登録されているものと同じメールアドレスで入ってください。今の管理権限を引き継げます。
            </p>
            <p>
              投資家はメールアドレスを登録すると、公開済みの報告を見られます。Googleアカウントを作っただけでは閲覧権限は付きません。
            </p>
            <Link className="button secondary" href="/admin/investors">
              閲覧する株主を登録する
            </Link>
          </div>
        </section>
      </div>
    </Shell>
  );
}
