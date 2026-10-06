# Production Monthly IR Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for native implementation and a final independent review.

**Goal:** Deliver a deployable, invitation-authorized monthly reporting portal with monthly narrative updates and private financial PDFs.

**Architecture:** Keep the mock repository as a separate adapter. Supabase SSR Auth and user-token RPCs provide a transactional production adapter under RLS; private immutable documents are attached to approved versions. No runtime service-role key is used.

**Tech Stack:** Existing Next.js/TypeScript, Supabase SSR/JS, PostgreSQL, Storage, Chromium and Playwright.

**Spec:** [Production monthly investor reporting](../specs/2026-10-05-production-monthly-ir-design.md)

## Global constraints

- No real financial data or production credentials in development.
- Admin requires current membership and AAL2; investors only see publications.
- Source notes, pending documents and AI drafts are admin-only.
- Approval covers exact content and document manifest; publication and objects are immutable.
- No invented financial values, automated publication or public file URLs.
- External infrastructure selection and API-key creation remain pending owner answers.

## Review focus

1. Revoked investor or cross-company document ID must not reveal files.
2. AAL1 admin or editable JWT metadata must not authorize database mutations.
3. Concurrent uploads/edits and publishing must preserve the approved document manifest.
4. Empty finance must not show zero actuals; a narrative-only month must be publishable.
5. Deployment with missing configuration or an accidental mock flag must expose no real or mock financial data.

## Task 1 — Production data and authorization

Files: `src/lib/server/{environment,supabase,auth,production-repository}.ts`, `src/lib/server/repository.ts`, `src/proxy.ts`, `database/production.sql`, `tests/production-rls.test.ts`.

Interfaces: existing repository exports; `createSupabaseClient()`, `ir_current_actor(company)`, transaction RPCs `ir_create_report`, `ir_revise_report`, `ir_save_report`, `ir_transition_report`.

- [ ] Add failing SQL tests for current grants, AAL2, atomic creation, optimistic edits and immutable publication.
- [ ] Implement SSR verified users, MFA, conditional runtime selection and transactional RPC adapter.
- [ ] Test the real SQL under authenticated roles; preserve all mock tests.

## Task 2 — Monthly narrative and truthful financial data

Files: `src/lib/domain/{types,monthly,validation}.ts`, `src/components/admin/monthly-update.tsx`, `src/components/admin/financial-entry.tsx`, `src/app/actions.ts`, report/admin pages.

Interfaces: `saveMonthlyUpdate(id,actor,revision,notes)`, `saveFinancialEntry(id,actor,revision,input)`; `FinancialSnapshot.available`, private monthly inputs and investor-safe summary.

- [ ] Add failing tests for blank production drafts, note structuring and no invented financials.
- [ ] Implement notes → editable summary, review/publication, manual financial entry and empty-finance rendering.
- [ ] Add browser coverage for repeated monthly creation, approval invalidation and published archive.

## Task 3 — Financial PDF library

Files: document domain/repository/storage modules, `/api/documents` upload/download, `/documents`, admin document form, `database/production.sql` Storage policies.

Interfaces: reserve/upload/attach through version and revision; investor download by UUID with metadata + Storage RLS. Manifest contains metadata only, not private object paths.

- [ ] Add tests for invalid PDFs, size, pending/private state, cross-company access and published manifest immutability.
- [ ] Implement categories, private upload, snapshot-bound attachment, detachment and investor month/category library.
- [ ] Browser-test upload, investor attachment download, revision and responsive library.

## Task 4 — Deployment and handoff

Files: PDF server helper, production CSP, migrations/configuration, deployment runbook and README.

- [ ] Add serverless Chromium, fixed production origin and nonce CSP; verify existing PDF and built pages.
- [ ] Generate migrations with Supabase CLI and prepare admin bootstrap/investor invitations.
- [ ] Run typecheck, lint, domain/RLS/browser tests, build and independent final review.
- [ ] Apply tested migration and deploy only to the owner-selected environment; verify final URL, login, monthly update and download.
- [ ] Document actual deployment status, secure setup and monthly operating steps.
