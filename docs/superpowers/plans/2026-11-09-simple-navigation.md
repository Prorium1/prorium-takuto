# Simple Navigation Implementation Plan

> Implement sequentially in this session, then review the complete change.

**Goal:** Make investor viewing and owner publication understandable without explanation.

**Architecture:** Keep routes, data and workflow unchanged; simplify presentation and progressive disclosure in existing components.

**Tech Stack:** Next.js, React, CSS, existing Playwright tests.

**Spec:** `docs/superpowers/specs/2026-11-09-simple-navigation-design.md`

## Constraints and review focus

- No real data in development, no financial publication or authentication changes.
- Never imply drafts or approvals are already visible to shareholders.
- Editing must still invalidate approval; dirty inputs cannot advance the workflow.
- Keep evidence, missing-month notices and financial units visible.
- Maintain all destinations, mobile focus handling, and printable report behavior.

## Tasks

- [x] Simplify `shell-client.tsx`, login copy, `investor-dashboard.tsx` and report/PDF actions with plain Japanese and a clear visual hierarchy.
- [x] Refactor the owner home and `fiscal-share-editor.tsx` into a primary action, four-stage guidance and optional editing/refresh details.
- [x] Add scoped accessible styling and update affected navigation/workflow browser assertions. Verify missing inputs, saved edits, review/approve/publish and draft isolation using Mock.
- [ ] Check types/lint/domain/render tests, production build and mobile/desktop screenshots; review the diff and deploy the UI to the existing project.
