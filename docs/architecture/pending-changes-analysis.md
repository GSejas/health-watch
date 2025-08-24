# Health Watch - Pending Changes & Impact Analysis

## Overview
This document outlines the outstanding changes planned for Health Watch, their architectural impact, and implementation priorities based on the current system state.

## Outstanding Changes Summary

### 1. DEBUG-2: Coordination Status UI (🔒 Master/Follower Indicators)
**Priority: HIGH** - Critical for user troubleshooting

### 2. DETAILS-1: Channel Details UI (Hierarchical Settings View)  
**Priority: MEDIUM** - Improves user experience

### 3. DETAILS-2: Internal Diagnostics & Troubleshooting Reports
**Priority: MEDIUM** - Developer/power-user feature

### 4. CONFIG-1: Configuration System Simplification
**Priority: HIGH** - Addresses user confusion

### 5. INTERNET-7: Internet Monitoring Test Coverage
**Priority: LOW** - Feature is implemented, needs test coverage

---

## Detailed Change Impact Analysis

### 1. DEBUG-2: Coordination Status UI Implementation

#### **Current State**
- Multi-window coordination exists but status is opaque to users
- Users can't easily identify which window is the master
- Coordination issues are hard to troubleshoot

#### **Proposed Changes**
```typescript
// New UI Components
interface CoordinationStatusIndicator {
  role: 'leader' | 'follower' | 'unknown';
  windowId: string;
  lockStatus: 'acquired' | 'waiting' | 'error';
  lastHeartbeat?: number;
}

// Status Bar Enhancement
class EnhancedStatusBar {
  private coordinationIndicator: vscode.StatusBarItem;
  
  updateCoordinationStatus(status: CoordinationStatusIndicator): void {
    const icon = status.role === 'leader' ? '🔒' : '👥';
    const text = `${icon} Health: ${status.role}`;
    this.coordinationIndicator.text = text;
  }
}

// Tree View Enhancement  
class CoordinationTreeProvider implements vscode.TreeDataProvider<CoordinationNode> {
  getChildren(): CoordinationNode[] {
    return [
      new CoordinationNode('coordination-status', 'Multi-Window Status'),
      new CoordinationNode('lock-info', 'Lock Information'),
      new CoordinationNode('heartbeat-status', 'Heartbeat Status')
    ];
  }
}
```

#### **Impact Analysis**

**UI Layer Changes:**
- ✅ **Low Risk**: Additive changes to existing StatusBar and TreeView
- ✅ **No Breaking Changes**: Existing functionality preserved
- ⚠️ **Visual Consistency**: Need to ensure icons work across VS Code themes

**Coordination Layer Integration:**
- ✅ **Event-Driven**: Leverage existing coordination events
- ✅ **Non-Invasive**: No changes to core coordination logic required
- ⚠️ **Real-Time Updates**: Need efficient event subscription management

**Testing Impact:**
- ✅ **Well-Covered**: Coordination system has comprehensive stress tests
- ✅ **UI Testable**: Status bar and tree view have mock-friendly APIs
- ⚠️ **Integration Testing**: Need to verify UI updates with coordination changes

**Performance Impact:**
- ✅ **Minimal**: UI updates are event-driven, not polling
- ✅ **Efficient**: Status indicators use existing data
- ✅ **Low Memory**: Simple text/icon updates

---

### 2. DETAILS-1: Channel Details UI Implementation

#### **Current State**
- Basic channel list in tree view
- No detailed configuration visibility
- Limited per-channel actions

#### **Proposed Changes**
```typescript
// Enhanced Channel Details
interface ChannelDetailsView {
  effectiveConfig: ResolvedChannelConfig;
  inheritanceChain: ConfigSource[];
  recentSamples: Sample[];
  currentState: ChannelState;
  availableActions: ChannelAction[];
}

interface ResolvedChannelConfig {
  source: 'default' | 'workspace' | 'channel-override';
  intervalSec: { value: number; source: ConfigSource };
  timeoutMs: { value: number; source: ConfigSource };
  threshold: { value: number; source: ConfigSource };
  // ... other settings with source tracking
}

// Webview Panel for Details
class ChannelDetailsPanel {
  private panel: vscode.WebviewPanel;
  
  constructor(channelId: string) {
    this.panel = vscode.window.createWebviewPanel(
      'channelDetails',
      `Channel: ${channelId}`,
      vscode.ViewColumn.Two
    );
  }
  
  render(details: ChannelDetailsView): void {
    this.panel.webview.html = this.generateDetailsHTML(details);
  }
}
```

#### **Impact Analysis**

**Configuration System Changes:**
- ⚠️ **Medium Risk**: Need to track configuration source inheritance
- ⚠️ **Complexity**: Requires config resolution logic enhancement
- ✅ **Backward Compatible**: Existing config loading unchanged

**UI Architecture Impact:**
- ✅ **Webview Pattern**: Follows existing dashboard pattern
- ✅ **Reusable Components**: Can leverage dashboard CSS/React components  
- ⚠️ **State Management**: Need bidirectional webview communication

**Data Layer Integration:**
- ✅ **Read-Only**: Primarily displays existing data
- ⚠️ **Real-Time Updates**: Need live sample data streaming
- ⚠️ **Performance**: Large sample histories need pagination

**Testing Implications:**
- ⚠️ **Webview Testing**: Complex UI testing requirements
- ✅ **Config Resolution**: Pure functions, easy to unit test
- ⚠️ **Integration**: Full end-to-end testing needed

---

### 3. DETAILS-2: Internal Diagnostics Implementation

#### **Current State**
- Limited internal visibility into system behavior
- No structured debugging information
- Troubleshooting relies on VS Code output channel

#### **Proposed Changes**
```typescript
// Diagnostic Data Collection
interface SystemDiagnostics {
  coordination: {
    currentRole: 'leader' | 'follower';
    lockFileStatus: 'exists' | 'missing' | 'stale';
    heartbeatHistory: HeartbeatEvent[];
    roleChangeHistory: RoleChangeEvent[];
  };
  
  channels: Record<string, ChannelDiagnostics>;
  storage: StorageDiagnostics;
  performance: PerformanceMetrics;
}

interface ChannelDiagnostics {
  id: string;
  backoffState: {
    currentMultiplier: number;
    nextRunTime: number;
    consecutiveFailures: number;
  };
  
  runHistory: {
    startTime: number;
    endTime: number;
    result: 'success' | 'failure' | 'timeout';
    error?: string;
  }[];
  
  guardStatus: Record<string, 'pass' | 'fail' | 'unknown'>;
}

// Diagnostic Report Generation
class DiagnosticReporter {
  async generateReport(): Promise<SystemDiagnostics> {
    return {
      coordination: await this.collectCoordinationDiagnostics(),
      channels: await this.collectChannelDiagnostics(),
      storage: await this.collectStorageDiagnostics(),
      performance: await this.collectPerformanceMetrics()
    };
  }
  
  async exportDiagnostics(format: 'json' | 'markdown'): Promise<vscode.Uri> {
    const diagnostics = await this.generateReport();
    // Export logic...
  }
}
```

#### **Impact Analysis**

**Data Collection Impact:**
- ⚠️ **Performance Overhead**: Need efficient event tracking
- ⚠️ **Memory Usage**: Circular buffers for history data
- ✅ **Non-Invasive**: Passive observation of existing systems

**Architecture Changes:**
- ✅ **Event-Driven**: Leverage existing event infrastructure
- ⚠️ **Storage Requirements**: Need structured diagnostic data persistence
- ⚠️ **Privacy Concerns**: Ensure no sensitive data in diagnostics

**Integration Complexity:**
- ⚠️ **Cross-Module**: Touches all major system components
- ✅ **Loosely Coupled**: Diagnostic collection via events
- ⚠️ **Testing**: Need to verify diagnostic accuracy

---

### 4. CONFIG-1: Configuration System Simplification

#### **Current State Analysis**
```typescript
// Current Complex Configuration Structure
interface CurrentConfig {
  defaults: GlobalDefaults;           // Global defaults
  guards: Record<string, GuardDef>;   // Named guard definitions  
  channels: ChannelDefinition[];      // Channel-specific configs
  // Multiple inheritance layers, unclear precedence
}

// Issues Identified:
// 1. Unclear inheritance hierarchy
// 2. Complex guard resolution
// 3. No validation feedback
// 4. Confusing error messages
```

#### **Proposed Simplified Structure**
```typescript
// Simplified Configuration
interface SimplifiedConfig {
  // Clear, flat structure
  monitoring: {
    defaultInterval: number;
    defaultTimeout: number;
    defaultThreshold: number;
  };
  
  // Simplified guard syntax
  requirements: {
    vpn?: string;        // "wg0" instead of complex guard objects
    dns?: string;        // "intranet.local" instead of complex guard objects
  };
  
  // Streamlined channels
  channels: SimpleChannelDefinition[];
}

interface SimpleChannelDefinition {
  id: string;
  name: string;
  url: string;
  
  // Optional overrides (clearly marked)
  interval?: number;    // Override global default
  timeout?: number;     // Override global default  
  threshold?: number;   // Override global default
  
  // Simple requirements
  requiresVpn?: boolean;   // true/false instead of guard references
  requiresDns?: string;    // hostname instead of complex guard
}

// Migration Strategy
class ConfigMigration {
  async migrateToV2(oldConfig: CurrentConfig): Promise<SimplifiedConfig> {
    // Automatic migration with user confirmation
  }
  
  validateSimplifiedConfig(config: SimplifiedConfig): ValidationResult {
    // Clear, actionable validation errors
  }
}
```

#### **Impact Analysis**

**Breaking Changes:**
- ⚠️ **HIGH RISK**: Existing `.healthwatch.json` files become invalid
- ⚠️ **Migration Required**: Need automatic config upgrade path
- ⚠️ **Documentation**: All examples and docs need updates

**Complexity Reduction:**
- ✅ **Major Benefit**: Eliminates guard complexity
- ✅ **Clear Inheritance**: Simple override model
- ✅ **Better Validation**: Simpler structure = better error messages

**Implementation Strategy:**
- ✅ **Phased Approach**: Support both formats during transition
- ✅ **Migration Tool**: Automatic conversion with user approval
- ⚠️ **Rollback Plan**: Keep backup of original config

---

### 5. INTERNET-7: Internet Monitoring Test Coverage

#### **Current State**
- InternetCheckService implemented and functional
- Zero-config internet monitoring working
- Missing comprehensive test coverage

#### **Required Test Coverage**
```typescript
// Unit Tests Needed
describe('InternetCheckService', () => {
  describe('Network Detection', () => {
    it('should detect network connectivity changes');
    it('should handle DNS resolution failures');
    it('should retry failed connections');
  });
  
  describe('Coordination Integration', () => {
    it('should respect leader/follower roles');
    it('should start monitoring when becoming leader');
    it('should stop monitoring when becoming follower');
  });
  
  describe('State Persistence', () => {
    it('should persist connectivity status');
    it('should restore status on restart');
  });
});

// Integration Tests Needed  
describe('Internet Monitoring Integration', () => {
  it('should detect actual network connectivity');
  it('should integrate with channel monitoring');
  it('should respect quiet hours settings');
});
```

#### **Impact Analysis**

**Risk Assessment:**
- ✅ **Low Risk**: Feature already implemented and working
- ✅ **Non-Breaking**: Adding tests doesn't affect functionality
- ✅ **High Value**: Prevents regression in critical feature

**Testing Infrastructure:**
- ✅ **Foundation Exists**: Comprehensive testing framework already established
- ✅ **Patterns Available**: Similar coordination tests already implemented
- ✅ **Mocking Ready**: Network mocking patterns established

---

## Implementation Priority & Sequencing

### **Phase 1: Critical User Experience (Immediate)**
1. **DEBUG-2** - Coordination status UI
   - **Why First**: Users need visibility into coordination status for troubleshooting
   - **Risk**: Low implementation risk, high user value
   - **Effort**: 1-2 days

2. **CONFIG-1** - Configuration simplification  
   - **Why Second**: Addresses core user confusion
   - **Risk**: High (breaking changes) but necessary
   - **Effort**: 3-4 days with migration strategy

### **Phase 2: Enhanced Functionality (Next Sprint)**
3. **DETAILS-1** - Channel details UI
   - **Why Third**: Builds on config simplification
   - **Risk**: Medium (new webview complexity)
   - **Effort**: 2-3 days

4. **INTERNET-7** - Internet monitoring tests
   - **Why Fourth**: Low risk, completes existing feature
   - **Risk**: Very low  
   - **Effort**: 1 day

### **Phase 3: Advanced Features (Future)**
5. **DETAILS-2** - Internal diagnostics
   - **Why Last**: Power-user feature, can leverage other UI improvements
   - **Risk**: Medium (cross-system integration)
   - **Effort**: 2-3 days

## Architectural Considerations

### **Consistency Principles**
- **UI Patterns**: Maintain consistency with existing dashboard/webview patterns
- **Event Architecture**: Leverage existing event-driven coordination system
- **Configuration**: Move toward simpler, more intuitive configuration model
- **Testing**: Maintain high test coverage standards established in recent work

### **Risk Mitigation**
- **Breaking Changes**: Implement migration strategies with user approval
- **Complex UI**: Use established webview patterns and reusable components
- **Performance**: Event-driven updates, avoid polling where possible
- **Backwards Compatibility**: Support transition periods for major changes

### **Success Metrics**
- **User Experience**: Reduced confusion around coordination and configuration
- **Reliability**: Maintained high system stability during changes
- **Maintainability**: Simpler configuration system reduces support burden
- **Observability**: Better internal diagnostics for troubleshooting

---

## Next Steps

The implementation should begin with **DEBUG-2 (Coordination Status UI)** as it provides immediate user value with minimal risk, followed by the configuration simplification work that addresses the core user experience issues.