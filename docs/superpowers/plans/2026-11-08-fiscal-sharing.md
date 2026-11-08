# Fiscal investor sharing implementation plan

> Execute sequentially with the existing test-first and review workflow.

**Goal:** Allow an owner to review an annual report, publish it to authorized investors, and export the same snapshot as PDF.

**Architecture:** Add an immutable annual publication table and explicit workflow RPCs. Reuse the existing fiscal renderer with a redacted data projection, aggregate organization block and investor audience mode.

**Tech stack:** Existing Next.js, React, Zod, Supabase/Postgres, Playwright and PGlite.

**Spec:** `docs/superpowers/specs/2026-11-08-fiscal-sharing-design.md`

## Global constraints

- Mock-only development; no real financial, employee or shareholder data in Git.
- Investor SELECT is limited to their company's published snapshots.
- Actual, unclosed, missing, targets and reference scenarios retain their labels.
- Human review and exact-version approval precede publication.

## Review focus

Cross-tenant reads; direct RPC publication without approval; editing after approval; accidental private links in client props/PDF; roster registration misrepresented as confirmed headcount.

## Tasks

- [x] Add `fiscal-publication.ts` domain schemas and tests for safe source projection, unknown counts and exact-revision transitions.
- [x] Add SQL migration and PGlite authorization tests for draft visibility, workflow, stale revisions and immutable published snapshots.
- [x] Add server repository/actions, Mock persistence and annual admin editor with explicit preview/review/approve/publish actions.
- [x] Add investor route, PDF/print routes, staffing view and published dashboard/library links; test authenticated isolation and PDF generation.
- [x] Verify build, existing checks and browser tests at mobile/desktop; review changes before release.
- [x] Deploy the additive schema and stage the confirmed source privately in Production.
- [ ] Deploy the UI and verify the canonical Production deployment.
- [ ] Owner reviews the prepared snapshot, approves its exact version, and publishes through the authenticated workflow.

## Verification

- TypeScript, ESLint, 77 domain/database tests and 22 render tests pass.
- SQL covers tenant isolation, nested private-field rejection, financial consistency, refresh recovery, stale revisions, approval reset and immutable publication.
- Browser checks cover investor draft denial, annual publication, PDF generation, mobile readability and ownership-source selection.
- Build passes; mock PDF visually inspected, including full-yen monthly P/L/B/S tables and month-level closing/receipt evidence.
- Review findings addressed before release. Real source data and staffing values are not included in this repository.
