# Perplexity Questions [UNIMPLEMENTED]

---


I'll query Perplexity for up-to-date (2025) best practices for testing VS Code extensions that need multi-workspace / multi-window coordination; expected outcome: a concise list of practices, example approaches, and sample commands to run multi-instance integration tests. Plan: I'll summarize practical, up-to-date best practices for testing multi-window/multi-workspace VS Code extensions and give concise, actionable examples and commands for unit, integration, and e2e approaches.

Checklist
- Unit tests for pure coordination logic: Done (recommendations provided)
- Integration/e2e approach to run multiple VS Code instances: Done (command examples and harness sketch)
- Determinism/flakiness strategies: Done (timing, isolation, mocking)
- CI and cleanup guidance: Done
- Short code/harness examples and assertion patterns: Done

Best practices (concise)

1) Layer tests: unit → integration → e2e
- Unit: test leader election, lock state machines, backoff logic outside VS Code. Mock timers/files. Fast and deterministic.
- Integration: test interactions with small parts of the extension (e.g., coordination module + storage adapter) in Node, optionally with a mocked VS Code API.
- E2E: launch real VS Code instances to validate leader election, cross-window locks, and shared state.

2) Launching multiple VS Code windows for e2e
- Use @vscode/test-electron or spawn the VS Code CLI with isolated profiles:
  - Key args: --extensionDevelopmentPath, --extensionTestsPath, --user-data-dir, --workspace-folder, --disable-extensions, --disable-updates
- Example (two instances):
  ```bash
  npx @vscode/test-electron \
    --extensionDevelopmentPath=./ \
    --extensionTestsPath=./out/test/suite/index \
    --user-data-dir=/tmp/vscode-test-user-1 \
    --workspace-folder=/tmp/test-ws1 \
    --disable-extensions --disable-updates

  npx @vscode/test-electron \
    --extensionDevelopmentPath=./ \
    --extensionTestsPath=./out/test/suite/index \
    --user-data-dir=/tmp/vscode-test-user-2 \
    --workspace-folder=/tmp/test-ws2 \
    --disable-extensions --disable-updates
  ```

3) Orchestration harness pattern (Node)
- Spawn processes with child_process.spawn, capture stdout/stderr, watch for readiness events, and coordinate test steps (e.g., ask instance A to acquire leadership then verify instance B sees follower state).
- Cleanly kill processes and delete user-data/workspace dirs on teardown (always).

4) Determinism & flake reduction
- Isolate state: unique temp dirs for user-data and workspaces per instance/test run.
- Control time: use fake timers (Sinon or lolex) for unit tests; expose test hooks to speed-up time-based behavior in integration/e2e.
- Avoid sleeps: poll for explicit state with a short timeout. Example: poll command result or context key with retries up to N ms.
- Disable unrelated features: telemetry, auto-updates, and other extensions.
- Mock external I/O: network, DB, or shared cloud services; prefer local temp file or socket mocks for coordination.

5) Test hooks and observability
- Expose test-only commands (e.g., 'myExt.getRole', 'myExt.forceElection') to assert internal state without brittle UI scraping.
- Emit structured logs/events from coordination code; collect logs from all instances for debugging.

6) Asserting leadership and coordination
- From the orchestrator, run vscode.commands.executeCommand('myExt.getLeaderId') or similar to retrieve role/state.
- Use file/socket locks for leadership in production; in tests, replace with a deterministic mock lock manager that can be manipulated to test edge cases.

7) Resource & cleanup discipline
- Always cleanup user-data-dir and workspaces after each test, including failed runs. Use try/finally in harness code.
- Limit test concurrency on CI to avoid resource contention.

8) CI considerations
- Use headless display (Xvfb) or a runner that supports GUI; prefer serial runs or reserved machines for multi-instance e2e tests.
- Set conservative timeouts and fail-fast on orphaned VS Code processes.
- Save instance logs as artifacts for failures.

9) Common pitfalls
- Tests relying on wall-clock timing or flaky sleeps.
- Reusing user-data/workspace across tests — causes state leakage.
- Relying on UI text or timing to determine leadership instead of explicit APIs/commands.

10) Quick harness sketch (Node) — spawn + assert
- Launch two instances, wait until both report "ready" via a test command/endpoint, then:
  - In instance A: call command to start election.
  - Poll instance B with `vscode.commands.executeCommand('myExt.getRole')` until it returns 'follower' or timeout.
  - Assert expected leaderId, then run leader failover by terminating A and ensure B becomes leader.

11) Small assertion example (Mocha inside running instance)
- In test code (running within a test runner extension):
  ```ts
  const leader = await vscode.commands.executeCommand('healthWatch.getLeaderId');
  assert.strictEqual(leader, expectedLeaderId);
  ```

12) Extra tips
- Inject deterministic IDs for instances (via env vars or args) so outputs/assertions are stable.
- Add a "test mode" flag to increase visibility and control (heartbeat intervals, shorter timeouts).
- Centralize coordination logic so most of it can be tested as plain JS modules.

If you want, I can:
- Draft a small Node harness script in this repo to launch two test instances with isolated user-data and assert leadership transitions.
- Add test-only commands to extension.ts to expose role/status for assertions (safe-guarded behind a dev/test flag).
- Create a short CI job snippet showing how to run these e2e tests headlessly.

Which follow-up would you like me to implement?

---

Ack — I'll list the project's tech stack and where it's used.

Checklist
- Languages & runtimes: listed
- Build / bundling / packaging tools: listed
- Test / lint / dev tools: listed
- Key libraries (UI, storage, probes): listed
- VS Code-specific bits and project layout pointers: listed

Tech stack (concise)

- Language & runtime
  - TypeScript (source); compiled with `tsc` (TypeScript 5.9.2 in `devDependencies`)
  - Node.js/npm scripts (project driven by npm scripts)

- VS Code extension platform
  - VS Code Extensions API (entry: extension.ts)
  - `engines.vscode` set to "^1.103.0"
  - Packaging & publishing: `vsce` (`@vscode/vsce`) with npm scripts `vscode:package` / `vscode:publish`
  - Local install via `code` CLI

- Bundling / build
  - esbuild (custom esbuild.js) for production bundles and watch (`watch:esbuild`)
  - `tsc --noEmit` for type checking

- Linting / formatting
  - ESLint (with `@typescript-eslint` plugins)
  - ESLint is run as part of `compile` / `package` pipelines

- Testing
  - Unit: Vitest (`vitest`) for fast unit tests
  - Integration / E2E: `@vscode/test-electron` / `@vscode/test-cli` (extension host integration tests)
  - Test helpers: typed mocha types present; test harness under test (unit/integration/e2e)

- UI
  - React (React 18 + react-dom) for webview/React surfaces
  - TailwindCSS, PostCSS, autoprefixer used for styling (tailwind.config.js, postcss.config.js)
  - Some UI also implemented as plain TS-based tree/status views (under ui)

- Data & storage
  - Disk-based storage adapter (diskStorage.ts)
  - Optional MySQL support via `mysql2` dependency

- Networking / probes
  - Custom probe modules for `https`, `tcp`, `dns`, `script` under probes
  - Uses `ajv` (validation) and `date-fns` utilities

- Dev tooling / automation
  - npm-run-all for compound watch tasks
  - `watch:tsc` and `watch:esbuild` background watchers for iteration
  - `esbuild` production builds; `node esbuild.js --production` used in packaging
  - `eslint src` run during `package` step

- Repo structure & important files
  - src — extension code (runner, probes, services, ui, storage)
  - test — unit/integration/e2e tests and mocks
  - dist — build output
  - package.json — scripts, deps, and version (currently 1.0.12)
  - esbuild.js, `tsconfig*.json`, tailwind.config.js, postcss.config.js

Notes / quick recommendations
- CI-friendly: tests use Vitest and `@vscode/test-electron` — CI should provide headless display (Xvfb) when running e2e.
- Many lint warnings present; `eslint --fix` can address a large subset automatically.
