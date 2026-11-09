# Investor Password Login Implementation Plan

> Execute natively in this session and request an independent whole-branch review before release. Existing task authorization covers implementation and deployment; no implementation handoff is needed.

**Goal:** Let an administrator issue a unique investor password and share a ready-to-use login invitation.

**Architecture:** Keep Supabase password login, investor grants and published-only RLS. Add a private issuance reservation RPC, an authenticated Edge Function using Auth Admin APIs, and an admin-only Next.js action. Only the issuing administrator receives the generated password.

**Tech Stack:** Next.js, React, Supabase Auth/Edge Functions/Postgres, PGlite and Playwright.

**Spec:** `docs/superpowers/specs/2026-11-09-investor-password-design.md`

## Constraints and review focus

- No real data in development; no bulk credential changes or invitation delivery.
- Protect administrators, foreign tenants, unrelated accounts and changed email identities.
- Serialize duplicate requests; incomplete external operations never return credentials as successful.
- Never persist or log plaintext passwords; no privileged key in browser or Next.js configuration.
- Keep email-link login, grant revocation, immutable reports and investor-only publication visibility.

## Tasks

- [x] Add `investor_password_issuance` migration with reserve/complete/list RPCs and private bookkeeping; verify caller, tenant, target, duplicate request and stale completion boundaries in `tests/investor-password-sql.test.ts`.
- [x] Add `supabase/functions/ir-investor-credentials/{core,index}.ts`; generate unique strong passwords, use verified caller and official create/update APIs, and return only after completion. Test generation, auth denial, mismatched identity, backend failure and partial completion in `tests/investor-password.test.ts`.
- [x] Add the guarded issue action and `investor-credentials.tsx`, update investor administration and the login form. Test primary password login and Mock-only preview of one-time copy/dismiss behavior without provisioning real accounts. Reissue authorization and target selection are covered by the SQL/core tests.
- [ ] Run relevant checks, review the whole branch, deploy the additive migration and Edge Function, deploy the app, verify canonical routes and unauthenticated denial.
