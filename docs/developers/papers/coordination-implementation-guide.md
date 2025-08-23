# Implementation Guide: Multi-Window Coordination in VS Code Extensions

**Companion to**: Multi-Window Coordination Patterns (Academic Paper)  
**Audience**: Extension Developers  
**Level**: Intermediate to Advanced  
**Updated**: August 22, 2025

## Quick Start: File-Based Leader Election

This guide provides ready-to-use implementations for the coordination patterns discussed in the academic paper. All code is production-ready and tested.

### Basic Leader Election (5-minute implementation)

```typescript
// src/coordination/simpleLeader.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

export class SimpleLeaderElection {
  private lockPath: string;
  private isLeader = false;
  private heartbeatTimer?: NodeJS.Timeout;
  private readonly windowId: string;

  constructor(workspaceRoot: string) {
    this.windowId = `${process.pid}-${Date.now()}`;
    this.lockPath = path.join(workspaceRoot, '.healthwatch', 'leader.lock');
  }

  async tryBecomeLeader(): Promise<boolean> {
    try {
      await fs.mkdir(path.dirname(this.lockPath), { recursive: true });
      
      const lockData = {
        windowId: this.windowId,
        pid: process.pid,
        timestamp: Date.now()
      };

      // Atomic write: fail if file exists
      await fs.writeFile(this.lockPath, JSON.stringify(lockData), { flag: 'wx' });
      
      this.isLeader = true;
      this.startHeartbeat();
      
      vscode.window.showInformationMessage('Became leader window');
      return true;
      
    } catch (error: any) {
      if (error.code === 'EEXIST') {
        // Check if existing lock is stale
        return await this.checkAndClaimStaleLock();
      }
      throw error;
    }
  }

  private async checkAndClaimStaleLock(): Promise<boolean> {
    try {
      const lockContent = await fs.readFile(this.lockPath, 'utf8');
      const lockData = JSON.parse(lockContent);
      
      // Consider lock stale after 10 seconds
      if (Date.now() - lockData.timestamp > 10000) {
        await fs.unlink(this.lockPath);
        return this.tryBecomeLeader(); // Retry
      }
      
      return false; // Lock is fresh, not leader
    } catch {
      // Lock file corrupted, claim it
      try {
        await fs.unlink(this.lockPath);
        return this.tryBecomeLeader();
      } catch {
        return false;
      }
    }
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(async () => {
      try {
        const lockData = {
          windowId: this.windowId,
          pid: process.pid,
          timestamp: Date.now()
        };

        await fs.writeFile(this.lockPath, JSON.stringify(lockData));
      } catch (error) {
        console.error('Lost leadership:', error);
        this.resignLeadership();
      }
    }, 3000);
  }

  async resignLeadership() {
    this.isLeader = false;
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    try {
      const lockContent = await fs.readFile(this.lockPath, 'utf8');
      const lockData = JSON.parse(lockContent);
      
      // Only remove if we own it
      if (lockData.windowId === this.windowId) {
        await fs.unlink(this.lockPath);
      }
    } catch {
      // Already removed or corrupted
    }
  }

  getStatus() {
    return {
      isLeader: this.isLeader,
      windowId: this.windowId
    };
  }
}
```

### Usage in Extension

```typescript
// src/extension.ts
import * as vscode from 'vscode';
import { SimpleLeaderElection } from './coordination/simpleLeader';

let leaderElection: SimpleLeaderElection;

export async function activate(context: vscode.ExtensionContext) {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) return;

  leaderElection = new SimpleLeaderElection(workspaceRoot);
  
  // Try to become leader
  const becameLeader = await leaderElection.tryBecomeLeader();
  
  if (becameLeader) {
    // Start leader-only services (scheduler, probes)
    console.log('Starting as leader');
  } else {
    // Start follower services (UI updates only)
    console.log('Starting as follower');
  }

  // Clean up on deactivation
  context.subscriptions.push(
    new vscode.Disposable(() => leaderElection?.resignLeadership())
  );
}
```

## Advanced: State Synchronization

### Shared State Manager

```typescript
// src/coordination/stateManager.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';

export interface SharedState {
  channels: Record<string, any>;
  lastUpdate: number;
  leader: string;
  version: number;
}

export class StateManager extends EventEmitter {
  private statePath: string;
  private watchTimer?: NodeJS.Timeout;
  private lastKnownVersion = 0;
  private writeQueue: SharedState[] = [];
  private isWriting = false;

  constructor(workspaceRoot: string) {
    super();
    this.statePath = path.join(workspaceRoot, '.healthwatch', 'state.json');
  }

  async writeState(state: Partial<SharedState>) {
    const fullState: SharedState = {
      channels: {},
      lastUpdate: Date.now(),
      leader: '',
      version: this.lastKnownVersion + 1,
      ...state
    };

    // Queue write to avoid conflicts
    this.writeQueue.push(fullState);
    await this.processWriteQueue();
  }

  private async processWriteQueue() {
    if (this.isWriting || this.writeQueue.length === 0) return;

    this.isWriting = true;
    const state = this.writeQueue.pop()!; // Take latest
    this.writeQueue = []; // Clear queue

    try {
      await fs.mkdir(path.dirname(this.statePath), { recursive: true });
      
      // Atomic write with temp file
      const tempPath = `${this.statePath}.tmp.${process.pid}`;
      await fs.writeFile(tempPath, JSON.stringify(state, null, 2));
      await fs.rename(tempPath, this.statePath);
      
      this.lastKnownVersion = state.version;
    } catch (error) {
      console.error('State write failed:', error);
    }

    this.isWriting = false;

    // Process any new writes that came in
    if (this.writeQueue.length > 0) {
      setImmediate(() => this.processWriteQueue());
    }
  }

  async readState(): Promise<SharedState | null> {
    try {
      const content = await fs.readFile(this.statePath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  startWatching() {
    this.watchTimer = setInterval(async () => {
      try {
        const state = await this.readState();
        if (state && state.version > this.lastKnownVersion) {
          this.lastKnownVersion = state.version;
          this.emit('stateChanged', state);
        }
      } catch (error) {
        console.error('State watch error:', error);
      }
    }, 1000);
  }

  stopWatching() {
    if (this.watchTimer) {
      clearInterval(this.watchTimer);
      this.watchTimer = undefined;
    }
  }
}
```

### Integration Example

```typescript
// src/coordination/coordinator.ts
import { SimpleLeaderElection } from './simpleLeader';
import { StateManager } from './stateManager';
import { EventEmitter } from 'events';

export class WindowCoordinator extends EventEmitter {
  private leader: SimpleLeaderElection;
  private state: StateManager;
  private isLeader = false;

  constructor(workspaceRoot: string) {
    super();
    this.leader = new SimpleLeaderElection(workspaceRoot);
    this.state = new StateManager(workspaceRoot);
  }

  async start() {
    // Try to become leader
    this.isLeader = await this.leader.tryBecomeLeader();
    
    // Start watching state changes
    this.state.startWatching();
    this.state.on('stateChanged', (state) => {
      this.emit('stateUpdate', state);
    });

    // Set up leadership monitoring
    if (!this.isLeader) {
      this.monitorLeadership();
    }

    this.emit('coordinationReady', { isLeader: this.isLeader });
  }

  async updateState(channels: Record<string, any>) {
    if (!this.isLeader) {
      throw new Error('Only leader can update state');
    }

    await this.state.writeState({
      channels,
      leader: this.leader.getStatus().windowId,
      lastUpdate: Date.now()
    });
  }

  private monitorLeadership() {
    const checkInterval = setInterval(async () => {
      if (this.isLeader) {
        clearInterval(checkInterval);
        return;
      }

      // Try to become leader if current leader seems gone
      const becameLeader = await this.leader.tryBecomeLeader();
      if (becameLeader) {
        this.isLeader = true;
        this.emit('becameLeader');
        clearInterval(checkInterval);
      }
    }, 5000);
  }

  async stop() {
    await this.leader.resignLeadership();
    this.state.stopWatching();
    this.removeAllListeners();
  }

  getStatus() {
    return {
      isLeader: this.isLeader,
      ...this.leader.getStatus()
    };
  }
}
```

## Production-Ready: Named Pipe IPC

For high-performance scenarios, here's a cross-platform named pipe implementation:

```typescript
// src/coordination/namedPipeIPC.ts
import * as net from 'net';
import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';

export class NamedPipeCoordinator extends EventEmitter {
  private server?: net.Server;
  private clients = new Map<string, net.Socket>();
  private pipePath: string;
  private isLeader = false;

  constructor(private workspaceRoot: string) {
    super();
    this.pipePath = this.getPipePath();
  }

  private getPipePath(): string {
    if (process.platform === 'win32') {
      return `\\\\.\\pipe\\healthwatch-${this.getWorkspaceHash()}`;
    } else {
      return path.join(this.workspaceRoot, '.healthwatch', 'coordination.sock');
    }
  }

  private getWorkspaceHash(): string {
    // Simple hash of workspace path for unique pipe names
    return this.workspaceRoot.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0).toString(36);
  }

  async startAsLeader(): Promise<boolean> {
    try {
      // Clean up existing socket file on Unix
      if (process.platform !== 'win32') {
        await fs.mkdir(path.dirname(this.pipePath), { recursive: true });
        await fs.unlink(this.pipePath).catch(() => {});
      }

      this.server = net.createServer(this.handleConnection.bind(this));
      
      await new Promise<void>((resolve, reject) => {
        this.server!.listen(this.pipePath, () => resolve());
        this.server!.on('error', reject);
      });

      // Set permissions on Unix
      if (process.platform !== 'win32') {
        await fs.chmod(this.pipePath, 0o600);
      }

      this.isLeader = true;
      console.log(`Leader listening on ${this.pipePath}`);
      return true;

    } catch (error: any) {
      if (error.code === 'EADDRINUSE' || error.code === 'EACCES') {
        // Another leader exists
        return false;
      }
      throw error;
    }
  }

  async connectAsFollower(): Promise<boolean> {
    try {
      const socket = net.createConnection(this.pipePath);
      
      await new Promise<void>((resolve, reject) => {
        socket.on('connect', () => resolve());
        socket.on('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });

      socket.on('data', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.emit('message', message);
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      });

      socket.on('close', () => {
        this.emit('leaderDisconnected');
      });

      this.clients.set('leader', socket);
      return true;

    } catch (error) {
      console.log('Could not connect to leader:', error.message);
      return false;
    }
  }

  private handleConnection(socket: net.Socket) {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.clients.set(clientId, socket);

    socket.on('data', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.emit('clientMessage', clientId, message);
      } catch (error) {
        console.error('Failed to parse client message:', error);
      }
    });

    socket.on('close', () => {
      this.clients.delete(clientId);
      this.emit('clientDisconnected', clientId);
    });

    socket.on('error', (error) => {
      console.error(`Client ${clientId} error:`, error);
      this.clients.delete(clientId);
    });

    // Send welcome message
    this.sendToClient(clientId, { type: 'welcome', clientId });
  }

  broadcast(message: any) {
    if (!this.isLeader) {
      throw new Error('Only leader can broadcast');
    }

    const data = JSON.stringify(message);
    this.clients.forEach((socket, clientId) => {
      try {
        socket.write(data);
      } catch (error) {
        console.error(`Failed to send to ${clientId}:`, error);
        this.clients.delete(clientId);
      }
    });
  }

  sendToClient(clientId: string, message: any) {
    const socket = this.clients.get(clientId);
    if (socket) {
      try {
        socket.write(JSON.stringify(message));
      } catch (error) {
        console.error(`Failed to send to ${clientId}:`, error);
        this.clients.delete(clientId);
      }
    }
  }

  sendToLeader(message: any) {
    if (this.isLeader) {
      throw new Error('Leader cannot send to itself');
    }

    const leaderSocket = this.clients.get('leader');
    if (leaderSocket) {
      try {
        leaderSocket.write(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send to leader:', error);
        this.emit('leaderDisconnected');
      }
    }
  }

  async stop() {
    // Close all client connections
    this.clients.forEach((socket) => {
      socket.destroy();
    });
    this.clients.clear();

    // Close server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
    }

    // Clean up socket file on Unix
    if (process.platform !== 'win32' && this.isLeader) {
      await fs.unlink(this.pipePath).catch(() => {});
    }

    this.removeAllListeners();
  }

  getStatus() {
    return {
      isLeader: this.isLeader,
      clientCount: this.clients.size,
      pipePath: this.pipePath
    };
  }
}
```

## Testing Your Implementation

### Unit Tests

```typescript
// test/coordination.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SimpleLeaderElection } from '../src/coordination/simpleLeader';
import { StateManager } from '../src/coordination/stateManager';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Coordination System', () => {
  let tempDir: string;
  let leader1: SimpleLeaderElection;
  let leader2: SimpleLeaderElection;
  let stateManager: StateManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coord-test-'));
    leader1 = new SimpleLeaderElection(tempDir);
    leader2 = new SimpleLeaderElection(tempDir);
    stateManager = new StateManager(tempDir);
  });

  afterEach(async () => {
    await leader1.resignLeadership();
    await leader2.resignLeadership();
    stateManager.stopWatching();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should elect single leader', async () => {
    const result1 = await leader1.tryBecomeLeader();
    const result2 = await leader2.tryBecomeLeader();

    expect(result1).toBe(true);
    expect(result2).toBe(false);
    expect(leader1.getStatus().isLeader).toBe(true);
    expect(leader2.getStatus().isLeader).toBe(false);
  });

  it('should handle leader failover', async () => {
    await leader1.tryBecomeLeader();
    expect(leader1.getStatus().isLeader).toBe(true);

    // Leader resigns
    await leader1.resignLeadership();
    
    // Wait a bit for lock to become stale
    await new Promise(resolve => setTimeout(resolve, 100));

    // Second leader should be able to claim leadership
    const result2 = await leader2.tryBecomeLeader();
    expect(result2).toBe(true);
    expect(leader2.getStatus().isLeader).toBe(true);
  });

  it('should synchronize state', async () => {
    const testState = {
      channels: { 'test-1': { status: 'online' } },
      lastUpdate: Date.now(),
      leader: 'test-leader',
      version: 1
    };

    await stateManager.writeState(testState);
    const readState = await stateManager.readState();

    expect(readState).toEqual(expect.objectContaining(testState));
  });

  it('should emit state change events', async () => {
    return new Promise<void>((resolve) => {
      stateManager.startWatching();
      
      stateManager.once('stateChanged', (state) => {
        expect(state.channels).toEqual({ 'test-1': { status: 'online' } });
        resolve();
      });

      // Write state after setting up listener
      stateManager.writeState({
        channels: { 'test-1': { status: 'online' } },
        leader: 'test-leader'
      });
    });
  });
});
```

### Integration Test

```typescript
// test/integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WindowCoordinator } from '../src/coordination/coordinator';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Window Coordination Integration', () => {
  let tempDir: string;
  let coordinators: WindowCoordinator[] = [];

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'integration-test-'));
  });

  afterEach(async () => {
    await Promise.all(coordinators.map(c => c.stop()));
    coordinators = [];
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should coordinate multiple windows', async () => {
    const coord1 = new WindowCoordinator(tempDir);
    const coord2 = new WindowCoordinator(tempDir);
    const coord3 = new WindowCoordinator(tempDir);
    coordinators = [coord1, coord2, coord3];

    // Start all coordinators
    await Promise.all(coordinators.map(c => c.start()));

    // Check that exactly one became leader
    const statuses = coordinators.map(c => c.getStatus());
    const leaderCount = statuses.filter(s => s.isLeader).length;
    
    expect(leaderCount).toBe(1);

    // Test state synchronization
    const leader = coordinators.find(c => c.getStatus().isLeader)!;
    const followers = coordinators.filter(c => !c.getStatus().isLeader);

    // Leader updates state
    const testChannels = { 'test-channel': { status: 'online', latency: 50 } };
    await leader.updateState(testChannels);

    // Followers should receive state update
    await new Promise<void>((resolve) => {
      let updateCount = 0;
      followers.forEach(follower => {
        follower.once('stateUpdate', (state) => {
          expect(state.channels).toEqual(testChannels);
          updateCount++;
          if (updateCount === followers.length) {
            resolve();
          }
        });
      });
    });
  });
});
```

## Performance Monitoring

### Metrics Collection

```typescript
// src/coordination/metrics.ts
export class CoordinationMetrics {
  private metrics = {
    leadershipChanges: 0,
    stateUpdates: 0,
    coordinationErrors: 0,
    latencyMeasurements: [] as number[]
  };

  recordLeadershipChange() {
    this.metrics.leadershipChanges++;
    console.log(`Leadership changes: ${this.metrics.leadershipChanges}`);
  }

  recordStateUpdate(latencyMs: number) {
    this.metrics.stateUpdates++;
    this.metrics.latencyMeasurements.push(latencyMs);
    
    // Keep only recent measurements
    if (this.metrics.latencyMeasurements.length > 100) {
      this.metrics.latencyMeasurements.shift();
    }
  }

  recordError(error: Error) {
    this.metrics.coordinationErrors++;
    console.error('Coordination error:', error);
  }

  getMetrics() {
    const latencies = this.metrics.latencyMeasurements;
    return {
      ...this.metrics,
      avgLatency: latencies.length > 0 
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
        : 0,
      maxLatency: latencies.length > 0 ? Math.max(...latencies) : 0
    };
  }

  export() {
    return {
      timestamp: Date.now(),
      ...this.getMetrics()
    };
  }
}
```

## Configuration

### Extension Settings

Add to your `package.json`:

```json
{
  "contributes": {
    "configuration": {
      "title": "Health Watch Coordination",
      "properties": {
        "healthWatch.coordination.strategy": {
          "type": "string",
          "enum": ["file", "namedPipe", "auto"],
          "default": "auto",
          "description": "Coordination strategy for multi-window synchronization"
        },
        "healthWatch.coordination.heartbeatInterval": {
          "type": "number",
          "default": 3000,
          "description": "Heartbeat interval in milliseconds"
        },
        "healthWatch.coordination.staleTimeout": {
          "type": "number",
          "default": 10000,
          "description": "Time after which a leader is considered stale (ms)"
        }
      }
    }
  }
}
```

### Configuration Provider

```typescript
// src/coordination/config.ts
import * as vscode from 'vscode';

export class CoordinationConfig {
  static get strategy(): 'file' | 'namedPipe' | 'auto' {
    return vscode.workspace.getConfiguration('healthWatch.coordination')
      .get('strategy', 'auto');
  }

  static get heartbeatInterval(): number {
    return vscode.workspace.getConfiguration('healthWatch.coordination')
      .get('heartbeatInterval', 3000);
  }

  static get staleTimeout(): number {
    return vscode.workspace.getConfiguration('healthWatch.coordination')
      .get('staleTimeout', 10000);
  }

  static getOptimalStrategy(): 'file' | 'namedPipe' {
    const configured = this.strategy;
    if (configured !== 'auto') {
      return configured;
    }

    // Auto-detect based on platform and performance requirements
    if (process.platform === 'win32') {
      return 'namedPipe'; // Windows handles named pipes well
    } else {
      return 'file'; // Unix: file-based is more reliable across distros
    }
  }
}
```

## Deployment Checklist

### Pre-deployment Validation

- [ ] Test with multiple VS Code windows (2-5 windows)
- [ ] Test leadership failover (close leader window)
- [ ] Test with workspace in network drive (if applicable)
- [ ] Test on all target platforms (Windows, macOS, Linux)
- [ ] Verify no memory leaks in long-running sessions
- [ ] Check file permissions on coordination files
- [ ] Test behavior with antivirus software (Windows)
- [ ] Validate state synchronization under high load

### Performance Requirements

- Leadership election: < 50ms average
- State synchronization: < 100ms average  
- Memory overhead: < 5MB per window
- File I/O: < 10 operations per second
- Stale lock detection: < 10 seconds

### Security Checklist

- [ ] Coordination files use appropriate permissions (user-only)
- [ ] No sensitive data in lock files
- [ ] Input validation on all IPC messages
- [ ] Graceful handling of corrupted state files
- [ ] No world-readable temporary files
- [ ] Audit logging for security events

This implementation guide provides production-ready code for implementing multi-window coordination in VS Code extensions. Start with the simple file-based approach and upgrade to named pipes if you need higher performance or more sophisticated coordination patterns.
