Why: to get authoritative, up-to-date guidance on adding clickable/touchable icons to VS Code Explorer tree items (TreeView). I'll ask for approaches, limitations of the native tree, examples (TreeItem.command, iconPath/ThemeIcon, context menu, view/item toolbar), and recommended workarounds (child-action items, decorator, webview) — expected outcome: concise, actionable options with code samples. I'll fetch concise, actionable guidance (from Perplexity) on making tree items show touchable/clickable icons and how to wire actions; next I'll show the patterns, examples, and recommended workarounds.

Checklist
- [x] Explain supported TreeItem properties to show icons and run commands
- [x] Show how to run an action when item (or icon-like control) is clicked
- [x] Show how to surface per-item actions from package.json (context/menu/inline)
- [x] Give practical workarounds when native inline buttons are insufficient
- [x] Note accessibility and touch considerations

Quick summary
- You can show icons with `item.iconPath` or `ThemeIcon`. Clicking the whole item can run a command via `item.command`. Per-item inline toolbar buttons are provided by VS Code only via contributed view/item actions (menus) using `contextValue` and `"group":"inline"` — supported for extension-provided TreeViews (not the built-in file explorer). If you need fully custom clickable buttons inside a row, use a WebviewView or child-action nodes as a workaround.

How to implement — compact examples

1) Run a command when the item is clicked
```ts
const item = new vscode.TreeItem('My Item', vscode.TreeItemCollapsibleState.None);
item.command = {
  command: 'myExt.openItem',
  title: 'Open Item',
  arguments: ['myItemId']
};
// register command in extension activation
context.subscriptions.push(vscode.commands.registerCommand('myExt.openItem', id => {
  // handle click
}));
```
- Behavior: clicking the item row invokes the command.

2) Add an icon (ThemeIcon or custom)
```ts
// ThemeIcon (built-in, theme-aware)
item.iconPath = new vscode.ThemeIcon('rocket');

// Custom icon per theme
item.iconPath = {
  light: vscode.Uri.file(path.join(context.extensionPath, 'resources/light/ping.svg')),
  dark: vscode.Uri.file(path.join(context.extensionPath, 'resources/dark/ping.svg'))
};
```
- If you want file-icon theming, set `resourceUri` on the item.

3) Expose per-item actions (context menu and inline toolbar) via package.json
- In the `TreeItem`, set `item.contextValue = 'editableNode'`.
- In package.json contribute a command and menu entry:
```json
"contributes": {
  "commands": [
    { "command": "myExt.edit", "title": "Edit" }
  ],
  "menus": {
    "view/item/context": [
      {
        "command": "myExt.edit",
        "when": "view == myView && viewItem == editableNode",
        "group": "inline"
      }
    ],
    "view/title": [
      { "command": "myExt.refresh", "when": "view == myView", "group": "navigation" }
    ]
  }
}
```
- `"group": "inline"` will render a small icon button next to the item label in supported TreeViews (extension-provided only). The command must be registered in your code.

4) Workaround when you need clickable icons inside the label (native support lacking)
- Child action node: append a child node that acts as a button (clicking it runs its command).
- Decorations: show icons/overlays via `FileDecorationProvider` (visual only; not clickable).
- WebviewView: implement the view with HTML/JS for full control and true inline buttons (best for rich/touch-first UI).
- Fake button via label/description: purely visual — not clickable.

Example "child action node" pattern
```ts
// parent returns children like [mainItem, actionItem]
const action = new vscode.TreeItem('Run Now', vscode.TreeItemCollapsibleState.None);
action.command = { command: 'myExt.runNow', title: 'Run Now', arguments: [id] };
action.iconPath = new vscode.ThemeIcon('play');
action.contextValue = 'actionNode';
return [action];
```

Accessibility & touch
- Commands and menu-contributed actions are keyboard and screen-reader accessible.
- Inline toolbar actions contributed via `menus` are focusable and usable by keyboard — keep titles/descriptions meaningful.
- For touch, prefer larger hit areas (or a Webview): tiny inline icons can be hard to tap on touch devices.
- Always provide a context menu or whole-row command alternative (so users who cannot precisely tap still can act).

Notes / caveats
- Inline per-item buttons via `"group": "inline"` only work in custom TreeViews contributed by your extension; the built-in File Explorer can't be extended with arbitrary inline item widgets.
- Icon theme styling: prefer `ThemeIcon` for consistent theming; custom SVGs must be provided in both light/dark variants.
- If you need per-item dynamic controls with complex interactions (confirmations, menus, tooltips), use a WebviewView.

If you want, I can:
- Add an example `TreeDataProvider` patch that sets `contextValue` and supplies an inline action via package.json and register the corresponding command — then run a local build to verify. Which path do you prefer: (A) package.json inline action + TreeItem.command, or (B) WebviewView for full custom clickable UI?