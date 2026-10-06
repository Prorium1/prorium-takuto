# 検証結果

検証日：2026-10-05。すべてSynthetic / Mock Dataで実施。外部DB、freee、本番環境への接続は行っていません。

| Check                            | Result     | 確認内容                                                                              |
| -------------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| TypeScript / ESLint              | PASS       | `npm run check` の型検査・Lint                                                        |
| Domain / Repository / PostgreSQL | 9 / 9 PASS | YoY、増減要因、月別データ整合、承認、改訂、認可、実際のRLS・Trigger                   |
| Next.js build                    | PASS       | `NEXT_DIST_DIR=.next/build npm run build`。指定の全Routeを生成                        |
| Browser acceptance               | 7 / 7 PASS | 認証、直接URL、Investor/Admin権限、9セクション、Chart、Archive、公開フロー、PDF       |
| Production guard                 | PASS       | 本番設定でDemoを非表示、保護RouteをLoginへRedirect、PDFを401で拒否                    |
| Responsive screenshots           | PASS       | 1440 / 768 / 375px。9セクション、横Overflowなし、Page Errorなし                       |
| Narrow mobile                    | PASS       | Browserテストで320pxを含むレイアウト・Menu操作を確認                                  |
| PDF inspection                   | PASS       | A4・6ページ、578,740 bytes、全9セクション、Mock表記、数値・日本語・改ページを目視確認 |

## 認可と公開の検証

- 未認証ではInvestor/Admin画面に入れず、PDFは401。
- InvestorのDraftへの直接アクセスとAdmin画面は404。署名改ざんCookieも拒否。
- 編集・生成・Importにより承認を解除。Human Reviewの前にApproveできず、承認済みの同一Content HashだけをPublish。
- 公開Reportを直接変更・再生成できない。改訂と再Importは新しいVersion / Financial Snapshotを作り、旧公開版を保存。
- 同時編集はRevisionによる競合チェック。AI生成はDraftのまま、人による公開操作が必要。
- PostgreSQLの実テストでDraft、内部Snapshot、Import、AI Draft、承認・監査情報をInvestorから隠し、Company分離、Grant失効、匿名アクセス、権限昇格、公開・Snapshot変更を拒否。
- PDFは認証された公開Versionだけを出力し、サーバーの固定loopback OriginとローカルFontを使用。

## レビューで修正した点

Independent reviewで、Import後のAI効率化指標と利益増減要因が一致しないケースを検出。9月の旧指標882,000円に対し、Import側の効率化要因は840,000円でした。失敗する回帰テストを追加し、Mock Providerが財務とは別の管理指標を供給するよう修正。AI RevenueのActual表示も合わせて更新し、再検証でPASS。

6・7月のArchiveと8月Chartが同じ月次実績を参照することも検証しています。表示用の初期Mock Storeは旧版を `.data/mock-store.initial-backup.json` に保存して再生成しました。ユーザーの編集がない初期Fixtureだけを更新しています。

## 再実行

```bash
npm run check
NEXT_DIST_DIR=.next/build npm run build
npm run test:e2e
node scripts/verify-production.mjs

# npm run dev が3000番で起動している状態で実行
node scripts/inspect.mjs
```

Browserテストは3100番・専用の一時Storeを使用。Production guardは3200番でビルド版を一時起動し、終了します。`inspect.mjs` はプレビュー画像と認証付きPDFを `artifacts/` に保存します。テスト出力と成果物はGit管理対象外です。

## 範囲の限界

この検証はMock版の動作と提案SQLのローカル実行を対象にしています。本番認証・SupabaseへのMigration適用・freee OAuth・実AI Provider・本番PDF運用は未実装です。Mockの単一プロセスJSON Store、公開Demo認証、開発用CSPを本番で使うことはできません。本番接続では独立DB、招待制認証、MFA、職務分離、Transactional Workflow、Production CSPが必要です。

30秒・3分という読了目標はUIの設計基準です。実際の株主による理解度・読了時間の計測はまだ行っていません。
