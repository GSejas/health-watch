// Comprehensive vscode mock for unit tests run in Node
// Provides all VS Code APIs used throughout the codebase

const EventEmitter = require('events');

module.exports = {
  // Workspace API
  workspace: {
    workspaceFolders: [{ 
      uri: { 
        fsPath: '/test/workspace',
        scheme: 'file',
        path: '/test/workspace'
      } 
    }],
    onDidChangeConfiguration: () => ({ dispose: () => {} }),
    getConfiguration: (section) => ({
      get: (key, defaultValue) => defaultValue,
      update: () => Promise.resolve(),
      has: () => false
    }),
    openTextDocument: () => Promise.resolve({ getText: () => '{}' }),
    fs: {
      writeFile: () => Promise.resolve(),
      readFile: () => Promise.resolve(Buffer.from('{}'))
    }
  },

  // Window API
  window: {
    showInformationMessage: () => Promise.resolve(),
    showErrorMessage: () => Promise.resolve(),
    showWarningMessage: () => Promise.resolve(),
    showQuickPick: () => Promise.resolve(),
    showInputBox: () => Promise.resolve(),
    createOutputChannel: () => ({
      appendLine: () => {},
      show: () => {},
      hide: () => {},
      dispose: () => {}
    }),
    createStatusBarItem: () => ({
      text: '',
      tooltip: '',
      command: '',
      show: () => {},
      hide: () => {},
      dispose: () => {}
    }),
    createWebviewPanel: () => ({
      webview: {
        html: '',
        onDidReceiveMessage: () => ({ dispose: () => {} })
      },
      dispose: () => {}
    }),
    createTreeView: () => ({
      refresh: () => {},
      dispose: () => {}
    }),
    showTextDocument: () => Promise.resolve()
  },

  // Commands API
  commands: {
    registerCommand: () => ({ dispose: () => {} }),
    executeCommand: () => Promise.resolve()
  },

  // Events
  EventEmitter: class extends EventEmitter {},

  // Tree Data Provider
  TreeDataProvider: class {
    onDidChangeTreeData = new EventEmitter().event;
    getTreeItem() { return {}; }
    getChildren() { return []; }
  },

  // URI utilities
  Uri: {
    file: (path) => ({ 
      fsPath: path,
      scheme: 'file',
      path: path
    }),
    joinPath: (base, ...paths) => ({
      fsPath: require('path').join(base.fsPath, ...paths),
      scheme: 'file'
    })
  },

  // Tree Item
  TreeItem: class TreeItem {
    constructor(label, collapsibleState) {
      this.label = label;
      this.collapsibleState = collapsibleState;
    }
  },

  // Theme Icons
  ThemeIcon: class ThemeIcon {
    constructor(id, color) {
      this.id = id;
      this.color = color;
    }
  },

  ThemeColor: class ThemeColor {
    constructor(id) {
      this.id = id;
    }
  },

  // Enums
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

  // Extension context mock
  ExtensionContext: class {
    constructor() {
      this.subscriptions = [];
      this.globalState = new Map();
      this.workspaceState = new Map();
      this.extensionPath = '/test/extension';
      this.globalStoragePath = '/test/global';
      this.workspaceStoragePath = '/test/workspace';
    }
  },

  // Disposable
  Disposable: class {
    constructor(callOnDispose) {
      this.callOnDispose = callOnDispose;
    }
    dispose() {
      if (this.callOnDispose) {
        this.callOnDispose();
      }
    }
  }
};
