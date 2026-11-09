# Production Google sign-in

Google OAuth is an additional identity check for the existing invitation-only IR site. It does not publish a draft, create a financial snapshot, or grant access to uninvited Google users.

The login page reads Supabase's public provider settings on each request. When Google is enabled, the Google button is shown first, with password and email-link alternatives. The platform administrator entry is always visible in Production. Preview and development continue to use synthetic data only.

## One-time setup

Open `/admin/login` on the Production site. It shows the provider status and the exact callback URLs from the deployed configuration.

1. In Google Auth Platform, create an IR-specific Web application client. Use an External audience for outside investors and add test users while in Testing. Request only `openid`, email, and profile. Register the Production origin and the **Supabase** `/auth/v1/callback` URI shown in the setup page.
2. Enter the Client ID and Client Secret directly into Supabase Authentication → Sign In / Providers → Google, then enable the provider. Do not save the secret in this repository, client code, a chat, or local development settings.
3. In Supabase URL Configuration, register the exact **IR site** `/auth/callback` return URL. Keep the canonical Production Site URL. Do not allow Production auth callbacks to development or preview hosts.
4. Reload the setup page. An enabled provider confirms configuration availability, not successful end-to-end sign-in. Test in a separate browser with the existing administrator's verified email. Supabase automatically links Google identities with the same verified email.
5. Register each investor's Google account email through `/admin/investors`. Once Google is enabled, email-only registration is the primary path; a new password is unnecessary. Share the canonical login page manually. An investor can only access published reports; an administrator can review drafts.

Google Client ID / Secret configuration is not available through the connected Supabase MCP tools. A project administrator must save that configuration in the provider dashboard. Existing platform and email authentication remain available during setup.

## Verification

- OAuth always opens Google's account picker to help people choose the invited email.
- The callback exchanges the PKCE code, accepts a verified-email invitation, and resolves the company actor. Identity ID, company ID, and recognized role must match before entry.
- Uninvited users are signed out of the local session and see instructions to choose the invited account or ask Prorium for registration.
- Admin setup routes call `requireAdmin` before reading provider configuration.
- Automated checks cover authorization/tenant isolation, login destination validation, provider detection, setup route isolation, mobile layout, and the password fallback. Use test identities and synthetic data locally; verify real content only in Production under the user's own authenticated session.

References: [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [Identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking).
