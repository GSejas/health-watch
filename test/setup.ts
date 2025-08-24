/**
 * Test setup and configuration for Health Watch tests
 */

import { vi } from 'vitest';

// Mock VS Code API globally
const mockVSCode = {
    postMessage: vi.fn(),
    setState: vi.fn(),
    getState: vi.fn().mockReturnValue(null)
};

// Set NODE_ENV for tests
process.env.NODE_ENV = 'test';

// Mock window.vscode for React components (only if window exists)
if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'vscode', {
        value: mockVSCode,
        writable: true
    });
}

// Mock VS Code module for Node.js tests
vi.mock('vscode', () => ({
    Uri: {
        file: vi.fn((path: string) => ({ fsPath: path, path })),
        parse: vi.fn((uri: string) => ({ fsPath: uri, path: uri }))
    },
    workspace: {
        getConfiguration: vi.fn(() => ({
            get: vi.fn(),
            update: vi.fn(),
            has: vi.fn()
        })),
        workspaceFolders: []
    },
    window: {
        showErrorMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        showInformationMessage: vi.fn(),
        createStatusBarItem: vi.fn(() => ({
            text: '',
            tooltip: '',
            command: '',
            show: vi.fn(),
            hide: vi.fn(),
            dispose: vi.fn()
        })),
        createTreeView: vi.fn(() => ({
            reveal: vi.fn(),
            dispose: vi.fn()
        })),
        createWebviewPanel: vi.fn(() => ({
            webview: {
                html: '',
                postMessage: vi.fn(),
                onDidReceiveMessage: vi.fn()
            },
            dispose: vi.fn(),
            onDidDispose: vi.fn()
        }))
    },
    commands: {
        registerCommand: vi.fn(),
        executeCommand: vi.fn()
    },
    StatusBarAlignment: {
        Left: 1,
        Right: 2
    },
    TreeItemCollapsibleState: {
        None: 0,
        Collapsed: 1,
        Expanded: 2
    },
    ViewColumn: {
        One: 1,
        Two: 2,
        Three: 3
    },
    EventEmitter: vi.fn(() => ({
        event: vi.fn(),
        fire: vi.fn(),
        dispose: vi.fn()
    }))
}));

// Mock file system operations for tests
vi.mock('fs', async () => {
    const actual = await vi.importActual('fs');
    return {
        ...actual,
        existsSync: vi.fn(() => true),
        mkdirSync: vi.fn(),
        readFileSync: vi.fn(() => '{}'),
        writeFileSync: vi.fn(),
        rmSync: vi.fn(),
        statSync: vi.fn(() => ({
            isDirectory: () => true,
            isFile: () => true,
            mtime: new Date()
        }))
    };
});

// Mock path operations
vi.mock('path', async () => {
    const actual = await vi.importActual('path');
    return {
        ...actual,
        join: vi.fn((...args) => args.join('/')),
        resolve: vi.fn((...args) => '/' + args.join('/'))
    };
});

// Global test utilities
export const createMockChannel = (id: string, overrides: any = {}) => ({
    id,
    name: `Test Channel ${id}`,
    type: 'https',
    url: `https://example.com/${id}`,
    intervalSec: 60,
    timeoutMs: 3000,
    threshold: 3,
    ...overrides
});

export const createMockChannelState = (overrides: any = {}) => ({
    state: 'online' as const,
    consecutiveFailures: 0,
    totalChecks: 100,
    totalFailures: 5,
    lastSuccessTime: Date.now() - 30000,
    lastSample: {
        timestamp: Date.now() - 5000,
        ok: true,
        latencyMs: 150
    },
    ...overrides
});

export const createMockSample = (overrides: any = {}) => ({
    t: Date.now(),
    ok: true,
    latencyMs: 100,
    ...overrides
});

export const createMockOutage = (channelId: string, overrides: any = {}) => ({
    id: `outage-${Date.now()}`,
    channelId,
    startTime: Date.now() - 300000,
    endTime: Date.now() - 60000,
    durationMs: 240000,
    isResolved: true,
    ...overrides
});

export const createMockWatchSession = (overrides: any = {}) => ({
    id: `watch-${Date.now()}`,
    startTime: Date.now() - 3600000,
    isActive: true,
    durationSetting: '1h',
    ...overrides
});

// Console setup for tests
beforeEach(() => {
    vi.clearAllMocks();
    // Reset console spies
    console.error = vi.fn();
    console.warn = vi.fn();
    console.log = vi.fn();
});

// Setup DOM testing environment
import '@testing-library/jest-dom';