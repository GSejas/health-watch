# Health Watch Test Automation Plan

## Test Coverage Tracking & Organization

### Current Coverage Status
```bash
# Generate coverage report
npm run test:coverage

# View coverage in browser
open coverage/index.html
```

### Coverage Targets by Module
| Module | Current | Target | Priority | Status |
|--------|---------|--------|----------|--------|
| **Core Business Logic** | 15% | 85% | HIGH | 🔴 NEEDS WORK |
| **Storage Layer** | 45% | 80% | HIGH | 🟡 IN PROGRESS |
| **React Components** | 70% | 75% | MEDIUM | 🟢 GOOD |
| **VS Code Integration** | 10% | 70% | HIGH | 🔴 NEEDS WORK |
| **Probes & Monitoring** | 30% | 80% | HIGH | 🟡 IN PROGRESS |
| **Utilities & Data** | 60% | 75% | MEDIUM | 🟡 IN PROGRESS |

---

## Module-Specific Test Implementation

### 📦 **Module 1: Core Business Logic**
**Files to implement:** `test/unit/core/`

#### Prompt for GPT-5:
```
Implement comprehensive unit tests for Health Watch core business logic:

FILES TO CREATE:
- test/unit/core/channels.test.ts
- test/unit/core/runner.test.ts  
- test/unit/core/config.test.ts
- test/unit/core/scheduler.test.ts

FOCUS AREAS:
1. Channel state management (online→offline→online transitions)
2. Probe scheduling with jitter and backoff logic
3. Configuration validation and merging
4. Threshold-based state changes (3 consecutive failures = offline)
5. Edge cases: race conditions, invalid configs, network flaps

TEST PATTERNS:
- Mock VS Code API using setup.ts utilities
- Use createMockChannel(), createMockChannelState() factories
- Test both happy path and error scenarios
- Verify state persistence across operations
- Test concurrent channel operations

COVERAGE TARGET: 85% for src/runner/, src/config.ts, channel management
```

#### Expected Files:
- ✅ `test/unit/core/channels.test.ts` (SKELETON EXISTS)
- ❌ `test/unit/core/runner.test.ts` (CREATE)
- ❌ `test/unit/core/config.test.ts` (CREATE)
- ❌ `test/unit/core/scheduler.test.ts` (CREATE)

---

### 🗄️ **Module 2: Storage Layer**
**Files to implement:** `test/unit/storage/`

#### Prompt for GPT-5:
```
Complete storage layer tests for Health Watch modular storage system:

FILES TO ENHANCE/CREATE:
- test/unit/storage/DiskStorageAdapter.test.ts (CREATE)
- test/unit/storage/core.test.ts (ENHANCE SKELETON)
- Fix: test/unit/storage/MySQLStorage.test.ts (FIX MOCKING)
- Fix: test/unit/storage/ModularStorageManager.test.ts (FIX BACKEND REGISTRATION)

FOCUS AREAS:
1. Backend failover scenarios (MySQL fails → fallback to disk)
2. Data consistency across storage operations
3. Concurrent read/write operations
4. Storage cleanup and retention policies
5. Error handling and recovery

TEST REQUIREMENTS:
- Mock mysql2/promise properly with vi.hoisted()
- Test disk storage file operations with fs mocks
- Verify backend health monitoring
- Test storage statistics collection
- Validate data migration scenarios

COVERAGE TARGET: 80% for src/storage/ directory
```

#### Expected Files:
- ✅ `test/unit/storage/MySQLStorage.test.ts` (EXISTS - FIX MOCKING)
- ✅ `test/unit/storage/ModularStorageManager.test.ts` (EXISTS - FIX BACKENDS)
- ✅ `test/unit/storage/core.test.ts` (SKELETON - ENHANCE)
- ❌ `test/unit/storage/DiskStorageAdapter.test.ts` (CREATE)

---

### ⚛️ **Module 3: React Components**
**Files to implement:** `test/unit/react/`

#### Prompt for GPT-5:
```
Complete React component test suite for Health Watch dashboard:

FILES TO CREATE/ENHANCE:
- test/unit/react/TimelineHeatmapView.test.tsx (CREATE)
- test/unit/react/TimelineSwimlanesView.test.tsx (CREATE)
- test/unit/react/TimelineIncidentsView.test.tsx (CREATE)
- test/unit/react/components.test.tsx (ENHANCE SKELETON)

FOCUS AREAS:
1. Component rendering with different prop combinations
2. User interactions (clicks, hovers, form inputs)
3. VS Code message posting (vscode.postMessage calls)
4. Data visualization accuracy (heatmaps, charts)
5. Responsive behavior and error states

TEST PATTERNS:
- Use React Testing Library best practices
- Mock window.vscode from setup.ts
- Test accessibility features
- Verify data transformations (Map → Object conversions)
- Test time range and filter interactions

COVERAGE TARGET: 75% for src/ui/react/ directory
CURRENT STATUS: OverviewView ✅ DONE, TimelineNavigation ✅ DONE
```

#### Expected Files:
- ✅ `test/unit/react/OverviewView.test.tsx` (COMPLETE)
- ✅ `test/unit/react/TimelineNavigation.test.tsx` (COMPLETE)
- ✅ `test/unit/react/components.test.tsx` (SKELETON - ENHANCE)
- ❌ `test/unit/react/TimelineHeatmapView.test.tsx` (CREATE)
- ❌ `test/unit/react/TimelineSwimlanesView.test.tsx` (CREATE)
- ❌ `test/unit/react/TimelineIncidentsView.test.tsx` (CREATE)

---

### Lessons learned (recent work)

- Replaced ambiguous text-based selectors with scoped queries (use `within()` and `closest()` to avoid flakiness). This fixed many intermittent failures.
- Added smoke tests for index/mount functions to exercise export/mount paths — quick high-coverage wins for index files.
- Mocked deterministic sources (Math.random, formatRelativeTime) in tests to avoid flakiness in visualization and time formatting tests.
- Avoid dynamic requires in tests; prefer static imports to keep TypeScript transforms predictable.
- Split test runs while iterating (single-file or `test/unit/react`) to avoid unrelated integration/storage failures during development.

Status update:
- React components: coverage for `src/ui/react` now exceeds target (recent run: MetricsView ~96% statements, OverviewView ~95%, timeline views ~94%).
- `test/unit/dashboardUtils.test.ts` fixed and added new unit tests for utilities.


---

### 🎨 **Module 4: VS Code Integration**
**Files to implement:** `test/unit/ui/`

#### Prompt for GPT-5:
```
Implement VS Code integration tests for Health Watch extension:

FILES TO CREATE/ENHANCE:
- test/unit/ui/statusBar.test.ts (ENHANCE SKELETON)
- test/unit/ui/treeView.test.ts (CREATE)
- test/unit/ui/dashboard.test.ts (CREATE)
- test/unit/ui/notifications.test.ts (CREATE)
- test/unit/ui/webview.test.ts (CREATE)

FOCUS AREAS:
1. Status bar updates and click handling
2. Tree view provider data and refresh actions
3. Dashboard panel lifecycle management
4. Toast notifications and fishy detection
5. Webview message passing and CSP compliance

TEST REQUIREMENTS:
- Mock VS Code API extensively (window, commands, workspace)
- Test extension activation and deactivation
- Verify command registration and execution
- Test webview HTML generation and messaging
- Validate event handling and subscriptions

COVERAGE TARGET: 70% for src/ui/ directory (excluding React components)
```

#### Expected Files:
- ✅ `test/unit/ui/statusBar.test.ts` (SKELETON - ENHANCE)
- ❌ `test/unit/ui/treeView.test.ts` (CREATE)
- ❌ `test/unit/ui/dashboard.test.ts` (CREATE)
- ❌ `test/unit/ui/notifications.test.ts` (CREATE)
- ❌ `test/unit/ui/webview.test.ts` (CREATE)

---

### 🔍 **Module 5: Probes & Monitoring**
**Files to implement:** `test/unit/probes/`

#### Prompt for GPT-5:
```
Complete probe and monitoring tests for Health Watch:

FILES TO CREATE/ENHANCE:
- test/unit/probes/https.test.ts (CREATE)
- test/unit/probes/tcp.test.ts (CREATE)
- test/unit/probes/dns.test.ts (CREATE)
- test/unit/probes/script.test.ts (CREATE)
- Fix: test/unit/probes.test.ts (FIX VS CODE IMPORT)
- Fix: test/unit/guards.test.ts (ENHANCE EXISTING)

FOCUS AREAS:
1. HTTP/HTTPS probe logic with different response codes
2. TCP connection testing and timeout handling
3. DNS resolution with different record types
4. Script execution with security warnings
5. Guard evaluation (netIfUp, DNS resolution)

TEST REQUIREMENTS:
- Mock network operations (http, dns, net modules)
- Test timeout and retry logic
- Verify probe result formatting
- Test guard conditions and failures
- Mock child_process for script probes

COVERAGE TARGET: 80% for src/probes/ and src/guards.ts
CURRENT STATUS: Basic probes.test.ts exists but has import issues
```

#### Expected Files:
- ✅ `test/unit/probes.test.ts` (EXISTS - FIX IMPORTS)
- ✅ `test/unit/guards.test.ts` (EXISTS - ENHANCE)
- ❌ `test/unit/probes/https.test.ts` (CREATE)
- ❌ `test/unit/probes/tcp.test.ts` (CREATE)
- ❌ `test/unit/probes/dns.test.ts` (CREATE)
- ❌ `test/unit/probes/script.test.ts` (CREATE)

---

### 🛠️ **Module 6: Utilities & Data Processing**
**Files to implement:** `test/unit/utils/`

#### Prompt for GPT-5:
```
Complete utility and data processing tests:

FILES TO CREATE/ENHANCE:
- test/unit/stats.test.ts (CREATE)
- test/unit/report.test.ts (CREATE)
- Fix: test/unit/dashboardUtils.test.ts (FIX MOCHA IMPORT)
- test/unit/outageDuration.test.ts (EXISTS - VERIFY)

FOCUS AREAS:
1. Statistical calculations (availability %, p95 latency)
2. Markdown report generation with Mermaid diagrams
3. Time formatting and relative time calculations
4. Outage detection and duration computation
5. Data aggregation and windowing

TEST REQUIREMENTS:
- Test statistical accuracy with known datasets
- Verify Mermaid diagram generation with real timestamps
- Test edge cases (no data, extreme values)
- Validate report formatting and links
- Test time zone handling and DST

COVERAGE TARGET: 75% for utility functions and data processing
CURRENT STATUS: dashboardUtils.test.ts exists but has import conflicts
```

#### Expected Files:
- ✅ `test/unit/dashboardUtils.test.ts` (EXISTS - FIX IMPORTS)
- ✅ `test/unit/outageDuration.test.ts` (EXISTS - VERIFY)
- ❌ `test/unit/stats.test.ts` (CREATE)
- ❌ `test/unit/report.test.ts` (CREATE)

---

## Integration Test Modules

### 🔄 **Module 7: End-to-End Workflows**
**Files to implement:** `test/integration/`

#### Prompt for GPT-5:
```
Complete integration tests for Health Watch workflows:

FILES TO ENHANCE/CREATE:
- Fix: test/integration/storage.test.ts (FIX BACKEND REGISTRATION)
- test/integration/extension.test.ts (CREATE)
- test/integration/probes-integration.test.ts (CREATE)
- test/integration/watch-session.test.ts (CREATE)

FOCUS AREAS:
1. Complete watch session lifecycle
2. Real probe execution with network timeouts
3. Storage backend switching and failover
4. Extension activation and command execution
5. Report generation and file output

TEST REQUIREMENTS:
- Use temporary directories for file operations
- Mock network requests but test real timeouts
- Test multi-backend storage scenarios
- Verify extension commands and webview creation
- Test report file generation and cleanup

COVERAGE TARGET: Integration coverage for critical user workflows
```

---

## Test Execution Strategy

### 🏃 **Running Tests**
```bash
# Development workflow
npm run test:watch          # Continuous testing during development

# Before commit
npm run test:coverage       # Full test suite with coverage
npm run lint               # Code quality checks

# CI/CD pipeline
npm run test:unit          # Fast unit tests
npm run test:integration   # Slower integration tests
npm run test:e2e          # VS Code extension tests (slowest)
```

### 📊 **Coverage Monitoring**
```bash
# Generate detailed coverage report
npm run test:coverage

# Coverage files generated:
coverage/
├── index.html              # Interactive HTML report
├── coverage-final.json     # Raw coverage data
└── lcov.info              # LCOV format for CI tools
```

### 🎯 **Coverage Thresholds**
```json
// vitest.config.ts - Current thresholds
"thresholds": {
  "global": {
    "branches": 70,
    "functions": 70, 
    "lines": 70,
    "statements": 70
  }
}
```

### 📈 **Test Metrics Tracking**
Create `test-metrics.json` to track progress:
```json
{
  "lastUpdate": "2024-01-20",
  "modules": {
    "core": { "coverage": 15, "target": 85, "files": 1, "tests": 3 },
    "storage": { "coverage": 45, "target": 80, "files": 4, "tests": 25 },
    "react": { "coverage": 70, "target": 75, "files": 3, "tests": 67 },
    "ui": { "coverage": 10, "target": 70, "files": 1, "tests": 2 },
    "probes": { "coverage": 30, "target": 80, "files": 2, "tests": 10 },
    "utils": { "coverage": 60, "target": 75, "files": 2, "tests": 15 }
  }
}
```

---

## Implementation Priority

### 🔥 **Phase 1: Critical (Week 1)**
1. **Core Business Logic** - Channel management and state transitions
2. **Storage Layer** - Fix existing tests and add disk adapter
3. **Probes & Monitoring** - Fix import issues and add specific probe tests

### ⚡ **Phase 2: Important (Week 2)**  
1. **VS Code Integration** - UI components and extension lifecycle
2. **React Components** - Timeline views and interactions
3. **Utilities** - Statistics and report generation

### 🎨 **Phase 3: Enhancement (Week 3)**
1. **Integration Tests** - End-to-end workflows
2. **Performance Tests** - Large dataset handling
3. **Edge Case Coverage** - Error scenarios and boundary conditions

---

## Success Metrics

### ✅ **Definition of Done**
- [ ] All skeleton tests replaced with real implementations
- [ ] 70%+ coverage across all modules  
- [ ] All tests pass in CI environment
- [ ] No mocking/import errors
- [ ] Integration tests cover critical workflows
- [ ] Performance benchmarks established

### 📋 **Test Quality Checklist**
- [ ] Tests are deterministic (no flaky tests)
- [ ] Mocks are properly isolated
- [ ] Error scenarios are covered
- [ ] Edge cases are tested
- [ ] Tests are readable and maintainable
- [ ] Performance implications are considered