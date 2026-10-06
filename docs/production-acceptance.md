# 本番受入チェックリスト

対象は専用 `prorium-shareholder-ir` のみ。実行は本番変更の承認後。現在のローカル検証を下記の成功証拠として扱わない。既存のProrium事業DBを検証先にしない。

## 1. 設置と変更の境界

- [ ] Supabase Project ID・組織・Tokyoリージョン・表示費用を確認。
- [ ] 対象DBが専用かつ空で、既存migration適用履歴がないことを確認。
- [ ] 初期SQL2本と非Git bootstrapをレビュー。NULL revisionを拒否する最新版を使用。適用済みなら初期migrationを上書きせず追加migrationへ変更する。
- [ ] Productionだけの環境変数。Preview／Devに本番キー・PDF・財務情報がない。
- [ ] publishable keyだけをアプリに設定。Service Role／Secretはアプリに設定しない。
- [ ] Backup/PITRとStorage実体の別バックアップ、復元方法、担当を確認。保持期間は未確定なら経営判断として残す。
- [ ] privateスキーマがData APIに公開されていない。公開schemaの明示的GRANTとRLSをAdvisorでも確認。

## 2. 本人認証とアクセス権

| ケース | 期待結果 | 残す証拠 |
|---|---|---|
| 未ログイン | Report／Document／PDF取得拒否、デモなし | URL・時刻・HTTP statusのみ |
| 未招待の確認済みメール | 財務・原文・Draftへのアクセス拒否 | Status、メール値やJWTのログなし |
| 管理者AAL1 | MFA設定のみ。原文・財務・編集・公開拒否 | 本人が操作、拒否結果 |
| 管理者AAL2 | 専用会社の月次編集のみ許可 | TOTP確認・対象会社ID |
| 招待済み株主 | Publishedのみ、admin／Draft／未公開PDF拒否 | 資料ID／Status |
| 取消済み株主 | 既存セッションでもReport／PDF再取得拒否 | 取消後のStatus |
| 別会社のIDを指定 | Recordを取得・変更できない | 改ざんIDとStatus、本文保存なし |
| Cross-origin POST | Action／Upload拒否 | OriginとStatus |

Supabase AuthのSite URLとProduction callbackを限定し、メール確認・TOTP・Anonymous無効を確認。Custom SMTPの外部メール受信を本人が確認。JWT・SMTPキー・パスワード・MFA secretを証跡に残さない。

## 3. 月次更新（検証利用者だけ）

1. 本番の専用環境で、実績と誤解されない運用検証用の架空レポートを作る。実際の株主へまだ権限を付与しない。検証履歴は公開Snapshotなので自動削除せず、運用担当が分離・取扱いを確認する。
2. 原文保存→再読込で内容が残る。原文はInvestorへSELECT不可。
3. 文章整理を実行。本文・要点・見通しを編集し、非公開情報を全表示箇所から除く。
4. 未保存の本文／原文がある時、プレビュー・レビュー・承認・公開が無効。保存すると有効。保存後も人の確認が必要。
5. 原文の保存中／生成中／添付処理中に別の編集・公開を進めない。二重クリック／古いrevision／NULL revisionは変更を上書きしない。
6. 任意のOpenAIキー設定後、実APIの正常出力・timeout／invalid出力／APIエラーを確認。エラー時に原文が残り、本文が変更されず、文章整理で継続できる。AIが未設定ならこの項目だけ未完了として残す。
7. P/L・B/S・残高試算表のPDFを添付。月、種類、単月／累計／期末、資料名、Hashとサイズが一致。DraftのURLは株主から拒否。
8. 財務未入力でゼロ実績やMock数値が出ない。任意の財務KPIを入力する時は、円単位、貸借一致、前年同月、増減理由を確認。
9. プレビュー→レビュー→承認→公開。承認後の本文／添付変更はDraftに戻る。
10. 投資家でHTML・レポートPDF・添付PDFを取得。添付は元PDFとSHA-256一致。日本語・ページ切れ・単位・対象月・版を確認。
11. Minor改訂を公開し、旧版の内容と旧添付PDFが変わっていない。
12. 権限取消→既存セッションで再取得拒否。ダウンロード済みファイルは回収できない。

## 4. 株主向けURLとVercel保護

現在はDeployment Protectionが有効。通常の株主がVercelチームへの加入なしで使える到達経路が必要。認証・RLS確認前に保護を外さない。

本人が承認したProductionだけの公開経路／保護設定を採用する。選択肢は確認済みの独自ドメイン、またはAuth・RLS検証後のProduction保護設定変更。Previewは保護を維持する。設定変更は明示した対象と復旧方法を確認してから実行する。

PDF内部ブラウザは `APP_ORIGIN` に限定され、アプリのCookieだけを持つ。Vercel保護画面が返る状態ではレポートPDFを成功扱いしない。保護のない正しい公開login経路でも、Report／DocumentはSupabaseの本人認証とRLSで保護されることを検証する。

## 5. スマホと復旧

- [ ] iPhone Safariで本人ログイン、TOTP、音声入力、原文保存、下書き編集、未保存警告、承認の操作位置を確認。
- [ ] PDFのFiles保存、戻る、再ログイン、月／種類の絞込を確認。
- [ ] 回線切断・API失敗・再読み込みで保存状況を確認して再試行。成功通知前の再送は古いrevisionを拒否する。
- [ ] Auth／SMTP／Function errorと監査ログを確認。原文・財務・JWT・キー値の漏れなし。
- [ ] app rollbackは確認済みの安全な版へ戻す。Migrationを逆向きに流して財務Snapshotを削除しない。

すべてのP0が実URLで確認できてから、最初の実際の月次報告を本人が承認し、株主へ権限を付与する。招待管理はアクセス権だけを登録し、現状はメール自動配信を行わない。
