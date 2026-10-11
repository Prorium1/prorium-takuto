# Event reporting and financial presentation

The report supports an optional event section: event date, summary, up to four verified outcomes, next action, and an optional approved YouTube or Vimeo video. An earlier event is explicitly marked as a retrospective. Production validation rejects events after the reporting month, unsafe URLs, missing video titles, and unknown fields. Existing report snapshots remain compatible and immutable.

Video players are created only after the viewer clicks play and can be closed to return to the cover. YouTube cover images are proxied through Next.js image optimization, restricted to the fixed `i.ytimg.com/vi/*/hqdefault.jpg` path with no query string. The viewer's browser contacts only the IR origin before playback; Vimeo and unavailable thumbnails use a typographic cover. Only approved player hosts are permitted by the parser and CSP. Provider URLs are not protected by IR authorization; editors must select footage approved for this audience. Print output retains the viewing URL. No actual footage or event claims are included in development fixtures.

The owner supplied the June 2–3, 2026 Asia massage championship video on October 11. A production-only preparation card lets the authenticated administrator add those supplied event facts to an August draft with one click. The existing report RPC validates the current revision, financial snapshot and administrator session and records the change. It clears any earlier approval and does not publish. Confirmed outcomes and next actions are left empty. Database guards require a verified human session; infrastructure credentials cannot silently edit this draft or impersonate the owner.

On screen the field report follows the executive overview, with a direct entry from the report cover. The PDF retains the existing numbered report order and a readable video URL. Motion is limited to brief arrivals and hover feedback; reduced-motion preferences disable it.

The admin import page charts existing production staging candidates, excludes incomplete months, uses the latest import for each month, and marks all figures as awaiting accounting review. It does not publish them. The existing admin MFA and review/approval workflow still apply.

Charts use solid lines, distinct dot/square markers, a visible prior value and delta, keyboard/touch selection, and a numeric table. Screen-only gradients and brief entrance animations respect reduced-motion settings. Mobile chart overflow is confined to the plot, keeping labels readable.

Validation: schema/SQL rejection tests, staging completeness and duplicate handling, provider allowlist tests, deferred video rendering, desktop/tablet/mobile browser checks, reduced motion, and print layout. All fixtures are synthetic.
