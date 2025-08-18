import { defineConfig } from "@vscode/test-cli";

export default defineConfig([
    {
        label: "unitTests",
        files: "out/test/unit/**/*.test.js",
        version: "stable",
        workspaceFolder: "./test-workspace",
        mocha: {
            ui: "bdd",
            timeout: 10000
        }
    },
    {
        label: "e2eTests", 
        files: "out/test/e2e/**/*.test.js",
        version: "stable",
        workspaceFolder: "./test-workspace",
        mocha: {
            ui: "bdd",
            timeout: 30000
        }
    }
]);
