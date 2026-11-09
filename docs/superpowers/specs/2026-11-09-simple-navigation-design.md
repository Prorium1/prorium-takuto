# Simple investor and owner navigation

The user asks for a straightforward design anyone can understand. Simplify the existing product rather than add features: plain Japanese, an obvious next action, readable text, and visible distinctions between viewing and editing.

The investor home leads with the published annual report and its numbers when available. Three destinations make reports, saved financial documents, and ownership easy to find; the latest published monthly report remains available below them. The owner home leads with one button to continue the fiscal report. Detailed analysis and the investor view are secondary destinations. The annual sharing screen explains the existing four stages in order and reveals editing and source-refresh controls when needed.

Keep actual amounts, unknown information, dates, evidence, and explicit review/approval/publication intact. No authentication, authorization, database, or source-data changes. Do not publish any report as part of this visual update. Use only synthetic development data.

Implementation choices: retain routes and Next.js components, replace decorative English navigation with Japanese, use a restrained white/navy/blue palette, body text around 16–18px and touch controls at least 44px. Support keyboard navigation, 320px screens, text enlargement and reduced motion. Do not describe this as an age-specific mode.

Approach: reorganize the current screens. Cosmetic font changes alone leave competing actions; a new app or wizard route system would add unnecessary navigation. Native disclosure sections preserve access to detailed fields without making every visitor read them first.
