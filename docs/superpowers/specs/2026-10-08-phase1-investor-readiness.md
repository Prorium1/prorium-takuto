# Phase 1 investor report readiness

Goal: complete and verify the existing August 2026 mock investor report against the supplied brief. Preserve the existing Next.js architecture and production integration boundaries; do not deploy, access remote databases, use real financial data, or change credentials.

## Repository findings

Existing application: Next.js 16 / React 19 / TypeScript with server-authorized investor and admin routes, invite-only Supabase production auth and MFA, local mock authentication/storage, immutable reports, RLS migrations, import/analysis provider interfaces, approval workflow, archives and authenticated PDFs. Supabase/freee/live AI activation is separate from this task. Historical deployment records do not authorize new deployment.

## Architecture and database

Continue the existing domain → server repository → authorized Server Component → small interactive client component structure. `reports` identify periods; `report_versions` contain investor-safe immutable publications; `financial_snapshots` freeze imported facts. `approval_events` bind approval to content hash. `analysis_runs` retain private generated drafts, `audit_logs` append events, `investor_grants` scope access to companies. No schema changes are needed for the UI corrections.

## Security

Local synthetic data only. Existing page/action/repository/PDF authorization and database RLS stay in place. Verify anonymous denial, published-only investor reads, separate admin access, approval invalidation on edits, and immutable published versions with the existing tests. External Auth/Storage/PostgREST/email/provider operation cannot be established through local tests.

## Information architecture and components

Keep four large KPIs followed by executive summary and the nine requested sections. Display provenance close to the KPIs, including source, data updated at (JST), sync status, analysis method, review and publication. Do not describe deterministic mock text as live AI, or a manual/freee import as automatic synchronization when the model only records a source.

Retain `ReportView`, `KpiGrid`, `TrendChart`, `DriverBridge` and `PdfButton`. Extract provenance display to `ReportProvenance`; share method labels with `reportAttribution`. Extract scale and YoY presentation into pure financial helpers. Chart scale must include zero and negative profits; all-zero and one-point histories must remain valid. YoY percentage is undefined for nonpositive prior values: show a signed yen delta and explanation instead of 0%. A decrease must use a downward icon and negative styling. Metric/range controls expose selection to assistive technology, and chart point selection supports touch and keyboard.

## Delivery and acceptance

1. Correct numerical charts and truthful provenance without changing published financial fixtures.
2. Review desktop/tablet/mobile rendering, including 320px; preserve restrained white/gray/purple design.
3. Verify admin workflow, RLS, archive, PDF and configuration guards with current commands.
4. Record current verification evidence and local preview/artifact locations. Clearly distinguish implemented code, locally tested behavior, and unconnected live integrations.

30-second/3-minute comprehension remains a design goal, not a measured usability result.
