# Investor password issuance — 2026-11-09

An administrator can register an investor email and issue a unique password from `/admin/investors`. Copy the prepared invitation containing the login URL, email and password, then send it to the intended investor through an existing channel. The application does not send that invitation automatically. Login now presents email and password first; email-link, Google and platform options remain available.

## Verification

- `npm run check`: typecheck, lint, 84 domain/SQL tests, 22 render tests and migration baseline checks passed.
- `playwright test tests/investor-password.spec.ts tests/report.spec.ts`: 9 browser tests passed, including password login, credential copying/dismissal, narrow-screen overflow checks, investor/admin boundaries, publication and tampered-session denial.
- Optimized Next.js build passed. Mock screens inspected at 390px and 1440px; no browser errors in the built app. Only synthetic credentials were used.
- Independent read-only review found no actionable issues; its focused password SQL/core run passed 7/7 tests.
- Additive `investor_password_issuance` migration applied before the frontend release. The bookkeeping table has RLS enabled and no anonymous/authenticated SELECT privilege. Completion RPC is executable only by the service role; reserve/list RPCs require a current administrator inside the function.
- `ir-investor-credentials` Edge Function version 1 deployed ACTIVE. It verifies the caller with Auth `getUser` and current company membership before any Auth mutation. Gateway JWT verification is disabled because this verified-user check is performed in the function itself.
- A direct live Edge HTTP probe was blocked by this workspace's outbound network policy; no successful live issuance or password reset is claimed. No real investor account was provisioned, reset, or emailed for testing.

## Recovery and security notes

Auth Admin API changes and the issuance-completion transaction are separate operations. If the API changes a password and the completion/response fails, the admin may need to wait two minutes and reissue it. Failed completion never returns the generated password. Old passwords are replaced for subsequent sign-ins; this feature does not promise to terminate every already-issued session. Stopping investor access still revokes access through the existing grants and RLS.

The security advisor reports the expected [RLS without policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) notice for private bookkeeping tables: access is denied by default and guarded functions mediate operations. Existing warnings remain for the unrelated [authenticated SECURITY DEFINER freee correction RPC](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) and disabled [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). These existing settings were not changed by this release. Generated passwords use 20 cryptographically random, unambiguous alphanumeric characters plus separators; plaintext is not stored in app tables, metadata, URLs, audit records or browser persistent storage.
