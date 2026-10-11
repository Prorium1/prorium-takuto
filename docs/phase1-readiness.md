# Phase 1 — 2026年8月 Investor Report の確認

確認日：2026-10-08。対象：既存RepositoryのローカルMock版。Productionへの変更、外部DB接続、実財務データの利用、freee/APIモデルへのリクエストは行っていません。

## 成果物

- `http://localhost:3000/login` → 「株主としてデモを見る」→ `/reports/2026-08`。
- 管理者デモからレポート編集、Mock Import、Mock AI Draft、レビュー、承認、公開、改訂を操作可能。
- Desktop / Tablet / Mobileプレビュー：`artifacts/desktop-preview.png`、`artifacts/tablet-preview.png`、`artifacts/mobile-preview.png`。
- 認証付き出力の実PDF：`artifacts/Prorium-2026-08-v1.0.pdf`。A4・6ページ・580,688 bytes。9セクション、Mock表記、日本語、出典・更新時刻を確認。
- 上記成果物はMockデータのみを含み、Git管理対象外。

## 要件と実装

| 要件 | 確認した実装 |
| --- | --- |
| Architecture | Next.js Server Components → 認可済みRepository → immutable report。Mock/本番Providerを分離 |
| Database Schema | reports / report_versions / financial_snapshots / approval_events / analysis_runs / audit_logs / investor_grants。既存Migrationは今回変更なし |
| Security Model | page/action/repository/PDFで認可。PGlite上でRLS・MFA・Grant失効・Company分離・公開版不変性を実行検証 |
| UI Information Architecture | 4KPI、YoY、状態、Executive Summary、指定の9セクション、Archive、月・版選択 |
| Component Structure | ReportView / KpiGrid / TrendChart / DriverBridge / ReportProvenance / PdfButton。比較・出典のロジックはdomainへ分離 |
| Implementation Plan | [今回の設計](superpowers/specs/2026-10-08-phase1-investor-readiness.md) / [実装計画](superpowers/plans/2026-10-08-phase1-investor-readiness.md) |
| AI Transformation | AI as Revenue / AI as Efficiency。管理上の推定効率化と会計実績を区別 |
| Forward Indicators | Actual / Committed / Forecast / Pipelineを表示。将来情報を実績に合算しない |
| Workflow / Version / Audit | Draft → Human Review → Approve → Publish。編集で承認失効、公開版を改訂から保持。監査ログを記録 |
| freee / AI | Mock Providerと接続用Architecture。freee OAuth・自動同期は未接続。今回の文章生成はMockであり実モデル生成ではない |

## 今回の変更

- KPIの下にデータソース、JST更新日時、Mock / freee未接続を表示。手入力・未入力・取込済みの状態を区別し、同期実行の証跡がない場合に自動同期済みと表示しない。
- Executive Summaryと出典欄の生成方法を共通化。Mock解析を実AI生成と表示せず、実AI生成は人の承認後もAI assistedの履歴を維持。
- 前年がゼロ・赤字の場合は、増減率ではなく符号付き増減額と理由を表示。チャートの数値表で不明な比較を0%にしない。
- 減少時の色・矢印、増減要因見出しの「＋−」を修正。全ゼロ・負数・単一点・空のチャートを処理。
- チャートの指標・期間選択をaria-pressedで伝達し、各月をキーボードとタッチで選択可能に。
- 公開済みFixtureの数値・文章・ハッシュは変更していない。

## 検証結果

| Check | 結果 |
| --- | --- |
| TypeScript / ESLint / Migration一致 | PASS |
| Domain / Repository / Postgres RLS | 16 / 16 PASS |
| 表示回帰テスト | 9 / 9 PASS。修正前は9件とも失敗を確認 |
| Browser | 9 / 9 PASS。未認証・Investor/Admin・Archive・公開改訂・資料添付・PDF・Cookie改ざん・キーボード・タッチ |
| Next.js build | PASS |
| 本番未設定ガード（ローカル） | PASS。デモ非表示、保護画面307、PDF401、no-store |
| Responsive | 1440 / 768 / 375 / 320pxで横Overflowなし。1440 / 768 / 375pxの画面を保存 |
| PDF | 認証付きAPIから生成、PDF署名・A4・6ページ・全セクション・日本語・Mock表示を確認 |

## 再実行

```bash
npm ci
npm run check
NEXT_DIST_DIR=.next/build npm run build
npm run test:e2e
node scripts/verify-production.mjs
# 別Terminalで PRORIUM_ENV=mock npm run dev を起動した状態
node scripts/inspect.mjs
```

検証ログ：`/tmp/prorium-presentation-red.log`、`/tmp/prorium-readiness-check.log`、`/tmp/prorium-readiness-build.log`、`/tmp/prorium-readiness-browser.log`、`/tmp/prorium-readiness-preview.log`。

## 検証範囲

UIとMockワークフローを実行できる段階です。実Supabase Auth / PostgREST / Storage / SMTP、freee OAuth、実AIの運用、クラウドFunctionでの認証後PDF出力は今回接続・検証していません。RLSはローカルのPGliteで実SQLを実行しており、実運用環境の接続検証を代替しません。30秒・3分の読了目標は設計基準であり、株主を対象とする理解度テストは未実施です。
