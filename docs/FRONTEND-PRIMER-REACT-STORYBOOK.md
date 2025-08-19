# Frontend Primer — React, Storybook, and VS Code Webviews

Date: 2025-08-18

A co## 10. Glossary — VS Code Security & Webview Terms

### CSP (Content Security Policy)
**What it is:** A browser security standard that restricts how web content can load and execute scripts, styles, and other resources. In VS Code webviews, CSP prevents malicious code injection by blocking inline scripts and unsafe resource loading.

**Why it matters:** VS Code webviews run with strict CSP by default to protect the editor and user system from potentially harmful extension code. This means you can't use `<script>` tags without proper nonces or load external resources without proper URI conversion.

**Example CSP header:**
```
Content-Security-Policy: script-src 'nonce-abc123' 'self'; style-src 'unsafe-inline' 'self';
```

### Nonce Injection
**What it is:** A "nonce" (number used once) is a cryptographic token that allows specific script tags to execute despite CSP restrictions. VS Code generates a unique nonce for each webview session.

**How it works in VS Code:**
1. Extension host generates a random nonce: `const nonce = getNonce();`
2. Webview HTML includes scripts with the nonce: `<script nonce="${nonce}" src="..."></script>`
3. Browser allows only scripts with the matching nonce to execute

**Production bundle example:**
```typescript
// Extension side
const nonce = getNonce();
const html = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta http-equiv="Content-Security-Policy" 
            content="script-src 'nonce-${nonce}' 'self';">
    </head>
    <body>
      <div id="root"></div>
      <script nonce="${nonce}" src="${bundleUri}"></script>
    </body>
  </html>
`;
```

### webview.asWebviewUri()
**What it is:** A VS Code API method that converts local file paths into secure webview-compatible URIs. Required for loading any assets (JS, CSS, images) in webviews.

**Example:**
```typescript
// Don't do this (won't work in webview)
const iconPath = '/path/to/icon.svg';

// Do this instead
const iconUri = panel.webview.asWebviewUri(
  vscode.Uri.file(path.join(extensionPath, 'resources', 'icon.svg'))
);
```

### acquireVsCodeApi()
**What it is:** A global function available in VS Code webviews that provides communication bridge between webview content and the extension host.

**Common methods:**
```typescript
const vscode = acquireVsCodeApi();

// Send message to extension
vscode.postMessage({ command: 'refresh', data: {...} });

// Get/set persistent state
vscode.setState({ currentView: 'metrics' });
const state = vscode.getState();
```

### Resource URI Security
**Why it exists:** VS Code webviews run in a sandboxed environment where normal file:// URLs don't work. All resources must be explicitly allowed through the webview URI system.

**Pattern:**
```typescript
// Convert local paths to webview URIs
const jsUri = panel.webview.asWebviewUri(
  vscode.Uri.file(path.join(context.extensionPath, 'dist', 'bundle.js'))
);
const cssUri = panel.webview.asWebviewUri(
  vscode.Uri.file(path.join(context.extensionPath, 'styles', 'main.css'))
);
```

### Bundle Integrity
**What it means:** In production, your React/JS bundles must be built with proper nonce handling and URI conversion. Development servers (like HMR) don't work in webviews because they violate CSP.

**Production checklist:**
- ✅ Build static bundles (no dev server)
- ✅ Include nonce in all script tags
- ✅ Convert all asset paths via `asWebviewUri()`
- ✅ Test CSP compliance with `unsafe-inline` disabled

## 11. A final, slightly ironic encouragement
Frontends can feel like jazz: lots of improvisation, a few core chords. Learn the chords (components, state, props), lean on the band (ecosystem), and scaffold your solos in Storybook. You don't need to master every instrument — just keep the orchestra in tune.

The security bits (CSP, nonces) are like having a good sound engineer — essential but invisible when done right.

---
Document generated for the repository. If you want, I can now scaffold Storybook + a React prototype for `metricsView` and commit the changes. Which would you like next?, opinionated primer for backend-savvy folks moving into modern frontend work for VS Code webviews. Written with a dash of London-Professor irony and practical grit.

## TL;DR
- Think in components: small, composable, testable.  
- Use TypeScript everywhere.  
- React is the pragmatic choice for dashboard-heavy webviews: ecosystem, tooling, and incremental migration.  
- Use Storybook for component-driven development and visual testing.  

## 1. Mental model (an analogy)
Imagine a theatre. Each component is a prop on stage: self-contained, with its own script (render) and cues (props). State is the backstage drama — keep it tidy. The Virtual DOM is the stagehand that swaps props only where needed. If you used to maintain the scenery by hand (jQuery), you’ll appreciate this cleaner choreography.

## 2. Core abstractions (what you need to understand)
- Components: reusable UI pieces (think LEGO bricks).
- Props vs State: props are inputs, state is the component’s internal memory.
- Unidirectional data flow: parent → child. Actions bubble upward.
- Hooks (React): small functions for state and side effects (useState, useEffect).
- Virtual DOM: efficient diffing to update the real DOM.

If those feel abstract, treat hooks as small, testable functions you can drop into components — they’re your friend.

## 3. Tooling & workflow (practical stack)
- TypeScript: mandatory. It documents and prevents mistakes.
- Bundler: esbuild or Vite (fast builds, HMR for dev). This repo already uses esbuild — good.
- Storybook: develop UI components in isolation, add stories + snapshot tests.
- Testing: unit tests for data and pure components; snapshot tests for HTML output; smoke tests in VS Code debug host.
- CI: ensure `lint`, `typecheck`, `build`, and `test` run.

## 4. VS Code webview specifics (gotchas)
- CSP & nonce: webviews restrict inline scripts; inject script tags with a nonce from the extension host.
- Resource URIs: use `webview.asWebviewUri` for assets.
- `acquireVsCodeApi`: webviews talk to the extension through this global. Mock it for Storybook/tests.
- Bundle size matters: keep bundles small, lazy-load heavy charts.

## 5. Why React (a brief, candid defense)
- Ecosystem: lots of charting, component libraries, and patterns for dashboards. When in doubt, React has a package for it.
- TypeScript synergy: patterns like hooks + typed props are battle-tested.
- Incremental adoption: you can mount a React tree inside an existing webview, so migration is low-risk.
- Tooling: works well with Storybook, unit tests, and modern bundlers.

Alternatives exist (Vue, Svelte). Vue is elegant and also a good choice; Svelte is great for tiny bundles. But React wins on momentum and available components for dashboards.

## 6. Migration strategy (low-risk incremental)
1. Pick a single, self-contained view (e.g., `metricsView`).  
2. Convert its rendering into a React component that accepts typed props.  
3. Bundle it (esbuild/Vite) as a single JS file with a mount function.  
4. Update the original view to render a placeholder div and include the bundle (preserve nonce/CSP).  
5. Mock `acquireVsCodeApi` and theme variables in Storybook for local dev.

This keeps the extension usable while you migrate view-by-view.

## 7. Storybook — why and how
- Storybook lets you build components in isolation and iterate fast. Mock `acquireVsCodeApi` in `.storybook/preview.ts` and add a decorator for VS Code theme CSS variables.
- Dev flow: run Storybook locally, refine component, then wire the same component into the webview bundle.

Quick commands (PowerShell)
```powershell
# init Storybook (auto-detects framework)
npx sb@latest init --type react

# dev
npm run storybook

# build
npm run build-storybook
```

Install helpers (optional)
```powershell
npm install -D @storybook/react-vite @storybook/addon-essentials msw @testing-library/react
```

## 8. Practical tips and patterns
- Keep data logic out of components: `data -> view` pure pattern. Extract heavy computation into `src/ui/dashboardData.ts` (pure functions) and test them.
- Use Storybook stories as documentation and visual tests.
- Use lazy-loading for heavy charts and memoization for repeated computations.
- Respect CSP and use `nonce` injection in production bundles.

## 9. Recommended next steps (concrete)
- Scaffold Storybook and add a story for `metricsView`.  
- Create a minimal React prototype for `metricsView` that mounts in the webview.  
- Add unit tests for extracted `dashboardData` functions.

## 10. A final, slightly ironic encouragement
Frontends can feel like jazz: lots of improvisation, a few core chords. Learn the chords (components, state, props), lean on the band (ecosystem), and scaffold your solos in Storybook. You don’t need to master every instrument — just keep the orchestra in tune.

---
Document generated for the repository. If you want, I can now scaffold Storybook + a React prototype for `metricsView` and commit the changes. Which would you like next?
