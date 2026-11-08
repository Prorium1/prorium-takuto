# Fiscal investor report sharing

Complete the existing fiscal-year briefing as an investor portal report and downloadable PDF. Preserve annual targets, actual month coverage, closing status, management commentary, diagrams, event video and ownership. Add aggregate staffing and operating areas with dated evidence; unknown counts remain unknown.

The user selected the existing IR portal plus PDF and the fiscal year already under preparation. Reuse the current report renderer and authenticated membership model. A new versioned annual snapshot follows draft → review → approved → published. Editing invalidates approval; published snapshots never change when upstream data changes. New revisions preserve previous versions.

Alternatives considered: PDF-only delivery omits the requested portal; exposing the live owner briefing would expose private source links and mutable data. Use a separate, redacted investor snapshot with existing authentication and tenant RLS.

Owner routes prepare, edit, preview, approve and publish. Investor routes and PDFs read only published versions. Draft PDF export is owner-only and marked as a review copy. Dashboard and document-library links reveal the published fiscal report. Preparing or deploying the feature does not publish data.

All development data is synthetic. Real financial and staff data remains in Production and connected tools. Staff names and individual absence reasons are excluded from the investor snapshot. Reuse the existing PDF browser and origin restriction. Do not add dependencies.
