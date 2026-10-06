# freee / AI integration boundary

Current state: freee uses the synthetic adapter only. No freee OAuth, accounting API access, webhook or live sync is configured. Production supports manually entered validated financial snapshots and privately uploaded statements; the dedicated Supabase is not yet provisioned. OpenAI monthly-narrative drafting is implemented server-side, but no dedicated API key or live-call verification is complete. This drafting does not perform live financial-data ingestion or automatically publish anything.

## Financial ingestion

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
