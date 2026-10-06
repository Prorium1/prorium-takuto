# 2026-10-07 朝のIR引き継ぎ

**今すぐ株主向けローンチ：NO。** 月次サマリー・資料PDF・権限制御の実装はありますが、専用Supabase／認証メール配送／本番の運用検証が残っています。本人がPCなしでも進められる修正と、公開前の検証・手順を保存しました。

## ① 現在地

対象：Prorium Monthly Shareholder Report。最新の実装・GitHub main・Vercel・Supabaseプロジェクト一覧を2026-10-06夜UTC（10-07未明JST）に再確認。

- GitHub：`Prorium1/prorium-takuto`。main `de329e425362da78e8da3baefc626031755a53a2`。
- Vercel：`prorium-shareholder-ir`、Production `dpl_B1ftwdJ6Q9R2qBt2hocodGVstZnc` READY、上記mainのソース。 https://prorium-shareholder-ir.vercel.app 。Deployment Protectionを維持。
- Supabase：Shimei.AIに24プロジェクト。**専用IRは未作成**。既存事業は変更していない。
- 本人指定済みの初期管理者を登録するSQLは、元の作業場所のGit管理外に準備済み。DB未適用、Authアカウント未作成。
- 今夜の変更は `codex/ir-overnight-readiness-20261006` に隔離。mainへのマージ／本番公開／DB適用／秘密情報変更は行っていない。

## ② 今夜完了したこと

1. 原文を管理者専用へ先に保存し、AI停止・timeout・不正出力でも原文を保持。以前のサマリーを勝手に置き換えない。
2. AIキーが設定済みでも文章整理を選択可能。保存／AI生成／整理の処理中表示を区別。
3. 古い画面はAI呼出し前に拒否。生成中に別の編集が保存された時も、その編集を上書きしない。
4. 未保存の本文・要点・見通し・事業・リスク・CEOコメント・原文がある間は、プレビュー／レビュー／承認／公開を停止。編集を保存すると既存承認を解除。
5. SQLの `revision=NULL` が競合チェックを抜ける問題を再現・修正。0／負数も拒否。未適用の初期Migrationとの一致を保持。
6. 前年値ゼロ／負数の増減率を「算定不可」に修正。減収を正方向の色・矢印に固定しない。
7. 本番環境変数・dotenvを読み込まない `npm run release:check` を追加。型・Lint・SQL・ビルド・ブラウザ・未設定本番の拒否をまとめ、証跡をGit管理外へ保存。
8. 実装・セキュリティ・モバイルUXを独立した視点で再確認。375／390pxで主要KPIと入力・資料取得を確認。
9. 明朝9:00 Asia/Tokyoの本人操作リマインドを1件設定。他事業の既存リマインドは変更していない。

## ③ 作成・更新した成果物

- [P0〜P3／A〜D作業分類](overnight-backlog-2026-10-07.md)
- [実URLでの本番受入チェックリスト](production-acceptance.md)
- [毎月の入力・確認・問い合わせテンプレート](monthly-operations-template.md)
- [本番セットアップと月次運用](production-runbook.md)
- [検証結果と限界](production-verification.md)
- `scripts/release-check.mjs`、`scripts/verify-production.mjs`、月次更新・未保存検知・SQL修正・回帰テスト。

独立レビュー・スマホ画面・実行ログは `.superpowers/sdd/overnight-launch-readiness/` と `.data/release-check/` に保存。秘密情報や実際の財務資料はGitへ保存しない。

## ④ commit / PR / ファイル

作業場所：`/workspace/prorium-ir-overnight`。元の `/workspace/prorium-takuto` は変更前のまま保持。

変更ブランチ：`codex/ir-overnight-readiness-20261006`。主要修正のローカルcommitは `9720e7df1daf21eaf255e062b8d41f4666fa98f1`、最終レビュー修正は `f0241ab6f1264f0fa011604d581b54aa29b0f4ad`。GitHubでは既存mainを親に同じソースtreeを保存し、ソースの一致を確認する。PRをマージするとGit連携でProductionへ反映されるため、今夜はマージしない。

## ⑤ テスト結果

`npm run release:check`：型・Lint・24件のテスト・Migration2本の一致・Production build・Browser10件・未設定本番の拒否がすべて成功。詳細は [production-verification.md](production-verification.md)。個別の修正は先に失敗を再現し、修正後に成功を確認。

- AI失敗時の原文保持、生成中編集、文章整理、古いrevisionの4件。
- NULL revisionのSQL再現と修正後の拒否。
- 未定義YoY率をゼロ％にしない検証。
- 本番資格情報を検証へ継承せず、dotenvを内容読込前に拒否する検証。
- 正規化で内容が同じになる保存の制限解除と、原文保存時の別の未保存本文保持。
- 390pxの未保存編集→公開禁止→保存→承認解除、原文の再読込保持。

実際のSupabase Auth／Storage／PostgREST、SMTP、OpenAI、認証済みVercel PDF、実機Safariは未検証。ローカル成功でこれらのP0を閉じない。

## ⑥ 残っているP0

専用DBの作成・適用、Productionだけの接続と本人認証・メール配送、承認後の本番反映と株主の到達経路、実URLでの権限／PDF／月次受入、最初の実際の内容の本人承認。

## ⑦ 明日、本人が行う最短の操作順

| 順 | 開く場所／本人の操作 | AIに戻す内容／完了条件 | やってはいけないこと |
|---|---|---|---|
| 1 | [Supabase新規作成](https://supabase.com/dashboard/new/qsbakmnuufropnxzqktz)。Shimei.AIで専用 `prorium-shareholder-ir`、Tokyo。表示費用を確認して作成 | Project IDだけを送り「専用DB作成済み、接続を確認して」。専用・空DBの確認をAIが行う | 既存DBの流用・変更、パスワードをチャットに貼る |
| 2 | AIの対象DB確認後、最新初期SQL2本＋Git管理外bootstrapの適用を承認。Vercel Productionの安全な設定欄とSupabase Authで接続・Custom SMTPを設定 | 「この専用DBへの適用と設定を承認」。AIがSQL／RLS／Storage／環境の整合を確認。秘密値入力とドメイン認証は本人が行う | 他DBへのmigration、Previewへ本番キーをコピー、Secret／Service Roleをアプリへ設定 |
| 3 | 本人のメールで初期管理者ログイン→認証アプリTOTP。Draft PRと受入手順を確認し、最新コードの本番反映・Productionの到達経路を承認 | 「MFA完了、最新変更の本番反映を承認」。AIが認証・権限を検証し、必要な保護設定変更は対象を具体化してから実行 | Auth／RLS確認前の保護解除、検証前の実株主招待や一斉通知 |
| 4 | AIの実環境検証後、iPhone Safariで入力→保存→確認→承認とPDF保存を確認。実際の当月原文と確認済みP/L・B/S・残高試算表を登録・最終承認 | 「スマホ確認済み、初回内容を承認」。すべてのP0が通ってから利用開始 | 架空値や未確認資料の公開、原文の非公開情報を下書きに残す |

**専用OpenAIキーはP1・任意。** 既に新規作成の方針は決まっている。安全なキー設定画面で専用キーを作り、Productionのサーバー用環境だけへ登録。キー値をチャット／PR／Gitへ貼らない。未設定でも文章整理と人の編集で月次運用を開始できる。

## ⑧ 本番へ進む正しい順番

専用DBと対象確認 → migration／bootstrap承認・適用 → Production設定・SMTP → 本人メール確認・AAL2 → 最新コードの本番反映承認 → 未招待者／Draft／取消済みの拒否検証 → 承認したProduction到達経路で認証付きPDFを検証 → 改訂・旧版・監査・復元確認 → 実機Safari → 最初の実内容を本人承認 → 株主にアクセス権を付与。

OpenAIは並行設定可能、freee自動取込は後続。株主はVercelチームに加入しなくても使える到達経路にする。認証・RLS確認前にDeployment Protectionを外さない。

## ⑨ ロールバック方法

- 今夜の変更：Draft PRをマージせず保持すればProductionは現在の `de329e4`／`dpl_B1ftwdJ6Q9R2qBt2hocodGVstZnc` のまま。
- 本番反映後のアプリ障害：新規公開を停止し、確認済みの互換版へVercel rollback。必要ならProduction保護を戻す。現在の未接続ビルドを、接続後の「正常運用版」と仮定しない。
- DB：自動down migrationや公開Snapshot削除は行わない。影響範囲を確認してforward fix、または承認済みBackup/PITR復元。Storageの元PDFは別途保全・復元する。
- 資料誤公開：権限範囲を止め、監査記録を保全し、本人／信頼された運用担当者が対応判断。公開済み履歴やログを直接改変しない。ダウンロード済みPDFは回収できない。

## ⑩ 既知のリスク

1. 実サービス受入が未完了。特にCustom SMTP配送・AAL2・private Storage・Production内部PDFレンダリング。
2. Vercel保護HTMLが返る構成ではレポートPDFが失敗する。実際の株主向けURLで確認が必要。
3. PreviewのMockはローカルファイル・プロセス内sessionであり、サーバーレスの永続編集を保証しない。
4. アップロード中断時のpendingオブジェクト回収と重複制御は後続。再送前に添付一覧を確認する。
5. 実際の複数DB接続による競合、バックアップ復元、実機Safariは未確認。
6. 今夜の未保存検知は本文と原文、処理中操作を対象とする。財務入力・未添付ファイルの入力中検知の拡張は後続。
7. AI出力は必ず人が確認。未設定時は文章整理。API料金・予算・上限・保持期間を捏造していない。
8. 添付PDFは不変の元ファイル。レポートPDFは公開内容を現在のアプリで描画し、将来のテンプレート変更まで同じバイト列を保証するものではない。

## ⑪ ローンチ準備度

工程チェックの目安は**75%**。16工程のうち、設計・レポートUI・原文保存・編集・権限実装とSQL検証・承認・文書保護・PDF同梱・版管理・ローカル全体検証・運用手順・独立レビューの12工程を完了条件とする。残り4工程は専用DB、実認証／SMTP、本番設定と反映、実URL・実機受入。P0が残っている間は利用開始しない。

## ⑫ 今すぐローンチ可能か

**NO。** 最短クリティカルパスは次の5項目。

1. 専用Supabaseを作成し、対象を確認。
2. 承認済みSQLとProduction接続・SMTPを設定。
3. 初期管理者の本人認証・TOTP、最新コードの本番反映を承認。
4. 権限・月次更新・認証付きPDF・旧版・実機Safariの受入を完了。
5. 初回の実際の月次原文・確認済み財務PDFを本人が承認し、株主へ権限を付与。
