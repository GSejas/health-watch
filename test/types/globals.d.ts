declare module 'jsdom';

// Provide a minimal Uri-like shape used by tests to avoid importing VS Code types
interface TestUri {
    fsPath: string;
}

declare module NodeJS {
    interface Global {
        // vscode mock inserted by test setup
        vscode?: any;
    }
}
