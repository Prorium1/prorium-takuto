# Event reporting and financial presentation

The report supports an optional event section: event date, summary, up to four verified outcomes, next action, and an optional approved YouTube or Vimeo video. An earlier event is explicitly marked as a retrospective. Production validation rejects events after the reporting month, unsafe URLs, missing video titles, and unknown fields. Existing report snapshots remain compatible and immutable.

Video players are created only after the viewer clicks play. Only approved provider hosts are permitted by the parser and CSP. The referrer policy shares the site origin, not the report path. Provider URLs are not protected by IR authorization; editors must select footage approved for this audience. Print output retains the viewing URL. No actual footage or event claims are included in development fixtures.

The admin import page charts existing production staging candidates, excludes incomplete months, uses the latest import for each month, and marks all figures as awaiting accounting review. It does not publish them. The existing admin MFA and review/approval workflow still apply.

Charts use solid lines, distinct dot/square markers, a visible prior value and delta, keyboard/touch selection, and a numeric table. Screen-only gradients and brief entrance animations respect reduced-motion settings. Mobile chart overflow is confined to the plot, keeping labels readable.

Validation: schema/SQL rejection tests, staging completeness and duplicate handling, provider allowlist tests, deferred video rendering, desktop/tablet/mobile browser checks, reduced motion, and print layout. All fixtures are synthetic.
