# Test Implementation Scope

## Current State
- **Total Files**: 32 test files needed
- **Exists**: 8 files (25%)
- **Complete**: 3 files (9.4%)
- **Broken/Skeleton**: 5 files need fixes

## Coverage Targets
| Module | Files | Target | Priority |
|--------|-------|--------|----------|
| Core Business Logic | 4 | 85% | HIGH |
| Storage Layer | 4 | 80% | HIGH |
| React Components | 6 | 75% | MEDIUM |
| VS Code Integration | 5 | 70% | HIGH |
| Probes & Monitoring | 6 | 80% | HIGH |
| Utilities & Data | 4 | 75% | MEDIUM |
| Integration Tests | 4 | 70% | HIGH |

## File Status

### COMPLETE (3 files)
- `test/unit/react/OverviewView.test.tsx` - 67 tests
- `test/unit/react/TimelineNavigation.test.tsx` - 25 tests  
- `test/unit/outageDuration.test.ts` - 8 tests

### BROKEN/NEEDS FIX (5 files)
- `test/unit/storage/MySQLStorage.test.ts` - Fix mocking
- `test/unit/storage/ModularStorageManager.test.ts` - Fix backends
- `test/unit/probes.test.ts` - Fix VS Code imports
- `test/unit/dashboardUtils.test.ts` - Fix imports
- `test/integration/storage.test.ts` - Fix registration

### SKELETON (4 files)
- `test/unit/core/channels.test.ts`
- `test/unit/storage/core.test.ts`
- `test/unit/ui/statusBar.test.ts`
- `test/unit/react/components.test.tsx`

### MISSING (20 files)
**Core**: runner.test.ts, config.test.ts, scheduler.test.ts
**Storage**: DiskStorageAdapter.test.ts
**React**: TimelineHeatmapView.test.tsx, TimelineSwimlanesView.test.tsx, TimelineIncidentsView.test.tsx
**UI**: treeView.test.ts, dashboard.test.ts, notifications.test.ts, webview.test.ts
**Probes**: https.test.ts, tcp.test.ts, dns.test.ts, script.test.ts
**Utils**: stats.test.ts, report.test.ts
**Integration**: extension.test.ts, probes-integration.test.ts, watch-session.test.ts

## Implementation Order

### Phase 1: Fix Broken Tests
1. Fix MySQL mocking in `MySQLStorage.test.ts`
2. Fix backend registration in `ModularStorageManager.test.ts`
3. Fix VS Code imports in `probes.test.ts`
4. Fix import conflicts in `dashboardUtils.test.ts`
5. Fix backend setup in `storage.test.ts`

### Phase 2: Core Business Logic
1. Implement `core/runner.test.ts` - 20 tests
2. Implement `core/config.test.ts` - 12 tests
3. Enhance `core/channels.test.ts` - 15 tests
4. Implement `core/scheduler.test.ts` - 10 tests

### Phase 3: Critical Infrastructure
1. Implement `storage/DiskStorageAdapter.test.ts` - 15 tests
2. Implement `ui/treeView.test.ts` - 18 tests
3. Implement `ui/dashboard.test.ts` - 20 tests
4. Implement `probes/https.test.ts` - 18 tests

## Test Requirements

### Mocking Standards
- Use `vi.mock()` with `vi.hoisted()` for external modules
- Mock VS Code API via `test/setup.ts`
- Mock file system operations
- Mock network requests

### Test Patterns
- Arrange-Act-Assert structure
- Use data factories from `test/setup.ts`
- Test both success and error paths
- Include edge cases and boundary conditions

### Performance Criteria
- Unit tests: <100ms each
- Integration tests: <5s each
- Total test suite: <30s
- Coverage: 70% minimum

## GPT-5 Implementation Prompts

### For Each Broken Test:
"Fix [filename]: [specific issue]. Maintain existing test structure. Ensure all mocks work correctly."

### For Each Missing Test:
"Create [filename] testing [component/module]. Include [expected tests] test cases covering [focus areas]. Use patterns from existing complete tests."

### For Each Skeleton Test:
"Replace skeleton in [filename] with real tests for [functionality]. Target [expected tests] test cases with [coverage target]% coverage."

## Success Metrics
- [ ] All 32 test files exist and pass
- [ ] 70%+ coverage achieved
- [ ] No flaky or timing-dependent tests
- [ ] All mocks properly isolated
- [ ] CI/CD pipeline passes consistently