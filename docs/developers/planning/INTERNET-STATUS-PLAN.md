# Internet Status & Status Bar — Implementation Plan

Date: 2025-08-20
Author: Automation (generated)

Purpose
-------
This document captures the design and implementation plan for a minimal, user-first Internet connectivity indicator in the Health Watch status bar, plus the related configuration model, detection heuristics, and rollout tasks for developers.

Goals
-----
- Provide a simple, reliable "Is my computer online?" indicator for non-technical users.
- Keep defaults zero-effort: extension installs and shows a single global indicator.
- Preserve advanced/Power-user features (per-channel, mini-multi-channel modes).
- Ensure workspace-level configuration can override user defaults when appropriate.
- Maintain local-first privacy and low resource usage.

Scope
-----
- Add `InternetCheckService` to perform lightweight HTTP/TCP checks.
- Wire the service to `StatusBarManager` with a minimal UI mode by default.
- Add settings and `.healthwatch.json` guard support for `internet` targets.
- Persist last-known state in VS Code `globalState` and show cached state on cold start.
- Provide first-run prompt to enable/disable the global internet indicator.

Non-goals
---------
- Building a full network diagnostics panel (beyond quick checks and captive portal hints).
- Sending telemetry or external analytics (project maintains local-first policy).

Requirements (developer checklist)
---------------------------------
- [ ] User sees a single status bar indicator by default after install (user-level setting `healthWatch.statusBar.internet.enabled = true`).
- [ ] Indicator shows online / offline / unknown / captive states with clear tooltip.
- [ ] Service uses configurable `healthWatch.internet.targets` with safe defaults.
- [ ] Workspace `.healthwatch.json` may define an `internet` guard; when present it takes precedence for that workspace if `scope` allows.
- [ ] Avoid null scheduler / race conditions: use explicit initialize() / factory pattern to wire services.
- [ ] Persist last-known state in `globalState` and load it on activation.
- [ ] Unit tests for state transitions, captive portal detection, and failure thresholds.
- [ ] Integration test to ensure activation doesn't throw when scheduler/api are not yet initialized.

UX / Interaction
----------------
Default behaviour (new users):
- Status bar shows a minimal indicator (single icon + color) in `minimal` mode.
- Hover tooltip shows: last check (time), latency (if available), and actions: `Run connectivity check` and `Open dashboard`.
- Click: runs an immediate check and opens a small popup (or runs quick-check and shows toast) with last 3 results.

First-run prompt:
- If no config exists, show a lightweight prompt: "Enable quick Internet status in the status bar?" [Yes] [No] [Configure]
- On [Yes], set user setting `healthWatch.statusBar.internet.enabled = true` and create user-level default targets if not present.
- On [Configure], open settings page or `.healthwatch.json` with example guard definition.

Settings & Configuration
------------------------
VS Code user-level (settings.json) recommended keys:
- `healthWatch.statusBar.internet.enabled` (boolean) — default: true
- `healthWatch.statusBar.mode` (enum) — `minimal` | `mini-multi-channel` | `none` — default: `minimal`
- `healthWatch.internet.targets` (string[]) — default: [
  "https://clients3.google.com/generate_204",
  "https://cloudflare.com/generate_204"
]
- `healthWatch.internet.intervalSec` (number) — default: 15
- `healthWatch.internet.timeoutMs` (number) — default: 3000
- `healthWatch.internet.failureThreshold` (number) — default: 3
- `healthWatch.statusBar.internet.scope` — `user` | `workspace` | `both` (default `user`) # not sure how this would work with the multi window management

Workspace (.healthwatch.json) override example:
```
{
  "guards": {
    "internet": {
      "targets": ["https://internal-probe.mycompany.local/generate_204"],
      "intervalSec": 30,
      "timeoutMs": 2000
    }
  }
}
```

Precedence rules
----------------
1. If workspace `.healthwatch.json` defines `guards.internet` and `statusBar.internet.scope` allows workspace override (`workspace` or `both`), use the workspace guard.
2. Else use user-level `healthWatch.internet.targets` if present.
3. Else use built-in defaults.

Detection model & heuristics
----------------------------
- Preferred probes (in order):
  1. HTTPS GET to `/generate_204` endpoints (fast, small response)
  2. HTTPS GET to another minimal endpoint (fallback)
  3. TCP handshake to known host:port if HTTPS blocked (secondary)
- State machine:
  - `unknown` (initial or on startup if no cache)
  - `online` (on first successful probe)
  - `offline` (after `failureThreshold` consecutive failures)
  - `captive` (when response is HTML or redirected to login page)
  - `unstable` (when successes and failures alternate frequently)
- Rules:
  - Mark online immediately on a successful probe.
  - Only mark offline after N consecutive failures (default 2) to avoid flapping.
  - Use exponential backoff for retries when offline.
  - Debounce UI updates; do not update status bar more frequently than once every 5s unless forced by user action.

Captive portal detection
------------------------
- If the endpoint returns HTML or a 200 with a body rather than an expected 204, mark `captive` and surface guidance: "Network may require sign-in (captive portal)" with a button to open default browser.

State persistence
-----------------
- Persist object `{ status, lastCheck, latencyMs, target }` to `context.globalState` under key `healthWatch.internet.lastState`.
- On activation, read cached state and show it immediately while running an on-start probe to refresh.

API / Service contract
----------------------
Implement `src/services/internetCheckService.ts` with the following contract:

```ts
export type InternetState = 'unknown'|'online'|'offline'|'captive'|'unstable';

export interface InternetStatus {
  status: InternetState;
  lastCheck?: number; // epoch ms
  latencyMs?: number;
  target?: string;
}

export class InternetCheckService extends EventEmitter {
  constructor(config: InternetConfig) {}
  start(): void
  stop(): void
  runNow(): Promise<InternetStatus>
  getStatus(): InternetStatus
}
```

Event emitted: `change` with `InternetStatus` payload whenever state changes (after debouncing)

Implementation notes
--------------------
- Keep checks small and async; use `fetch` or `node-fetch` via the extension host (or `https` module in Node if necessary).
- No ICMP (ping) available from extension host — use HTTP/TCP.
- Respect `healthWatch.script.enabled` and other security settings; do not run scripts implicitly.
- Avoid long blocking awaits in `activate()`; use factory/initialize pattern to avoid null scheduler problems.

Testing
-------
Unit tests:
- State transitions (success -> online, fail -> offline after threshold)
- Captive portal detection (HTML body vs 204)
- Debounce behaviour
- Persistence to `globalState`

Integration tests:
- Activation test with mocked `globalState` and mocked network responses
- StatusBar integration: service emits `change`, `StatusBarManager` updates without exception

Manual QA checklist:
- Clean VS Code (no prior globalState) install shows neutral then updates to cached or new state
- First-run prompt appears when no config exists
- Workspace override: workspace guard replaces user targets when scope allows
- Captive portal detection surfaces correct message

Rollout & migration
-------------------
- Backwards compatible: defaults show minimal indicator; existing users are unaffected unless they change settings
- Add a small note in the v1.0.5 release notes (CHANGELOG) and `QUICKSTART.md` describing the new status bar behaviour and how to disable it

Implementation tasks (ordered)
------------------------------
1. Design & scaffold `InternetCheckService` (TS + tests) — 1 day
2. Add settings schema entries and document keys — 0.5 day
3. Wire service to `StatusBarManager` using safe initialize pattern (lessons learned) — 0.5 day
4. Implement first-run prompt and persistence in `extension.ts` — 0.5 day
5. Unit tests & integration tests — 1 day
6. Manual QA on Windows/macOS/Linux — 1 day
7. Update docs: `QUICKSTART.md`, settings reference, and `CHANGELOG.md` — 0.5 day

Risks & mitigations
-------------------
- Flaky networks cause UI flicker: mitigate via failureThreshold and debounce
- Corporate proxies / captive portals: detect and surface actionable message
- Race conditions at activation: use explicit `initialize()` and avoid constructor side-effects

Acceptance criteria
-------------------
- No activation errors (TypeError or similar) on cold start or after package install
- Stable online/offline indicator with no rapid flicker on flakey networks
- Tests pass locally (unit + integration) and activation tested in CI with mocked network
- Documentation updated and first-run UX implemented

Open questions
--------------
- Should we expose a visual preference for how prominent the status indicator is (e.g., small, medium, verbose)? Currently we map to `healthWatch.statusBar.mode`.
- Should the default `targets` include only 204 endpoints? (recommended) or add HTTP/HTTPS with a small payload?

Next steps
----------
- Assign tasks and implement `InternetCheckService` scaffold.
- Create PR and run tests.
- QA on multiple platforms and publish minor release.

---

Document created to guide implementation and review by the development team.

---

## Original creation prompt


```
Now let's do an analysis of exactly how we are What is the model for this Internet thing I believe that currently we have a way to detect which channels are associated with Internet and I think that's fine we have that as a fall back but let's initially just how about the fold status bar Like analyze it right we have different settings for how to view the status bar configuration and I guess that's for power users But let's think of like the easiest simplest case where a user just wants to know if his computer is online or his laptop is in line and what what is the issue right and that's like the main use case we're trying to solve for and then the 2nd one was OK let's extend that into widespread lightweight monitoring that happens within the the laptop and then the user has full control over that over those metrics right in the probing what not but 1st first things 1st is like the Internet connection superhouse we can have like a sort of configuration like think think about it on the UX UI you know Visual Studio Code packaging senior packaging manager UX design like what this interaction right like installing the application for first time user should be simple and they should not need to install anything else be you know be beyond oh the simple stuff so perhaps OK we we arrive user comes in installs the app we can we can ask the user hey we detected you know no configurations have been set or I don't like it it comes to my mind for half this could be solved No no I'm still thinking I think the user should install and already have a visual bar down there but perhaps that could be like a configuration thing let's look at the configurations that we have as well because certain configurations will work better for you know basic users so we could also do like a user journey analysis perhaps here but basically let's analyze regular user source the app has Internet like this this thing perhaps that can be a sort of user configuration versus a workspace configuration which sets that up somewhere in the user's space and sets the the you know the the basic global user config to have a basic A .888 Internet check perhaps the user can decide whether he wants to a created or be ignored the the summons and then let's think about multiple workspaces right what if the user has multiple sessions and he doesn't want to be like oh Internet is not configured right but maybe the user did configure it in another one so we want to avoid that case by perhaps having like something multi workspace that's you know
```