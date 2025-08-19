# Health Watch Enhancement Review & Tracking

This doc tracks the implementation of the requested changes and provides a review/audit checklist for the implementer to complete.

- Primary Implementer: Claude
- Reviewer: (assign)
- Current Version: 1.0
- Last Updated: <update date>

## Master Task List (convert each to tickets)

For each item below, create a ticket using `docs/ticket-template.md` and link it here with status.

1) Config schema changes
- [ ] Ticket: Schema versioning
- [ ] Ticket: Per-channel disable flag

2) Tree view — channels
- [ ] Ticket: Replace "Run Channel Now" with running icon
- [ ] Ticket: Add enable/disable toggle per channel
- [ ] Ticket: Open/create `.healthwatch.json` when adding config
- [ ] Ticket: Clicking channel navigates to config location

3) Watch lifecycle
- [ ] Ticket: Fix status bar stuck on "Ending..."

4) Tree view — layout
- [ ] Ticket: Right-align channel details with fixed labels
- [ ] Ticket: Remove redundant channels/overall health in status subtree

5) Tree view — incidents
- [ ] Ticket: Replace add/refresh with material icons
- [ ] Ticket: Add per-incident delete control

6) Dashboard behavior
- [ ] Ticket: Prevent auto-refocus to Overview during live monitoring
- [ ] Ticket: Add checkbox to enable/disable live monitoring
- [ ] Ticket: Timeline layout (nested row of tabs)
- [ ] Ticket: Metrics table alignment + channel dropdown filter
- [ ] Ticket: Live monitor items clickable to open details view
- [ ] Ticket: Add 5m time filter
- [ ] Ticket: Fix Swimlanes 6H filter behavior

7) Status bar
- [ ] Ticket: Remove latency and "Watch" caption; show only time remaining

8) Schema & monitoring functionality
- [ ] Ticket: Add channel visibility/state fields to schema
- [ ] Ticket: Ensure intervalSec/timeoutMs from config override defaults

9) Fishy / Ignore → Snooze
- [ ] Ticket: Implement snooze with options (5m, 60m, 6h) and apply across multi-channel outages
- [ ] Ticket: Define/reporting rules for snoozed events and SLO impact

10) Reports
- [ ] Ticket: Write reports to OS temp folder
- [ ] Ticket: Write summary (before/after + change impact) and save MD in `/docs`
- [ ] Ticket: Add visuals (mermaid/ASCII/inline SVG) to report
- [ ] Ticket: Make report generation modular, testable, and documented

---

## Review Checklist (Implementer must fill)

General
- [ ] Does each ticket have clear acceptance criteria and owner?
- [ ] Is there a migration plan for schema versioning and existing configs?
- [ ] Are user-facing changes documented in README/CONFIGURATION.md and CHANGELOG.md?
- [ ] Are tests (unit/e2e) added for each change that affects behavior?
- [ ] Are performance and security implications considered?

Schema & Config
- [ ] New keys added: names, types, defaults documented
- [ ] Validation updates covered by JSON schema and runtime validation
- [ ] Backwards compatibility: old configs load, warnings shown, or auto-migration provided
- [ ] Error messages actionable and visible (Output/notifications)

Channel Enable/Disable & Snooze
- [ ] Storage decision documented (in-file vs extension state)
- [ ] UI reflects enabled/disabled accurately, persisted across reloads
- [ ] Scheduler respects disabled channels and snoozed channels
- [ ] SLO/metrics exclude snoozed windows (doc + tests)

Tree View & UI
- [ ] Icons accessible (ARIA/labels), consistent with VS Code style
- [ ] Context menus updated, commands added and registered
- [ ] Right-aligned details render with monospaced/fixed width where required
- [ ] Redundant sections removed; no lost information

Dashboard
- [ ] Live auto-refresh no longer steals focus
- [ ] Checkbox to enable/disable live works and persists per session
- [ ] Timeline layout implements second row without shifting top row
- [ ] Metrics: columns aligned; filter by channel works and persists
- [ ] Live monitor entries link to a detailed view (design defined)
- [ ] Time filter includes 5m option across all widgets
- [ ] Swimlanes 6H filter logic fixed and tested

Status Bar
- [ ] Shows only time remaining; no latency; wording confirmed
- [ ] Internet/default channel selection handles HTTP and HTTPS

Reports
- [ ] Reports written to OS temp directory via `os.tmpdir()`
- [ ] Option to copy/export to `/docs` when desired
- [ ] Before/after summary and impact analysis included
- [ ] Visuals embedded (mermaid/ASCII/SVG) where meaningful
- [ ] Code modularized and unit-tested; headers/docstrings updated

Testing & QA
- [ ] Add/update test data in `docs/testing/test-configs`
- [ ] Add E2E covering toggles, snooze, dashboard focus, time filters
- [ ] Lint/typecheck pass; CI green; no regressions

---

## Open Questions (to be answered by implementer)

1. Schema
   - What is the exact key name for per-channel toggle? `enabled` (default true)? Any others (e.g., `visible`)?
   - How will `schemaVersion` be introduced and validated? Migration path for v1 configs?

2. Snooze
   - Where is snooze state stored and how is it persisted across reloads?
   - How is snooze shown in UI? Can users cancel early?
   - How do snoozed intervals affect SLO metrics and outage tracking?

3. UI/UX
   - Provide mockups/wireframes for: tree toggles, running icon, incident icons, dashboard two-row layout.
   - Define the “click to details” view for live monitor entries (webview route, data model).

4. Reports
   - Confirm temp folder behavior across OS; how to link/open from VS Code.
   - Criteria for “before/after” and “impact analysis”: what data sources?

5. Performance & Security
   - Any new polling or intervals that may affect CPU/network? Guardrails?
   - Script probe/report data handling changes—any privacy concerns?

6. Commands & Settings
   - List all new commands and settings; confirm contributions in `package.json`.
   - Do we need feature flags for risky UI changes (dashboard layout)?

---

## Links
- Ticket template: `docs/ticket-template.md`
- Source branch: (link)
- PRs: (link)
- Designs: (link)
- Test plan: (link)
