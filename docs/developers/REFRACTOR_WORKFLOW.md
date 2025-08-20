Refactor Workflow (health-watch)

Goal
- Break down large UI files (starting with `src/ui/dashboard.ts`) into small, well-tested modules: Renderer, DataProvider, EventBinder, Controller, StatsCalculator.

Phases
1. Discovery & Baseline
   - Run symbol analysis across all TS files and record symbol counts and top exports in `docs/analysis-refactor-baseline.csv`.
   - Identify high-priority files (monolithic, many symbols, many responsibilities).

2. Prepare CI-safe branch
   - Create a feature branch `refactor/dashboard/renderer` from `main`.
   - Keep changes isolated and compile after each incremental commit. Ensure TypeScript passes and tests (if any) run.

3. Extract Renderer (smallest surface first)
   - Create `src/ui/renderer/` with `dashboardRenderer.ts` that exports `renderDashboardHTML(data, options)`.
   - Move HTML/CSS generation functions (`getBaseCSS`, `getBaseScripts`, HTML templates) into the renderer.
   - Keep webview message contract intact and add tests for output shape.

4. Extract DataProvider
   - Create `src/ui/data/dashboardDataProvider.ts` which depends on `storage` and `stats` only.
   - Move pure data functions (timeline, heatmap, incidents, metrics) and expose a small API: `getDashboardData(range)`.

5. Extract EventBinder & Controller
   - Centralize webview message handling and UI actions in `EventBinder` and `Controller`.
   - Replace inline handlers and data-attributes with centralized listener and `postMessage` contracts.

6. StatsCalculator
   - Move heavy compute logic from `dashboard.ts` into `src/stats.ts` or `src/ui/statsCalculator.ts` and add unit tests.

7. Iterate, test, and merge
   - Keep changes minimal per PR, run `npm run compile` and `npm test` before PR.
   - Review and merge sequentially: Renderer -> DataProvider -> Controller -> StatsCalculator.

Branching and PR strategy
- One small logical change per branch (move-only commits are allowed but prefer preserving history).
- Add a top-of-PR checklist: TypeScript build passes, unit tests added/updated, manual smoke test instructions.

Notes
- Use `docs/analysis-refactor-baseline.csv` to track progress: mark rows as `in-progress` and `done` in the `priority` or `notes` column.
- Keep webview CSP-safe: externalize scripts to bundles, add nonces at webview creation, avoid inline event attributes.
