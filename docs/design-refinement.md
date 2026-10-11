# Prorium IR — Editorial design refinement

2026-10-08. User authorizes iterative design refinement with Awwwards / Webby / FWA as quality aspirations. Existing report/auth/data architecture remains; local mock only, no deployment. Official brand asset is required, not an invented replacement.

## Direction

An institutional publication with a distinct editorial identity: warm white paper, precise ink-colored typography, restrained Prorium accent, an issue-number masthead and clearly separated quantitative and narrative layers. Replace repeated rounded cards with deliberate rules, open layouts and sections with different visual weights. Give AI Transformation a dark, focused spread. Put the real Prorium logo in the rail, mobile header, login and PDF.

## Acceptance and review loop

1. Brand: official logo retains aspect ratio and clear space; no fabricated icon. All views use the same asset.
2. Hierarchy: four KPIs visible near the top; Japanese content legible; title/period/units/status unmistakable. Chart/driver values unchanged.
3. Craft: consistent spacing rhythm, aligned baselines, a limited palette, restrained borders; no ornamental gradients or continuous animation.
4. Interaction: selected section follows reading position; functional PDF/archive controls; visible keyboard focus and touch targets; mobile menu closes on Escape and preserves focus.
5. Accessibility: 4.5:1 contrast for normal text, 3:1 for large text; readable 320–1440px layouts, reduced-motion support, no horizontal overflow.
6. Print: official logo, all nine sections, no clipped content or broken characters, professional A4 pagination.
7. Evidence: save screenshots after each pass, record remaining issues, refine, and rerun affected checks. Award-winning status cannot be established by self-assessment; document concrete outcomes rather than declare an award score.

## Implementation boundaries

- Brand, shell and report presentation; login and archive match the same language.
- `editorial.css` contains deliberate visual overrides, keeping existing admin styles and proven print layout stable where possible.
- No changes to stored/published report content, calculations, auth or database.
- Use the existing test suite plus focused browser checks for new navigation behavior and visual/accessibility checks.

## Iterations

- Baseline: saved at `artifacts/design-before/`. Issues: synthetic logo, repetitive card treatment, pale/small typography, weak section contrast and no reading-position feedback.
- Pass 1: integrated the official logo from `https://www.prorium.co.jp/brand/prorium-logo-horizontal.png`, with its original aspect ratio. Replaced the publication masthead, KPI layout, business cards, AI spread, archive and login. Real screenshots exposed a 320px driver bridge overflow and low-contrast secondary labels. Moved provenance below the executive summary so the four KPIs lead directly into the management narrative.
- Pass 2: corrected the narrow bridge layout, unified the four mobile KPI sizes, tightened the mobile opening, darkened secondary labels and refined the tablet PDF control. Automated axe checks found zero WCAG 2 A/AA and 2.1 AA violations in all eight tested view/viewport combinations. This is an automated check, not a complete accessibility certification.
- Pass 3: aligned the six-page A4 export with the official blue and editorial rules; visually reviewed pages 1, 4 and 6 and checked extraction of all nine sections. Repaired touch selection persistence and reduced-motion menu focus. Replaced the intersection callback with a frame-scheduled reading-position calculation so large scroll jumps also update the selected chapter reliably. Final browser checks pass for all ten scenarios.

## Final evidence

- `artifacts/design-final/`: desktop/tablet/mobile/small report, login, archive and all report sections. Final captures use the optimized build with mock data on a local loopback preview; nothing is deployed.
- `artifacts/Prorium-2026-08-v1.0.pdf`: six A4 pages, official logo, complete report and explicit mock attribution.
- `artifacts/design-final/accessibility.log`: zero detected violations at 1440/768/375/320px for the report and 1440/375px for login/archive; no horizontal overflow in those views.
- Validation: 16 domain/repository/database tests, 9 presentation tests and 10 browser tests pass. TypeScript, ESLint, migration consistency and optimized build pass. Production-mode fail-closed smoke test uses localhost only.
- Keyboard navigation checks the hidden drawer, focus containment, Escape restoration and active reading position. Existing checks cover authorization, immutable versions, review/approval/publication, attachments, PDF and touch/keyboard chart selection.

## Reproduce

Run `PRORIUM_ENV=mock npm run dev`, then `node scripts/review-design.mjs`. Set `AXE_SCRIPT` to an installed `axe-core/axe.min.js` to include automated accessibility checks. `PREVIEW_ORIGIN` and `DESIGN_REVIEW_OUTPUT` select the local preview and artifact directory. Run `npm run check`, `npm run test:e2e` and `NEXT_DIST_DIR=.next/build npm run build` for regression validation.

Award references remain aspirations. The outcome is assessed by the documented visual iterations, legibility and working interactions, without claiming jury approval or an invented award score.
