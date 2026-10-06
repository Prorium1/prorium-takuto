# 本番向け実装の検証

## 確認済み

- 型検査・Lint・16件のDomain/Repository/Postgres RLSテスト。
- 8件のBrowserテスト：旧Investor Report、認証、9セクション、アーカイブ、スマートフォン、レポートPDF、承認公開と改訂、セッション改ざん防止。
- 月次運用のBrowserテスト：数値未入力の新規月、原文からサマリー、PDF添付、下書きの添付を株主から拒否、CEOコメント、レビュー・承認・公開、公開PDF取得、資料ライブラリの月／種類絞り込み、375px画面、改訂で添付を外しても旧公開版の取得を維持。
- 本番SQLをPGliteで実行：AAL1／MFA情報欠落の管理者操作を拒否、AAL2管理者、メール確認済みの招待、未公開情報のRLS、未公開StorageのRLS、改訂と添付Manifest、不変公開版、権限取消、匿名RPC拒否、直接テーブル変更の拒否、不正な財務・レポート構造の検証。
- 設定ガード：Vercel ProductionのMock指定、Previewへの本番接続、Developmentでの本番接続、Secretキー、異常Originを拒否。
- 本番用のserverless Chromium 153をこの環境で起動し、有効なA4 PDFを生成（6,365 bytes、`%PDF-`署名）。
- Next.js本番ビルドと、未設定の本番モードでデモとデータ取得を拒否する確認。
- ビルド済みInvestor画面をモバイルサイズで操作し、Nonce CSP、JavaScriptのエラーなし、認証付きレポートPDF（579,364 bytes）、Chromiumの4つの同梱アーカイブを確認。

## 独立レビューと修正

独立したコードレビューで、メール変更後の権限取消、招待受諾と取消の競合、生成した要点・見通しの編集不足が見つかりました。受諾した招待をAuthのUser IDに結び付け、同じ招待行をロックし、現在の招待が有効な場合だけ閲覧権限を認めるよう修正しました。メール変更と取消後のGrant書込みを模擬した再現テストは修正前に失敗し、修正後に成功しています。実際の複数DB接続による並行実行はまだ検証していません。

サマリーの本文・要点・見通しをすべて編集／削除できるようにし、生成原文の非公開情報を削除してから公開するBrowserテストも成功しています。AI生成方法は公開時や原文のみの保存で上書きせず、実際の生成方法と人の承認状態を表示します。修正後に16件のテスト、8件のBrowserテスト、型検査、Lint、Migration一致チェックを再実行しました。

軽微なUI改善として、AIキー設定時に生成失敗後の文章整理ボタンがない点は残しています。本文・要点・見通しの手編集で公開内容を作成することはできます。

最終検証ログは `/tmp/prorium-final-fixes-check.log`、`/tmp/prorium-final-fixes-browser.log`、`/tmp/prorium-final-fixes-build.log` に保存しています。ブラウザ検証は独立した架空データを使用しました。

## 再実行

```bash
npm ci
npm run check
npm run build
npm run test:e2e
```

BrowserテストにはシステムChromiumが必要です。ネットワーク・ソケット制限のある環境では、ローカルHTTPサーバーとBrowserのソケットを許可してください。

## まだ確認できていないこと

本番プロジェクト未作成のため、実際のSupabase Auth・Storage・PostgREST、Custom SMTP配送、OpenAI API、Vercel Function、最終URLの運用をまだ確認できていません。PGliteはPostgresのRLSとTriggerを実行しますが、これら外部サービスを代替する動作確認にはなりません。

実際の公開前に [本番手順](production-runbook.md) の実URL確認を完了します。開発環境では実際の財務資料を使用していません。
# Vercelへの初回デプロイ確認（2026-10-06）

専用Vercelプロジェクト `prorium-shareholder-ir` を新設。ソースはPublicのGitHubへ転送せず、非公開のVercelビルドへ直接転送しました。PreviewとProductionのログイン画面はHTTP 200、nonce CSP・no-storeで応答し、ProductionにはMock表示・デモログインを出していません。専用Supabaseは未接続で、実際のログイン・月次更新・承認公開・Storage・SMTP・AI生成は未検証です。

初回のPDF APIは、Playwrightの `browsers.json` が自動トレースから欠落しているためモジュール読み込み時に500となりました。デプロイ対象ファイルだけを隔離コピーして同じエラーを再現し、このファイルをPDFルートに明示的に同梱する設定を追加しました。再ビルド後の隔離コピーではPlaywright・Chromiumの読み込みと8,291バイトのPDF生成が成功しました。修正版のProductionデプロイ `dpl_AFMs1U8UfKUSrESC72nVfj7khAwK` はREADY。実際のVercelで未認証PDFリクエストは401となり、モジュール読み込みの500を解消しました。認証後のレポートPDF生成は、本番DBとAuth接続後の検証項目です。
