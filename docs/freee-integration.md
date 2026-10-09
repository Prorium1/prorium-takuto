# freee / AI integration boundary

Current financial ingestion: the IR site's production-only OAuth authorization-code flow and encrypted credential storage are implemented, but the site has not yet been authorized by an MFA admin. The connected assistant's separate freee accounting connection retrieved real P/L and B/S directly into transient tool memory, validated company, date, `up_to_date`, integer-yen totals and balance-sheet equality, and staged non-public candidate aggregates in the dedicated production IR database. No real financial data was written into development, Git, Preview or a published report. Scheduled live sync and report snapshot promotion are not implemented.

The production-only staging contains November 2025 through September 2026 as full calendar months and October 2026 only through October 9 as an explicitly incomplete month-to-date comparison. Every row remains `pending-review` with `closeConfirmed=false`. The candidate cash mapping uses freee account names/IDs and must be checked by management. Monthly fixed costs, business drivers and AI attribution were not inferred. The dedicated admin page can inspect candidate values after the admin completes Auth and MFA; investors cannot select the staging table.

## OAuth setup required before first connection

1. In [freee app management](https://app.secure.freee.co.jp/developers/applications), open the new IR-only accounting app. Confirm read-only accounting permissions and register `https://prorium-shareholder-ir.vercel.app/api/integrations/freee/callback` as its callback URL. The expected Prorium freee company ID is `11486508`; confirm this in the authorization screen before granting access.
2. `FREEE_CLIENT_ID` and `FREEE_CLIENT_SECRET` are now registered as Sensitive entries in the [Vercel IR project](https://vercel.com/prorium/prorium-shareholder-ir/settings/environment-variables) **Production** environment; their values have not been read back or verified by an authorization exchange. `FREEE_COMPANY_ID=11486508` and a generated `FREEE_TOKEN_ENCRYPTION_KEY` are also in Production. Never put any secret in Git, chat, Preview or Development.
3. The reviewed `20261009012909_freee_connection.sql` migration is applied to the dedicated IR Supabase project. It creates a private, RLS-protected table and MFA-gated RPCs; neither investors nor the Data API can read the credential ciphertext.
4. Deploy the matching code, sign in as the IR admin with MFA, and select `freeeを接続` at `/admin/import`. OAuth state is a short-lived HttpOnly cookie, the selected company must match `FREEE_COMPANY_ID`, and the refresh/access tokens are AES-256-GCM encrypted before DB storage. No token is displayed in the UI.

**Connection is not import.** The dashboard reports OAuth status only. Do not describe the connection as automatic data sync until the accounting mapping and scheduled job below are implemented and verified with production data. Published reports never sync automatically.

Monthly reflection now has a server-only OpenAI Responses adapter and a deterministic editorial fallback. Its production key is not configured and no live request has been verified. See [monthly reflection and activation status](./monthly-reflection.md) for the implemented flow and remaining setup.

## Financial ingestion

The official [freee accounting OpenAPI schema](https://github.com/freee/freee-api-schema) confirms that `GET /api/1/reports/trial_pl` and `GET /api/1/reports/trial_bs` accept `company_id`, `start_date` and `end_date`. The response includes `up_to_date`, the requested dates, company ID, account-item IDs and integer-yen balances. A pure validator now checks the exact calendar month, company, freshness and integer amounts against synthetic tests before account mapping. It does not retrieve live data or create a report.

`FinancialImportProvider` is the contract; `SyntheticFreeeProvider` exercises validation and immutable snapshot creation. The future freee provider belongs in `src/lib/server/integrations/`, never client components.

1. An admin authorizes the company connection server-side with OAuth state/PKCE. Store refresh tokens encrypted in an environment-specific secret store. Use least-privilege read scopes and never log credentials or raw journals.
2. A job receives company, closed reporting month and mapping version. Retrieve accounting records with pagination, explicit company scope, JST cutoffs, retry/backoff and an idempotency key.
3. Map account IDs to revenue, operating income, non-operating income/expenses, cash, assets and liabilities. Account labels alone are insufficient. Reconcile current and prior-year same month; include source totals, adjustments, mapping version, retrieved time and ledger cutoff.
4. Validate currency JPY, period, required accounts, integer JPY amounts, balance-sheet equality and statement reconciliation. Missing prior-year values are not zero; present YoY as unavailable. A rejected job cannot create a usable snapshot.
5. Commit import job + validated snapshot in one transaction. Financial snapshot checksums are derived by the DB. A retry must not create duplicate snapshots.
6. Attach the new snapshot to an unpublished draft. Any existing approval is invalidated. AI runs bind to that snapshot ID/checksum. An out-of-date job cannot overwrite a more recent draft revision.
7. Management validates change explanations and non-financial KPIs before approval. Approval records the exact full report checksum. Publication persists the complete investor-safe content and selected snapshot.
8. Later freee journal changes create another snapshot and a revision. Never modify a published version, including its PDF data source.

Why It Changed needs approved management input alongside accounting facts. freee alone cannot establish that AI caused a cost reduction or that a new product caused a revenue movement. AI revenue attribution, hours saved and automation denominator require separate documented management data sources.

The synthetic adapter returns supplemental management metrics from the same mock fixture so the profit bridge, AI efficiency card and Actual AI revenue remain coherent on re-import. This does not mean freee supplies AI impact attribution. The live adapter must validate and reconcile a separate management snapshot before review.

## AI drafting

`AnalysisProvider.generate(content)` returns Executive Summary, Financial Analysis, Why It Changed, positive/negative factors, risk and forward indicator drafts. The mock provider is deterministic. Runs are retained for admins; unpublished outputs never enter investor responses.

Future server job: send only the minimum approved source data under the company's model provider/data retention settings. Require structured JSON matching the domain schema; verify all cited numbers and category labels against the input snapshot. Do not invent financial values, causes or forecasts. Reject nonconforming output; store model/prompt version, source checksum and generation time.

Generation writes Draft only. A human reviews the complete report, approves its exact checksum, then invokes Publish separately. Risk and forward drafts remain suggestions until an editor adopts them. No AI provider can invoke publication through this contract.

## Production activation

Replace both the mock authentication and mock storage adapters before exposing confidential reports. Use invite-only Supabase Auth, MFA for admins, server-verified identity, active grant lookup and environment-separated Supabase projects. Apply the proposed schema as a generated migration in development and validate with the real Supabase Data API/JWT configuration before staging. Provision admin memberships through a trusted backend only.

Use a production nonce CSP, HTTPS-only session cookies, session revocation checks, rate limiting, transactional optimistic concurrency, private export storage, backups and restore verification. Production jobs must have a verified acting admin for review/approval/publication; avoid using a service-role query for investor reads. Credentials live in deployment secret stores, never Git or `NEXT_PUBLIC_*`.

The current app intentionally refuses mock access when `PRORIUM_ENV=production` or when an unconfigured production build is started. Setting `PRORIUM_ENV=mock` explicitly creates a publicly documented demo environment; it must never hold real data.
