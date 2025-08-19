# Health Watch — AI Agent Guide

Purpose: Help AI agents be productive in this TypeScript VS Code extension by capturing architecture, workflows, and house patterns specific to this repo.

## Big picture
- Local‑first VS Code extension (no telemetry). Entry: `src/extension.ts`; output bundle: `dist/extension.js`.
- Core data flow: Scheduler → ChannelRunner → Probes → Storage → UI/Reports.
  - Runner (`src/runner/{scheduler.ts,channelRunner.ts}`): schedules probes, applies guards/backoff, detects state changes.
  - Probes (`src/probes/{https,tcp,dns,script}.ts`): small, focused adapters returning `{ success, latencyMs, error }`.
  - Storage (`src/storage.ts` + `src/diskStorage.ts`): singleton `StorageManager` persists channel state, samples, outages, watches.
  - UI (`src/ui/**`): status bar, tree views, webview data. Pure mappers in `src/ui/dashboardData.ts`; React views in `src/ui/react/**`.
  - Types (`src/types.ts`): single source of truth for `Sample`, `Outage`, `ChannelState`, etc.
- Outage model (important): `Outage.startTime` = confirmation time (legacy); `firstFailureTime` + `actualDuration` capture real impact; `StorageManager.updateOutage` computes `actualDuration = endTime - firstFailureTime`.

## House conventions
- Keep data shapers pure: add/modify mappers in `src/ui/dashboardData.ts`; avoid side effects and IO there.
- Extend types backwards‑compatibly: add optional fields in `src/types.ts`; preserve legacy fields (`startTime`, `duration`).
- State changes only: notify/record on online↔offline transitions; avoid “still offline” loops.
- Detection: offline after `threshold` consecutive failures; backoff when offline; recover on first success.
- Config defaults live in `src/config.ts`; user-visible defaults are also mirrored in `package.json` contributes.

## Key files by responsibility
- Scheduling & state: `src/runner/channelRunner.ts` (failure streaks, `firstFailureTime`), `src/runner/scheduler.ts`.
- Persistence: `src/storage.ts` (in‑mem + disk API), `src/diskStorage.ts` (file IO, pruning), exports in `src/export.ts`.
- UI data: `src/ui/dashboardData.ts` (timeline/heatmap/incidents/metrics), helpers in `src/ui/dashboardUtils.ts`.
- UI surfaces: `src/ui/statusBar.ts`, `src/ui/{treeView,statusTreeView,incidentsTreeView}.ts`, React views under `src/ui/react/**`.
- Probes: `src/probes/{https,tcp,dns,script}.ts`; add new probe by following this pattern and return `ProbeResult`.

## Build, run, test
- Build: `npm run compile` (tsc typecheck + eslint + esbuild). Watch tasks exist: `watch:tsc`, `watch:esbuild`.
- Run extension: F5 (Extension Development Host). Main command IDs are under `contributes.commands` in `package.json`.
- Tests:
  - Compile tests: `npm run compile-tests` (to `out/test/**`).
  - Unit tests: `npm run test:unit` (mocha on compiled JS). Some tests require mocks for `vscode`.
  - E2E: `npm run test:e2e` (runs with `@vscode/test-electron`).
  - Example (PowerShell) run a single unit test with mock resolution:
    - `$env:NODE_PATH = "${PWD}\test\_mocks"; npx mocha out/test/unit/outageDuration.test.js`

## Patterns to follow (with examples)
- Recording outages (runner → storage): when threshold is crossed, include first‑failure metadata.
  - In runner: call `storage.addOutage({ channelId, startTime: confirmedAt, firstFailureTime, confirmedAt, reason, failureCount })`.
  - On recovery: `storage.updateOutage(channelId, endTime)`; this sets legacy `duration` and new `actualDuration`.
- Incidents for UI: prefer impact fields in `dashboardData`.
  - `const impactDuration = outage.actualDuration || outage.duration;`
  - Use `outage.firstFailureTime || outage.startTime` for the incident timestamp.
- Adding a probe: create `src/probes/foo.ts` exporting `runFooProbe(def): Promise<ProbeResult>`; keep IO localized and return a minimal `ProbeResult`.
- UI additions: compute data in `dashboardData.ts` then render in React under `src/ui/react/**` or legacy TS views under `src/ui/views/**`.

## Integration points & deps
- VS Code APIs: commands/views/status bar/webviews. Any module importing `vscode` requires the extension host (mock `vscode` for unit tests via `test/_mocks/vscode`).
- React UI (Tremor components available via `@tremor/react`). Built with esbuild.
- Tests use mocha (unit) and `@vscode/test-electron` (E2E). Types live in `tsconfig.test.json`.

## Common pitfalls
- Unit tests that import modules requiring `vscode` or disk storage will fail in Node. Use `test/_mocks/vscode` and design new tests as pure where possible (see `test/unit/outageDuration.test.ts`).
- Keep `package.json` contributes settings in sync with `src/config.ts` defaults.
- Preserve legacy fields when evolving types/serialization to avoid breaking older data files.

References
- High‑level docs: `docs/DASHBOARD-ARCHITECTURE-README.md`, `docs/INCIDENT-OUTAGE-MODEL.md`, `docs/OUTAGE-DURATION-FIX.md`.
- Important code: `src/runner/channelRunner.ts`, `src/storage.ts`, `src/ui/dashboardData.ts`, `src/probes/**`, `src/types.ts`, `src/config.ts`.
