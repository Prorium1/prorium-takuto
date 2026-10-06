# Prorium Monthly Shareholder Report implementation plan

**Goal:** Complete an August 2026 report that investors can read in three minutes, with synthetic data and a runnable publication workflow.

**Architecture:** Next.js server-authorized pages, provider-independent domain models, mock-only repository and immutable published snapshots. Proposed Supabase RLS schema tested in embedded PostgreSQL; no external integration.

**Tech stack:** Next.js 16, React 19, TypeScript, Zod, Lucide, Playwright/Chromium, PGlite.

**Spec:** [architecture.md](architecture.md)

## Global constraints

- Synthetic data only, visible mock label on every report and PDF.
- Investor can read published versions only; no draft serialization to investor.
- Draft → review → approved → published, approval bound to content checksum.
- Published versions and financial snapshots immutable; revisions create new IDs/versions.
- Actual/Committed/Forecast/Pipeline are explicit and never mixed in actual totals.
- No production connection, deployment, credentials or real AI/freee calls.

## Review focus

1. Direct route/API access, not merely hidden admin links: deny draft and PDF access to investors.
2. Editing after review/approval must invalidate approval; publishing stale content must fail.
3. Re-import and revision cannot mutate published data; monthly driver totals must reconcile.
4. Japanese report at 375px and print must remain legible without horizontal overflow.
5. Tampered/expired sessions, invalid periods, unsupported imports and zero/negative YoY baselines must fail safely.

## Task 1 — Domain, authorization and mock repository

Files: `src/lib/domain/{types,finance,workflow,validation}.ts`, `src/lib/mock/seed.ts`, `src/lib/server/{environment,auth,repository}.ts`, `tests/domain.test.ts`.

- [x] Write meaningful failing tests for YoY baseline handling, reconciliation, workflow gates and immutability.
- [x] Implement typed financial/report snapshots, role guards and atomic local store.
- [x] Add login/logout Server Actions and reject mock mode in unconfigured production.
- [x] Run `npm test` and typecheck; expect successful domain tests.

Interfaces: `getPublishedReport(period, actor, version?)`, `listPublishedReports(actor)`, `getAdminReport(id, actor)`, `mutateReport(id, actor, expectedRevision, operation)`. Values are integer JPY. All reads receive a validated actor.

## Task 2 — Investor experience

Files: `src/components/shell.tsx`, `src/components/report/*`, `src/app/{login,dashboard,reports}/**`, `src/app/globals.css`.

- [x] Create typography, colors, spacing and responsive layout.
- [x] Implement four KPIs + provenance + executive summary and nine report sections.
- [x] Add chart comparison controls, anchor navigation, archive and version selection.
- [x] Inspect browser screenshots for desktop, tablet and 375px mobile. Expect no overflow, readable KPIs and no console errors.

Interfaces: `ReportView({report, preview?})` receives investor-safe snapshot data only. Archive lists published summaries only.

## Task 3 — Admin workflow and mock providers

Files: `src/app/admin/**`, `src/components/admin/*`, `src/lib/domain/providers.ts`, `src/app/actions.ts`.

- [x] Implement create/edit business highlights, forward indicators, risks and CEO commentary.
- [x] Implement deterministic AI draft adapter and synthetic import validation/snapshot.
- [x] Implement explicit submit-review/approve/publish and revision controls with optimistic concurrency.
- [x] Show audit events and honest source/analysis/review state.
- [x] Browser test full workflow, invalid transitions and unauthorized access. Expect no public AI output without approval.

Interfaces: providers return draft/snapshot data, never invoke publication. Server Actions return `{error}` or redirect after role/validation checks.

## Task 4 — SQL security and PDF

Files: `database/schema.sql`, `tests/rls.test.ts`, `src/app/api/reports/[period]/pdf/route.ts`, `src/app/reports/[period]/print/page.tsx`.

- [x] Write RLS behavior tests using mocked Supabase auth context in embedded PostgreSQL.
- [x] Define tables, read policies, immutable/approval triggers and append-only audits.
- [x] Add authorized PDF generation using local Chromium and local fonts.
- [x] Verify PDF signature, multiple pages, visible mock label and investor authentication.

## Task 5 — Final verification and handoff

Files: `tests/report.spec.ts`, `playwright.config.ts`, `README.md`, `docs/verification.md`.

- [x] Run typecheck, lint, unit/RLS tests, full build, and browser acceptance tests.
- [x] Fix observed functional or rendering issues, then repeat affected checks.
- [x] Document startup, demo identities, scope, production integration prerequisites and evidence.
- [x] Leave the local preview running and provide report/design links.
