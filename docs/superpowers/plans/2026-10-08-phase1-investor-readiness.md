# Phase 1 investor readiness implementation plan

**Goal:** Finish the existing August investor report with reliable financial comparisons, visible provenance and fresh local verification.

**Architecture:** Preserve Next.js server authorization, immutable report repository and existing database/RLS. Only mock execution; no production changes.

**Tech Stack:** Next.js 16, React 19, TypeScript, Node test, PGlite, Playwright.

**Spec:** ../specs/2026-10-08-phase1-investor-readiness.md

## Global constraints

- Synthetic data only; no remote database, deployment, credentials or live provider calls.
- Keep published snapshot content unchanged; display fixes must not rewrite reports.
- Investor sees published content only. Generation cannot approve or publish.
- Retain Actual / Committed / Forecast / Pipeline and separate AI revenue/efficiency.

## Review focus

- Zero/negative YoY baselines never become 0% growth.
- Zero, negative and singleton chart series have finite, in-bounds coordinates.
- Mock/manual/freee data and generated/human text use accurate attribution.
- Source and update time remain readable at mobile widths and in PDF.
- Existing auth/RLS/workflow gates and exports remain functional.

## Task 1 — Chart correctness

Files: `src/lib/domain/finance.ts`, `src/components/report/trend-chart.tsx`, `src/components/report/kpi.tsx`, `src/components/report/driver-bridge.tsx`, `tests/report-presentation.render.ts`.

- [x] Reproduce zero/negative chart and misleading YoY with regression tests.
- [x] Implement shared `financialChartScale(values, step)` and `yoyPresentation(current, previous)` helpers.
- [x] Use helpers in chart/KPIs, negative direction styling and explicit baseline explanation; handle empty/single-point histories and expose selected controls.
- [x] Run targeted regression then the existing suite.

## Task 2 — Provenance clarity

Files: `src/lib/domain/provenance.ts`, `src/components/report/report-provenance.tsx`, `src/components/report/report-view.tsx`, `src/app/globals.css`, `tests/report.spec.ts`.

- [x] Reproduce inconsistent generation attribution and assert manual/import/missing data status.
- [x] Add factual source/update/sync descriptions with JST time; share summary generation attribution.
- [x] Place provenance next to KPIs, review all viewport sizes and print.

## Task 3 — Verify and hand off

- [x] Run typecheck, lint, all domain/repository/RLS tests and migration check.
- [x] Run build, browser workflow/PDF tests and unconfigured production guard.
- [x] Inspect desktop/tablet/mobile screenshots and actual PDF; document limitations.
- [x] Record current evidence and leave a local mock preview available.

Verification evidence: [phase1-readiness.md](../../phase1-readiness.md). Native execution in this session; no deployment or external database changes.
