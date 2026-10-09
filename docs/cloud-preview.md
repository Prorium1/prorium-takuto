# クラウド確認用デモ

対象: Vercel `prorium / prorium-shareholder-ir` の Preview のみ。
本番ドメインへの昇格や main への push は行わない。

## 動作

- `PRORIUM_ENV=mock` と `VERCEL_ENV=preview` で有効。
- サーバーは固定の架空レポートを読む。ファイルシステムに依存せず、編集・承認・公開などの全書き込みをRepositoryで拒否。
- 管理者デモの「振り返りを試す」から、質問に回答して公開用下書きを確認できる。非公開メモは除外。ブラウザ内の文章整理であり、実AIには未接続。ページ再読み込みで入力は消える。
- 株主デモは公開済みの架空レポートだけを閲覧できる。管理画面とDraftは404。
- PDFはレポートの「PDF保存 / 印刷」からブラウザで出力。クラウドPreviewではサーバーPDF APIが501を返す。ローカル・本番の既存PDF生成は変更しない。
- 本番用Supabase接続情報、実財務情報、OpenAIキーは渡さない。

## Previewログイン

サーバーレスの各インスタンスで同じデモ用Cookieを検証するため、`MOCK_SESSION_SECRET` が必要。暗号学的乱数32バイト以上を生成し、Vercel PreviewにのみSensitive環境変数として保存する。ソース、ログ、Development、Productionには値を保存しない。未設定・32文字未満ではログインを拒否する。Vercel上ではCookieにSecureを付ける。

2026-10-09: 実URLのデモログインで、Preview用署名キーの未設定によるエラーを確認。VercelのPreviewスコープに暗号学的乱数から生成したSensitive環境変数を登録し、再デプロイした。Productionには登録しない。設定前に作成されたDeployment URLは設定を取り込まないため、新しいDeploymentまたは更新されたブランチAliasを利用する。環境変数の変更後は、ログイン画面のGETだけでなく、デモボタンのPOST・レポート表示・再読み込みまで検証する。

## 検証

`npm run check`、`npm run test:e2e`、`npm run test:cloud-preview`。

クラウド専用ブラウザテストは隔離ポート3200で実行し、利用できない保存先でも動作すること、文章整理でPOSTが発生しないこと、非公開メモの除外、入力が再読み込みで消えること、株主のアクセス制御、スマートフォンの横はみ出し、印刷導線を確認する。テストの署名キーは合成値であり、Vercelへは登録しない。

2026-10-08: 型・Lint・Migration一致、24件のDomain/Repository/SQLテスト、9件の描画テスト、11件の通常Browserテスト、2件のクラウドPreview用Browserテストが成功（計46件）。最適化ビルドもMock Preview設定で成功。ローカル検証と外部デプロイの検証は別として記録する。

最適化したビルドをローカルで起動し、株主・管理者のログイン、振り返りの下書き表示、ブラウザPDF生成も確認。ブラウザの例外は0件。1440px / 375pxの画面はGit管理外の `artifacts/cloud-report-desktop.png` / `artifacts/cloud-report-mobile.png`、PDFは `artifacts/cloud-report-print.pdf`。

2026-10-09: 修正済みPreview `dpl_DxynvDAZWNJG6SKZ2U6RT7WNkiSC` の実URLでHTTPフローを検証。ログイン画面200、株主デモフォームPOST303、署名Cookie発行、8月レポート200、再読み込み200、株主から管理画面404を確認。レポート本文にInside Proriumが存在し、読み込みエラー表示はない。ローカルブラウザーから外部Vercel URLへの接続はネットワークプロキシで拒否されたため、Vercelの一時Sandboxから同じフォームとCookieを使って検証した。検証後にSandboxを停止し、一時アクセスリンクを失効。実URL上のブラウザー描画・PDF確認とは区別する。
