# Prorium Monthly Shareholder Report

株式会社Proriumの株主向け月次レポート。2026年8月の完成サンプルと、毎月の文章入力・財務PDF共有・承認公開の管理画面を備えています。

**本番向けの実装とVercel専用環境を用意しています。専用DBは未接続のため、投資家向け運用はまだ開始できません。** 設置先と初期管理者は確認済みです。認証メール配送と専用OpenAIキーの安全な設定も必要です。開発環境の数値・資料・コメントは架空のサンプルです。

## ローカルで確認

Node.js 24を使用します。

```bash
npm ci
npm run dev
```

<http://localhost:3000/login> のデモボタンから株主・管理者の画面を確認できます。

| Demo identity | Email                    | Password     |
| ------------- | ------------------------ | ------------ |
| Investor      | investor@prorium.example | prorium-demo |
| Admin         | admin@prorium.example    | prorium-demo |

上記は公開された開発用アカウントです。実際の財務数値、PDF、認証情報を開発環境に入れないでください。PDFアップロードは同梱の架空サンプルだけを受け付けます。

## 毎月の更新

1. `/admin/reports` で対象月のレポートを作成。
2. 「今月あったこと」を普段の言葉や箇条書きで入力。スマートフォンの音声入力も利用できます。
3. サマリーの下書きを生成し、株主に伝える文章・CEOコメント・事業進捗・リスクを編集。
4. P/L、B/S、残高試算表などの確認済みPDFを添付。単月・累計・期末を明示できます。
5. プレビュー、レビュー、承認、公開。株主は公開済みのレポートと資料を閲覧・ダウンロードできます。

本番でOpenAIキーを設定するとAI生成を利用できます。キーがない場合は文章整理で下書きを作成します。AI生成は自動公開しません。月ごとのアーカイブと資料ライブラリを維持し、公開版は改訂しても残ります。

財務KPIの入力は任意です。未入力の月は架空の数値やゼロの実績を表示せず、月次サマリーと財務PDFを共有できます。手入力する場合は円単位の数値、前年同月、貸借の一致、増減理由を検証してSnapshotを保存します。

## 本番の構成

- Next.js / React / TypeScript、Supabase Auth・Postgres・private Storage。
- 招待された確認済みメールだけに株主権限を付与。管理者はMFA必須。
- RLSと現在のDB上の権限で認可。Investorは公開版・公開添付のみ取得できます。
- 管理者の原文は非公開。承認は本文と添付の正確なSnapshotを対象とします。
- 公開データ・財務Snapshot・添付オブジェクト・監査ログは更新禁止。
- Service Roleキーをアプリで使用しません。公開URLで財務PDFを共有しません。
- 本番でデモ認証を拒否し、Preview/Developmentには本番DBを接続しません。
- freeeの自動取込は未接続。現在は出力済みPDFの共有と手入力を利用できます。

[本番セットアップ・月次運用手順](docs/production-runbook.md) に環境変数、認証メール、管理者の初期設定、適用するMigration、公開前の確認を記載しています。

## Routes

`/login` · `/dashboard` · `/reports` · `/reports/[period]` · `/documents` · `/admin` · `/admin/reports` · `/admin/reports/[id]` · `/admin/import` · `/admin/investors` · `/account/security`

レポートPDFは `/api/reports/[period]/pdf`、添付PDFは `/api/documents/[id]`。どちらも認証・公開権限・キャッシュ禁止・監査記録を適用します。

## 検証

```bash
npm run check
npm run build
npm run test:e2e
```

型検査、Lint、16件のDomain/Repository/Postgres RLSテスト、Migration一致チェック、8件のBrowserテストで確認しています。Browserテストは3100番ポートと一時データを使い、本番に接続しません。詳細と検証の限界は [検証結果](docs/production-verification.md) を参照してください。

Mockデータは `.data/mock-store.json` に保存します。本番はSupabaseに永続化し、このローカルファイルを使いません。

```bash
# ローカルのビルド版を架空データで確認する場合だけ
PRORIUM_ENV=mock npm start
```

Mock PDF生成はシステムChromium（既定 `/usr/bin/chromium`）、本番は同梱のserverless Chromiumを使用します。フォントはローカルに同梱しています。Mockのポートを変更するときは `INTERNAL_APP_ORIGIN` も変更してください。

## 設計資料

- [Architecture / Database / Security / UI / Components](docs/architecture.md)
- [本番月次IR設計](docs/superpowers/specs/2026-10-05-production-monthly-ir-design.md)
- [本番実装計画](docs/superpowers/plans/2026-10-05-production-monthly-ir.md)
- [freee・AI接続アーキテクチャ](docs/freee-integration.md)
- [初期スキーマ](database/schema.sql) / [本番拡張](database/production.sql)
- [適用用Migration](supabase/migrations)
