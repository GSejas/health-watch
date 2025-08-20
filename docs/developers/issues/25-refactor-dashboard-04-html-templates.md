# 25-refactor-dashboard-04-html-templates

- Owner: TBA
- Status: Todo
- Effort: M
- Labels: refactor, dashboard, html

## Short description
Move large inline HTML/CSS/JS fragments into template files or template helper functions. Consider small template strings in the view modules or external `.html` partials loaded at build time.

## Acceptance criteria
- [ ] Major HTML fragments are extracted and parametrized.
- [ ] Styling and scripts are consolidated into `getBaseCSS` / `getBaseScripts` or separate assets.
- [ ] Build step (if needed) includes templates in the extension package.

## Risks/Notes
- Webview CSP/nonce handling must be preserved.
- Externalizing HTML may alter minification or bundling; keep assets under `src/ui/templates/`.

## Test plan
- Compare rendered dashboard before/after (visual diff) for a sample workspace.
