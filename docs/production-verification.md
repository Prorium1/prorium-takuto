# 本番向け実装の検証

## 最新の夜間検証（2026-10-07 JST）

隔離ブランチ `codex/ir-overnight-readiness-20261006` で `npm run release:check` を実行。2026-10-06 18:18:15 UTCに全工程のexit 0を確認しました。

| 工程 | 結果 |
|---|---|
| TypeScript／Lint | 成功 |
| Domain／Repository／SQL／環境分離 | 24件成功、0件失敗 |
| 初期SQLとMigrationの一致 | 2本一致 |
| Next.js Production build | 成功 |
| Browser | 10件成功、0件失敗 |
| 本番未設定時の境界 | デモなし、保護routeはログインへ、PDFは401 |

証跡は `.data/release-check/2026-10-06T18-16-51-514Z/` の4工程ログと `results.json`。本番接続情報を子プロセスへ引き継がず、Next.jsが読み込むdotenvファイルが存在すると内容を読まず開始前に拒否し、架空データだけで検証しました。Node24のTypeScript module判別警告は表示されますが、全工程は成功しています。

AI失敗時の原文先行保存、生成中の別編集の保護、古いrevisionの外部API呼出し前の拒否、文章整理の代替操作、NULL／0／負数revision拒否、算定できないYoY、未保存の本文・原文の公開禁止を追加検証。複数行のCRLF／LFの違いによる誤った未保存判定も再現・修正し、375pxの月次入力からPDF添付・公開・旧添付の保持まで成功しています。

空白だけを編集した正常保存でも未保存制限が解除され、原文だけの保存では別の未保存本文を保持する追加Browser検証も成功。実装の検証対象はローカルcommit `f0241ab6f1264f0fa011604d581b54aa29b0f4ad`。以後の更新は手順と証跡の文書のみです。

実際のSupabase Auth／Storage／SMTP／OpenAI／認証済みVercel PDF／実機Safariは未検証です。独立したソース・SQL・スマホUXレビューの証跡はGit管理外に保存。セキュリティの確認は手動の範囲限定レビューで、利用できないホスト型スキャンを完了したとは扱いません。

## 過去の確認（初期実装・2026-10-06）

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

当時残したAIキー設定時の文章整理ボタン不足は、今回の隔離ブランチで修正しています。

最終検証ログは `/tmp/prorium-final-fixes-check.log`、`/tmp/prorium-final-fixes-browser.log`、`/tmp/prorium-final-fixes-build.log` に保存しています。ブラウザ検証は独立した架空データを使用しました。

## 再実行

```bash
npm ci
npm run release:check
```

検証専用の作業場所に `.env.example` 以外の `.env*` 設定ファイルを置かないでください。Next.jsによる自動読込を防ぐため、対象ファイルが存在すると内容を読まず、子プロセスを開始する前に中止します。実サービスの秘密情報を含む作業場所では、ファイルを削除せず別のクリーンなcheckoutで検証します。

BrowserテストにはシステムChromiumが必要です。ネットワーク・ソケット制限のある環境では、ローカルHTTPサーバーとBrowserのソケットを許可してください。

## まだ確認できていないこと

専用Supabase未作成のため、実際のAuth・Storage・PostgREST、Custom SMTP配送、OpenAI API、認証済みVercel Functionと最終URLの運用は未検証です。Vercel専用環境のREADYと未認証の境界確認は完了しています。PGliteはPostgresのRLSとTriggerを実行しますが、これら外部サービスを代替しません。

実際の公開前に [本番手順](production-runbook.md) の実URL確認を完了します。開発環境では実際の財務資料を使用していません。
# Vercelへの初回デプロイ確認（2026-10-06）

専用Vercelプロジェクト `prorium-shareholder-ir` を新設。ソースはPublicのGitHubへ転送せず、非公開のVercelビルドへ直接転送しました。PreviewとProductionのログイン画面はHTTP 200、nonce CSP・no-storeで応答し、ProductionにはMock表示・デモログインを出していません。専用Supabaseは未接続で、実際のログイン・月次更新・承認公開・Storage・SMTP・AI生成は未検証です。

初回のPDF APIは、Playwrightの `browsers.json` が自動トレースから欠落しているためモジュール読み込み時に500となりました。デプロイ対象ファイルだけを隔離コピーして同じエラーを再現し、このファイルをPDFルートに明示的に同梱する設定を追加しました。再ビルド後の隔離コピーではPlaywright・Chromiumの読み込みと8,291バイトのPDF生成が成功しました。修正版のProductionデプロイ `dpl_AFMs1U8UfKUSrESC72nVfj7khAwK` はREADY。実際のVercelで未認証PDFリクエストは401となり、モジュール読み込みの500を解消しました。認証後のレポートPDF生成は、本番DBとAuth接続後の検証項目です。
