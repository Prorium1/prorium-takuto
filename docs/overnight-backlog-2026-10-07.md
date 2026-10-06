# IR ローンチまでの作業分類 — 2026-10-07 JST

目的は、社長が毎月の出来事を入力し、人が確認したサマリーとP/L・B/S・残高試算表を、招待済み株主だけへ継続公開できること。最短ローンチは「文章＋確認済みPDF」。数値KPI・OpenAI・freee接続は段階的に追加できる。

A＝完了済み、B＝本人操作なしで実行可能、C＝本人操作・本番承認が必要、D＝後続。P0＝ローンチ必須、P1＝品質・事故防止、P2＝運用後、P3＝将来。実装済みでも実環境で未検証の項目は分ける。

## A. 完了済み

| 優先 | 作業 | 根拠／成果物 |
|---|---|---|
| P0 | 月・版・公開状態・会社を分離したレポートモデル | domain types／SQL／production repository |
| P0 | SSRの本人確認、DBの現行権限、管理者AAL2 | auth／Supabase adapter／RLS検証 |
| P0 | InvestorのPublished限定SELECT、Draft／原文拒否 | SQL policies／RLS検証 |
| P0 | 原文を管理者専用に保存する月次更新 | monthly actions／private.monthly_inputs |
| P0 | サマリー本文・要点・見通し・CEOコメントの編集 | report-editor／月次Browser検証 |
| P0 | レビュー→承認→公開、編集時の承認解除 | SQL RPC／workflow／content hash |
| P0 | 公開Snapshotと旧添付の不変性、改訂 | SQL triggers／revision／Browser検証 |
| P0 | private PDF、月／種類／単月・累計・期末 | document adapter／library／Storage policies |
| P0 | PDF取得の認証・認可・Checksum・監査記録 | documents route／SQL |
| P0 | 本番のMock拒否、Dev／Previewの本番接続拒否 | runtime guards／設定テスト |
| P0 | IR専用Vercel、Git連携、Production READY | 最新公開元 main de329e4／Vercel管理画面 |
| P1 | 2026年8月の9セクション完成サンプル | Investor Report／Mockのみ |
| P1 | 同月YoY、増減理由、実績・将来4分類 | domain finance／report components |
| P1 | 数値未入力の明示、架空ゼロ実績の抑止 | emptyReport／summary-only rendering |
| P1 | Nonce CSP・private no-store・HttpOnly cookie | proxy／Next headers／auth |
| P1 | 招待受諾と取消の競合防止、安定User IDとの関連 | invitation RPC／SQL検証 |
| P1 | Serverless ChromiumとPlaywrightのtrace修正 | next.config／既存deployment検証 |
| P1 | AI障害時も原文を先に保存、生成中の別編集を保護 | 今夜追加のmonthly-update検証 |
| P1 | AIありでも文章整理を選択可能、正確な処理中表示 | 今夜更新のmonthly form |
| P1 | 未保存本文・原文がある間のレビュー／承認／公開防止 | editing guard／スマホBrowser検証 |
| P1 | NULL／0／負数revisionでCASを抜けないSQL | 未適用初期SQL修正／再現テスト |
| P1 | 前年ゼロ・負数の増減率を算定不可表示 | finance／archive／chart table |
| P1 | 本番環境変数・dotenvを読み込まないローカル検証 | verification environment／release:check |
| P1 | 実装・セキュリティ・顧客UXの独立レビュー | 各レビューの保存済み証跡 |
| P1 | 明朝の本人操作リマインドを1件作成 | 2026-10-07 09:00 Asia/Tokyo |

## B. 今夜すぐできる

| 優先 | 小さな作業単位 | 扱い |
|---|---|---|
| P0 | 最新main／Vercel／専用DB有無を再調査 | 実行済み。Supabase専用IRは未作成 |
| P1 | 型・Lint・単体・RLS・Migration整合をまとめて検査 | release:checkに実装、検証結果は朝の資料へ |
| P1 | 本番ビルド、スマホでの保存／公開禁止／PDFを回帰検査 | 今夜の全体検証 |
| P1 | AI失敗・古いrevision・生成中編集の再現検証 | 原文保存の前後を実際のMock repositoryで検証 |
| P1 | 改訂後も旧PDFが取得できる検証 | 既存Browser検証を継続 |
| P1 | 初期migrationの対象・順序・適用前バックアップ条件整理 | production runbook／acceptance checklist |
| P1 | 本人操作を最短順にし、承認対象を具体化 | 朝の引き継ぎ資料 |
| P1 | 公開前ゲートとNO判定の理由を記録 | launch readiness |
| P1 | アプリ／権限／文書誤公開の復旧手順を整備 | rollback手順 |
| P1 | 毎月の原文・変化理由・課題・予定の入力テンプレート | monthly operations template |
| P1 | 秘密情報を含めないDraft PRと検証証跡を保存 | mainへマージせずレビュー可能にする |
| P1 | 最新実装を反映して古いArchitecture記述を訂正 | docs／README |
| P1 | 投資家・管理者・未招待者・取消済みの受入マトリクス | 実環境用acceptance checklist |
| P2 | 未添付PDFの再試行・重複・孤立オブジェクト仕様 | DB行とStorage実体の復旧を後続で設計。削除実行はしない |
| P2 | 全編集欄・添付入力の未保存検知を拡張 | 今夜の保護対象は本文／原文と処理中操作。財務・添付の入力中は別途拡張 |
| P2 | 金額入力の空文字と明示ゼロをサーバーでも区別 | UI requiredに加える検証強化候補 |
| P2 | タップ領域・資料の絞込ゼロ件文言・PDF失敗表示の改善 | 独立UXレビューのminor。重要修正を優先し後続へ |
| P2 | 原価・API usageの計測項目を設計 | 呼出数・token使用量・PDF時間。料金・上限は未確定config |
| P2 | アクセス／閲覧／DLの匿名化集計設計 | 監査ログと財務本文を分離し、実データのログ出力は避ける |
| P2 | 権限問い合わせ・PDF訂正のCS導線を整備 | 運用テンプレートへ。送信はしない |
| P2 | データ保持・孤立ファイル削除・退任者権限の手順草案 | 保持期間は会社承認待ち。公開版の自動削除は導入しない |
| P2 | 小規模株主向けのFAQ・資料取扱い文面草案 | 利用開始後の問い合わせに使用、法的条件は要承認 |

## C. 明日、本人の操作・承認が必要

| 優先 | 操作 | 完了条件 |
|---|---|---|
| P0 | Supabase Shimei.AIで専用IR作成、費用確認 | TokyoのProject IDが確定。既存24プロジェクトを変更しない |
| P0 | 専用DBに限定したmigration／bootstrapの承認 | 対象・SQL・空DB・順序・復旧策を確認して適用 |
| P0 | Custom SMTP・送信元ドメインの本人設定 | 実際に認証メールが配送される。キーは安全な環境変数入力のみ |
| P0 | Productionだけの接続設定と初期管理者本人MFA | 確認済みメール＋TOTPでAAL2、AAL1操作は拒否 |
| P0 | 本番コード公開と株主向け到達経路の承認 | 未認証は拒否／公開loginだけ到達可。保護設定を無断で解除しない |
| P0 | 実環境Auth／Storage／権限／PDF／旧版の受入 | architectureの制御と実URLの動作が一致する |
| P0 | 初回の実際の月次原文と確認済み財務資料の最終承認 | 架空データが実績として公開されない |
| P1 | 専用OpenAIキーを安全に設定 | 任意。未設定でも文章整理で開始可能。実APIの生成・失敗を確認 |
| P1 | iPhone Safariで音声入力・MFA・保存・PDF確認 | キーボード・操作位置・ダウンロード・戻る動作を実機で確認 |
| P1 | バックアップ／Storage保全／復元の確認 | DBバックアップとPDF実体がそれぞれ復元できる |
| P2 | 資料取扱い・守秘義務・保持期間の法務／経営承認 | 条件を捏造せず確定文面を採用 |

## D. 後続

| 優先 | 作業 | 着手条件 |
|---|---|---|
| P2 | freee OAuth→Validate→immutable Snapshotの実装 | 月次手動運用が安定、対象科目・期間・会社を確定 |
| P2 | 認証メール・株主招待・月次通知の配送自動化 | 送信元・再送・冪等性・取消・本人承認を確認 |
| P2 | 真の複数DB接続で競合・再送を検証 | 分離した検証環境の用意後 |
| P2 | PDFジョブのqueue／分散rate limit／キャッシュ | 実測で必要になった時。機密データの共有cacheは禁止 |
| P2 | AI出力token／予算configと実績usage監視 | 専用キーの実稼働後。料金を仮定しない |
| P2 | 障害時のアラート、メール配送失敗、復元演習 | 通知先・担当・権限が確定後 |
| P3 | 読者10／100／1,000／10,000人の負荷設計 | 現在はRLS＋transaction＋private Storage。実測して増強 |
| P3 | AI売上・効率化の指標追加 | 根拠、集計元、実績と推定、財務との整合が確定後 |
| P3 | Management OS・他Prorium事業への共通化 | 本Phase1のローンチを優先。原文→人の確認→公開テンプレートのみ先行共通化 |
| P3 | 公開LP・SEO・SNS・営業資料・料金・採用導線 | 機密IRとは別プロダクトの公開目的が決まった場合。現在のIRに公開財務SEOは不要 |

未確定の費用・API上限・性能・保持期間・法的条件は確定値として扱わない。今夜は本番DB変更・公開・秘密情報変更・実利用者への配送を実行しない。
