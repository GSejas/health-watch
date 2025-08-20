# Health Watch Test Plan

## Test Infrastructure Setup ✅
- Vitest + jsdom for modern testing
- React Testing Library for component tests  
- Coverage reporting with 70% thresholds
- VS Code API mocking complete
- File system mocking ready

## Test Categories & Status

### 1. Unit Tests (`test/unit/`)

#### Core Business Logic
- `core/channels.test.ts` ⚪ SKELETON - Channel validation, state transitions
- `core/runner.test.ts` ⚪ SKELETON - Probe execution, scheduling, backoff logic  
- `core/guards.test.ts` ✅ EXISTS - Network interface and DNS guards
- `core/config.test.ts` ⚪ SKELETON - Configuration loading, validation, merging

#### Storage Layer 
- `storage/MySQLStorage.test.ts` ✅ COMPLETE - Full MySQL backend with mocks
- `storage/ModularStorageManager.test.ts` ✅ COMPLETE - Backend coordination, failover
- `storage/core.test.ts` ⚪ SKELETON - Basic storage operations
- `storage/DiskStorageAdapter.test.ts` ⚪ SKELETON - File storage adapter

#### Probes & Monitoring
- `probes.test.ts` ✅ EXISTS - HTTP, TCP, DNS probe tests
- `probes/https.test.ts` ⚪ SKELETON - HTTPS-specific probe logic
- `probes/tcp.test.ts` ⚪ SKELETON - TCP connection testing
- `probes/dns.test.ts` ⚪ SKELETON - DNS resolution testing

#### UI Components (React)
- `react/OverviewView.test.tsx` ✅ COMPLETE - Full component with interactions
- `react/TimelineNavigation.test.tsx` ✅ COMPLETE - Navigation dropdown testing
- `react/components.test.tsx` ⚪ SKELETON - Additional React components
- `react/TimelineHeatmapView.test.tsx` ⚪ SKELETON - Heatmap visualization
- `react/TimelineSwimlanesView.test.tsx` ⚪ SKELETON - Swimlanes view
- `react/TimelineIncidentsView.test.tsx` ⚪ SKELETON - Incidents timeline

#### VS Code Integration
- `ui/statusBar.test.ts` ⚪ SKELETON - Status bar updates, click handling
- `ui/treeView.test.ts` ⚪ SKELETON - Tree view provider, refresh actions
- `ui/dashboard.test.ts` ⚪ SKELETON - Dashboard panel management
- `ui/notifications.test.ts` ⚪ SKELETON - Toast notifications, fishy detection

#### Utilities & Data Processing
- `dashboardUtils.test.ts` ✅ EXISTS - Time formatting, data processing
- `stats.test.ts` ⚪ SKELETON - Availability calculations, p95 metrics
- `report.test.ts` ⚪ SKELETON - Markdown generation, Mermaid diagrams

### 2. Integration Tests (`test/integration/`)
- `storage.test.ts` ✅ COMPLETE - End-to-end storage workflows
- `extension.test.ts` ⚪ SKELETON - Full extension lifecycle testing
- `probes-integration.test.ts` ⚪ SKELETON - Real network probe testing
- `watch-session.test.ts` ⚪ SKELETON - Complete watch session flow

### 3. E2E Tests (`test/e2e/`) ✅ EXISTS
- Basic extension activation tests already exist
- Additional webview and command tests needed

## Test Commands Available
```bash
npm run test           # Run all tests with watch mode
npm run test:unit      # Unit tests only  
npm run test:integration # Integration tests only
npm run test:coverage  # Generate coverage report
npm run test:watch     # Watch mode for development
npm run test:e2e       # VS Code extension tests
```

## Mock Infrastructure Ready
- Complete VS Code API mocking
- File system operation mocks
- Network request mocking setup
- React component testing utilities
- Test data factories (channels, states, samples, etc.)

## Coverage Targets
- **70% minimum** across lines, functions, branches, statements
- **High-priority areas**: Storage backends, probe logic, state management
- **Medium-priority**: UI components, utilities
- **Low-priority**: Configuration, constants

## Next Steps for GPT-5
1. **Implement skeleton tests** - Replace `expect(true).toBe(true)` with real test logic
2. **Add missing test files** - Create tests for components not yet covered  
3. **Enhance integration tests** - Add realistic data flows and error scenarios
4. **Improve coverage** - Focus on core business logic and edge cases
5. **Performance tests** - Add tests for large dataset handling, memory usage

## Test Data Patterns
Use provided factories in `test/setup.ts`:
- `createMockChannel(id, overrides)`
- `createMockChannelState(overrides)` 
- `createMockSample(overrides)`
- `createMockOutage(channelId, overrides)`
- `createMockWatchSession(overrides)`

## Key Testing Priorities
1. **Storage reliability** - Data persistence, corruption recovery
2. **Probe accuracy** - Network condition detection, timeout handling
3. **State management** - Transitions, consistency, race conditions  
4. **UI responsiveness** - Component updates, user interactions
5. **Error handling** - Graceful degradation, user feedback