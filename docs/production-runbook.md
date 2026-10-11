# 本番セットアップと月次運用

## 現在の状態

コード、SQL、Migration、ローカル検証を用意しています。VercelのIR専用プロジェクトを新設し、非公開のソース転送でPreviewとProductionをビルドしました。本番URLは https://prorium-shareholder-ir.vercel.app 。VercelチームのDeployment Protectionを維持しています。Shimei.AI組織の専用Supabaseプロジェクト `acpwmxehprpcdyrsbfqe` にfreee非公開ステージと下書き昇格処理を含む6件のMigrationを適用し、RLSとStorage設定を検査しました。Vercel Productionには専用DBのURL・公開用キー・freeeのOAuth設定を登録済みです。初期管理者の招待レコードは登録済みですが、本人の初回ログインとMFAは未完了です。freeeコネクター経由で今期11月から9月の月次と10月9日までの暫定値を本番DBの非公開ステージに保存しました。取込候補は締め・科目の確認待ちで、レポート本文・株主公開版には反映されていません。管理者は `/admin/import` で締め・科目・固定費・増減理由を確認すると、完了月のみ非公開の下書きSnapshotへ反映できます。

Supabaseの「Shimei.AI」組織、Vercelの「prorium」チームにIR専用環境があります。既存サービスは変更しません。Supabase接続ツールの新設費用取得APIが利用できなかったため、プロジェクト作成と料金確認はDashboardで行いました。

Vercelの管理画面: https://vercel.com/prorium/prorium-shareholder-ir 。専用プロジェクトIDは `prj_RD97hbuPh4DU5Go4MwYZXInpjeQk`。Vercelでのソース公開設定は無効とし、Deployment Protectionを維持しています。GitHubの接続先はPublicです。ユーザーからコード公開の承認を受領し、確認済みの115ファイルを `main` に反映しました。Git連携によるProductionビルドもREADYです。公開対象はアプリの実装・SQL・Mockのみ。初期管理者設定、実際の財務情報、PDF、環境変数、APIキーをGitへ追加しません。

2026-10-08の変更では、Vercel Previewを保存しない確認用デモにしました。Previewでは架空の固定データだけを読み、Repositoryで全書き込みを拒否します。振り返りの文章整理はブラウザ内で行い、入力・非公開メモを送信・永続保存しません。実AIは未接続です。PDFはブラウザの印刷・PDF保存を利用します。月次更新・資料管理の実運用は専用Supabaseへ接続したProductionで確認します。設定・確認手順は [cloud-preview.md](cloud-preview.md) を参照してください。

## 環境の分離

DevelopmentとPreviewはMockのみ。本番と別の環境変数スコープにし、実際の財務データ、PDF、OpenAIキー、本番Supabase接続設定を渡さないでください。

本番はNode.js 24、`NODE_ENV=production`、`PRORIUM_ENV=production`。Vercel ProductionでMockモードを指定してもデモは有効になりません。Vercel Previewでは本番アダプターを有効にできません。未設定時は認証とデータ取得を拒否します。

## DB・Storageの設定

1. 専用Supabaseプロジェクト `acpwmxehprpcdyrsbfqe` は東京リージョンに作成済みです。
2. 次のMigrationを順番に適用済みです。既存サービスのDBに適用しないでください。
   - `supabase/migrations/20261009010730_prorium_report_baseline.sql`
   - `supabase/migrations/20261009010747_prorium_production_monthly_ir.sql`
   - `supabase/migrations/20261009010930_lock_down_auto_rls_helper.sql`
   - `supabase/migrations/20261009012909_freee_connection.sql`
   - `supabase/migrations/20261009021638_freee_staging.sql`
   - `supabase/migrations/20261009022645_promote_freee_stage.sql`
3. RLSと権限のAdvisorを実行します。`private` スキーマをData APIへ公開しません。公開スキーマには明示的なGRANTを使用します。
4. `ir-financial-documents` がprivate、PDFのみ、最大4 MiBであることを確認します。StorageオブジェクトのUPDATE/DELETE権限はアプリに与えません。
5. Backup/PITR、保持期間、DBアクセス担当を会社の運用に合わせて設定します。自動バックアップがStorageの実ファイルまで復元するとは仮定せず、ファイルのバックアップ・復元も確認します。

SQL原稿と初期Migrationの一致は `npm run db:migrations:check` で検査します。適用済みMigrationの変更・再生成は禁止です。次の変更は新しいMigrationで管理します。Supabase接続ツールが割り当てたDB上の管理番号に、リポジトリのファイル名を揃えました。

2026-10-09の確認では、14件のIRテーブルすべてでRLSが有効、匿名ロールには公開レポートテーブルへの直接SELECT権限がなく、PDF用Storage bucketは非公開・4 MiB上限・PDF限定です。Supabaseの自動RLS設定で作られた `public.rls_auto_enable()` の匿名・認証済みユーザーからの実行権限は3件目のMigrationで取り消しました。Security Advisorの残り2件は、RLSを有効にしたままポリシーを置かない管理者専用の `private` テーブルです。会社レコードはVercel Productionに設定済みの会社IDで登録済みです。財務データとレポートは未登録です。

`supabase/config.toml` はローカル開発用です。リモートの認証設定には自動反映されないため、次項を本番Dashboard/APIで設定します。

## 初期管理者と認証

管理者の確認済みメールを受け取ってから、次のコマンドで初期設定SQLを生成します。`PRORIUM_COMPANY_ID` はVercel Productionの既存設定と同じUUIDを使用します。メールはシェルの安全な環境変数入力で渡し、Gitへ保存しません。

```bash
# PRORIUM_INITIAL_ADMIN_EMAILを安全に設定してから実行
npm run db:bootstrap:prepare
```

このコマンドはDBに接続せず、アクセス権600の `.data/production-bootstrap.sql` を新規作成します。同じファイルがある場合は上書きしません。内容を確認し、専用本番DBにだけ適用します。出力された会社UUIDを `PRORIUM_COMPANY_ID` に使用します。ユーザー・パスワード・財務データはseedしません。

Supabase Authを以下のように設定します。

- Site URLは確定した `APP_ORIGIN`。
- Redirect URLは `https://確定ドメイン/auth/callback` のみ。ProductionにPreviewやlocalhostを許可しません。
- メール確認を有効にし、TOTP MFAの登録と検証を有効にします。JWTは15分を目安に設定します。
- Anonymous sign-inを無効にします。メールリンクによるユーザー作成は可能にし、IRへの権限は確認済みメールの招待で制御します。
- 本番用のCustom SMTPと送信ドメイン認証を設定し、実際の株主向け配送を確認します。Supabase標準メール配送はチーム外への配送が制限されるため、本番株主向け運用にそのまま使用できません。
- Authのメール送信制限、再送間隔、必要に応じたCAPTCHAを設定します。

初期管理者が登録メールからログインし、認証アプリでMFAを登録します。AAL1では管理者ロールの確認とMFA設定のみ可能です。財務データ・原文・編集操作はAAL2で取得できます。

Supabase標準の確認メールは `/auth/v1/verify` へ遷移します。メール送信は implicit flow とし、`/auth/callback` から `/auth/complete` へフラグメントを保って移動します。クライアントはフラグメントを即座に履歴から消し、トークンを同一オリジンのServer Actionに送信します。サーバーがSupabaseで本人を検証し、HttpOnly Cookieへセッションを保存し、確認済みメールの招待とMFAを要求します。メールリンクは一度だけ使用できます。リンクを開けない場合のみ、ログイン画面でリンクを開かずにコピーし、`verifyOtp` の代替フォームを使用します。サーバーは専用SupabaseプロジェクトのURL・トークン形式・種別を検証します。リンクやトークンをチャット・Issue・ログに貼らないでください。

`/admin/investors` で株主のメールを追加できます。株主にはIRのログインURLを案内し、本人がメールリンクでログインします。この管理画面は招待メールを自動送信しません。権限を取り消すと、現在のDBの権限に基づきレポート・資料へのアクセスを拒否します。

管理者の追加・取消はDBの信頼された運用担当者が行います。初期設定の招待だけ無効にしても既に作成された管理者Membershipは削除されないため、取消時は `private.admin_memberships` と管理者招待の双方を管理し、Authセッションも失効させます。

## Vercelの設定

IR専用プロジェクトを作成し、このRepositoryをNext.jsとして接続します。ビルドは `npm run build`、Node.js 24。Productionの環境変数にだけ以下を設定します。

| Variable                   | 内容                                                  |
| -------------------------- | ----------------------------------------------------- |
| `PRORIUM_ENV`              | `production`                                          |
| `SUPABASE_URL`             | 専用本番プロジェクトのHTTPS URL                       |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...`。Service Role/Secretは使用しない |
| `PRORIUM_COMPANY_ID`       | 確認済みの初期設定で作成したUUID                      |
| `APP_ORIGIN`               | 確定したHTTPSドメイン。末尾の`/`やパスは含めない      |
| `OPENAI_API_KEY`           | 専用キー。任意。秘密として保存、serverのみ            |
| `OPENAI_SUMMARY_MODEL`     | 既定 `gpt-5-mini`                                     |

`NEXT_PUBLIC_` を付けないでください。キーをGit、PR、チャット、ビルドログへ出力しません。OpenAIキーは専用作成の方針を受領していますが、ターゲット選択と安全な保存先の確認が未完了です。先にキーなしで運用する場合は文章整理モードになります。

Previewには `PRORIUM_ENV=mock` を設定し、架空データだけを使用します。本番接続情報はProductionスコープへ限定します。PDF生成を利用する本番Functionには、同梱Chromiumを実行できるメモリ（2 GiB目安）と60秒の実行時間が必要です。実際のVercelプランで制限を確認します。

PDF生成は `APP_ORIGIN` の印刷ページを同じ利用者のCookieで取得します。Vercel Deployment Protectionを本番に設定する場合は、この内部アクセスを確認してください。認証バイパストークンを実装していないため、Deployment ProtectionのHTMLが返る構成ではPDF生成が失敗します。IRの閲覧はアプリの認証・RLSで制御します。

## 公開前に実際のURLで確認

- 未ログインのレポート・資料取得が拒否され、ログイン画面にデモボタンがない。
- 管理者がメールを受信してログインし、MFAを経て月次レポートを作成できる。
- 実データを使う前に本番で運用検証用の架空レポートを作り、原文保存、生成、編集、添付、レビュー、承認、公開を確認する。実際の株主へ権限を付与する前に検証専用の利用者だけで行う。
- 異なる株主／未招待者がDraftや未公開資料を取得できない。
- 公開後のレポートPDFと添付PDFをスマートフォン・PCから取得できる。
- 文書の単月／累計、対象月、版、Checksumが一致する。
- 公開後に改訂し、旧版と旧資料を保持できる。権限取消後は再取得できない。
- 実際のOpenAI API生成を設定済み専用キーで確認し、エラー時に自動公開されない。
- 監査ログ、Auth/Functionエラー、SMTP配送、バックアップを運用担当者が確認できる。

ローカルテストの成功だけを本番認証・Storage・SMTP・AI・Vercelの動作確認と扱いません。

## 毎月の作業

ローカルに追加した振り返り機能と現在の接続状況は [月次振り返り](./monthly-reflection.md) を参照してください。追加分はまだ本番にデプロイしていません。

1. 対象月を作成し、出来事・売上/利益の変化理由・課題と対策・AI効果・来月の見通しを入力して保存します。未検証の見立ては専用欄へ、AIにも株主にも渡したくない内容は「非公開メモ」へ記入します。
2. サマリーと「Why It Changed」の下書きを生成。良かった点・課題・変化の理由・来月の予定を確認し、文章とCEOコメントを編集します。AIの出力も必ず人が確認します。
   本文に加え、要点と見通しも編集・削除できます。生成した下書きには入力原文が引用されるため、非公開情報がすべての表示箇所から除かれていることを確認します。
3. freeeなどからP/L、B/S、残高試算表をPDFで出力して添付します。対象月、単月／累計／期末、説明を明示します。
   freee OAuth接続の設定手順は [freee連携](./freee-integration.md) に記載しています。接続だけでは財務KPIの自動取込は始まりません。
4. 必要なら財務KPIと前年同月の数値、増減理由を入力します。未入力のKPIは表示しません。
5. プレビュー → レビュー → 承認 → 公開。編集・添付変更は承認を解除します。
6. 修正はMinor/Major改訂を作成し、同じ流れで公開します。旧版や旧PDFを置き換えません。

新規レポートの作成、添付、公開、権限変更、レポートPDF出力、財務PDF取得は監査ログに記録されます。ダウンロード済みのファイルを権限取消で回収する機能はありません。投資家に守秘義務と資料の取扱いを案内してください。
