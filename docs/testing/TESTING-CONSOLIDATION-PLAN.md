# TESTING CONSOLIDATION PLAN

Purpose: Propose a consolidated, practical testing documentation and automation strategy for Health Watch. The goal is to reduce duplication, make tests runnable, and enable CI-based validation.

---

## Current State (summary)
- Manual test plan exists: `docs/testing/manual-test-plan.md` (22 manual test cases, detailed instructions)
- Test assets: `docs/testing/test-configs/` and `docs/testing/test-data-generator.js` produce configurations
- Test README outlines quick-start testing steps and critical path tests

Gaps identified:
- No single "runnable" harness for executing the manual test cases
- Test artifacts split between README, manual plan, and generator script
- No CI workflows to validate core functionality on PRs
- Missing explicit mapping of test cases → automated smoke tests
- No test status dashboard or simple reporting format for results

---

## Goals
1. Make critical tests runnable on CI as fast, deterministic smoke tests
2. Consolidate test configs and canonicalize naming
3. Provide a simple test harness to run probe-level tests in Node (headless, without VS Code UI)
4. Keep manual test plan as the acceptance and UX verification reference
5. Add CI workflows for automated checks on PRs and nightly runs
6. Provide clear test owners and contribution instructions

---

## Proposed Structure
```
docs/testing/
├── README.md                          # High-level test overview (existing)
├── manual-test-plan.md                # Narrative manual test cases (existing)
├── TESTING-CONSOLIDATION-PLAN.md      # This plan
├── automation/                        # New: automation harness and scripts
│   ├── runner.js                      # Simple Node harness to execute probe tests
│   ├── fixtures/                      # Canonical test configs (copied from test-configs)
│   ├── reporters/                     # Simple JUnit/JSON reporters
│   └── README.md                      # How to run automation locally
├── test-configs/                      # Existing generated configs (canonicalize)
├── test-data-generator.js             # Existing generator
└── ci/                                # CI-specific scripts and workflows
    ├── smoke.yml                      # GitHub Actions smoke tests
    └── nightly.yml                    # Nightly full run
```

---

## Automation Strategy

### 1) Smoke Tests (fast, <3 minutes)
- Purpose: Verify installation, config parsing, and core probe logic
- Run: Node harness that loads `fixtures/smoke.json`, invokes probe functions directly (bypassing VS Code), and asserts results
- Example tests:
  - HTTPS success (httpbin status 200)
  - HTTPS failure (404)
  - TCP connect to known open port
  - DNS resolution
  - Guard evaluation (mocked)

### 2) Integration Tests (medium, 3-10 minutes)
- Purpose: Run multiple probes with realistic intervals (short) and validate the Storage and Runner behavior
- Run: Node harness with more realistic timing and use local network where possible
- Example tests:
  - Watch session flow (start/stop/report generation)
  - Outage detection and recovery
  - Guard skip logic

### 3) Manual Acceptance Tests (existing manual plan)
- Keep as-is and use for UX validation and release sign-off
- Add checklists and sign-off owner fields

---

## Implementation Steps

1. Create `docs/testing/automation/runner.js` that:
   - Loads a config file
   - Instantiates probes (import probe functions from `src/probes/*`)
   - Runs each probe once and records results
   - Emits JSON/JUnit result file

2. Move canonical test configurations into `docs/testing/automation/fixtures/` (minimal.json, smoke.json, comprehensive.json)

3. Add `npm` scripts in root `package.json`:
```json
{
  "scripts": {
    "test:smoke": "node docs/testing/automation/runner.js --config docs/testing/automation/fixtures/smoke.json --report results/smoke.json",
    "test:integration": "node docs/testing/automation/runner.js --config docs/testing/test-configs/comprehensive.json --integration --report results/integration.json"
  }
}
```

4. Create `docs/testing/automation/README.md` with instructions for running tests locally and interpreting results

5. Create GitHub Actions workflows (`.github/workflows/ci-smoke.yml`):
   - Run `npm ci`
   - Run `npm run test:smoke`
   - Upload results and fail the job if any critical assertions fail

6. Add `docs/testing/TESTING-CHECKLIST.md` to track test status for releases

---

## Minimal Runner Sketch (Node)

A tiny harness that imports probe functions. This assumes `src/probes` exports functions like `runHttpsProbe(def)` returning a Promise<ProbeResult>.

```js
// docs/testing/automation/runner.js
const fs = require('fs');
const path = require('path');
const probes = require('../../../../src/probes'); // adjust path for compiled JS during CI

async function run(configPath) {
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const results = [];

  for (const ch of cfg.channels) {
    try {
      let res;
      switch (ch.type) {
        case 'https': res = await probes.runHttpsProbe(ch); break;
        case 'tcp': res = await probes.runTcpProbe(ch); break;
        case 'dns': res = await probes.runDnsProbe(ch); break;
        case 'script': res = await probes.runScriptProbe(ch); break;
      }
      results.push({ channel: ch.id, success: res.success, latency: res.latencyMs, error: res.error });
    } catch (err) {
      results.push({ channel: ch.id, success: false, error: err.message });
    }
  }

  console.log(JSON.stringify({ results }, null, 2));
}

const cfg = process.argv[2];
run(cfg);
```

Note: for CI, compile TypeScript first (or require compiled JS) to import probes.

---

## CI Integration Recommendations

- Add a GitHub Actions job that runs the smoke tests on PRs. Keep the job short and focused on core functionality.
- Nightly job runs full integration tests and produces artifacts (reports, logs).
- Use matrix strategies to run on Windows/Linux/macOS for platform-specific checks.
- Fail PRs only on critical path tests; allow non-blocking longer tests.

---

## Documentation Consolidation

- Keep `manual-test-plan.md` as the authoritative manual acceptance test document
- Move runnable artifacts and scripts under `docs/testing/automation/`
- Keep `test-data-generator.js` but ensure its output is canonicalized into `automation/fixtures`
- Add `docs/testing/RELEASE-TEST-CHECKLIST.md` listing exactly which tests must pass for release

---

## Risks & Mitigations

- Network-dependent tests can be flaky in CI. Mitigate by:
  - Using local mocks for network services where possible
  - Skipping network-heavy tests on PRs and running them nightly
- Script probes rely on platform-specific behavior. Mitigate by:
  - Mark platform-dependent tests and run on appropriate runners
  - Provide Windows/Unix variants of scripts

---

## Timeline & Owners

- Week 1: Implement runner, move fixtures, add smoke script (Owner: Dev)
- Week 2: Add GitHub Actions smoke workflow, integrate results (Owner: DevOps)
- Week 3: Create integration test scripts and nightly workflow (Owner: DevOps)
- Week 4: Document process and train test owners (Owner: Tech Lead)

---

## Deliverables
- `docs/testing/automation/runner.js`
- `docs/testing/automation/fixtures/*.json`
- `docs/testing/automation/README.md`
- CI workflows: `.github/workflows/ci-smoke.yml`, `.github/workflows/nightly.yml`
- `package.json` scripts for smoke and integration tests
- `docs/testing/RELEASE-TEST-CHECKLIST.md`

---

If you'd like, I can implement the initial runner and add the smoke `npm` script plus a GitHub Actions workflow in this repo. Say "implement runner" and I'll proceed to add the files, run a quick smoke test locally (compiling if needed), and present results.
