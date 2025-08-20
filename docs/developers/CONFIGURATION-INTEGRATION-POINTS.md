# 🔗 Configuration Guide Integration Points
## Mapping Code → Documentation Redirections

This document outlines all the places in the Health Watch codebase where we should provide links or references to the comprehensive Configuration User Guide.

---

## 📍 Integration Point Mapping

### 1. **Error Messages & Validation**

#### Configuration Validation Errors (`src/config.ts`)
```typescript
// Current: Generic error messages
// Enhanced: Contextual help links

class ConfigurationError extends Error {
  constructor(message: string, public helpSection?: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
  
  getHelpUrl(): string {
    const baseUrl = 'https://github.com/GSejas/health-watch/blob/main/docs/CONFIGURATION-USER-GUIDE.md';
    return this.helpSection ? `${baseUrl}#${this.helpSection}` : baseUrl;
  }
}

// Usage examples:
throw new ConfigurationError(
  'Channel "my-api" is missing required property "url"',
  'https-probes'  // Links to HTTPS probe section
);

throw new ConfigurationError(
  'Guard "vpn-connected" is not defined',
  'guards-system'  // Links to Guards section
);
```

#### JSON Schema Validation (`resources/schema/vscode-healthwatch.schema.json`)
```json
{
  "properties": {
    "channels": {
      "description": "Channel definitions. See configuration guide: https://github.com/GSejas/health-watch/blob/main/docs/CONFIGURATION-USER-GUIDE.md#probe-types-deep-dive"
    }
  }
}
```

### 2. **Command Palette Commands**

#### New Commands to Add (`package.json` contributes.commands)
```json
{
  "command": "healthWatch.openConfigurationGuide",
  "title": "Open Configuration Guide",
  "category": "Health Watch"
},
{
  "command": "healthWatch.openGlossary",
  "title": "Open Glossary & Terms",
  "category": "Health Watch"
},
{
  "command": "healthWatch.openProbeTypesHelp", 
  "title": "Help: Probe Types",
  "category": "Health Watch"
},
{
  "command": "healthWatch.openGuardsHelp",
  "title": "Help: Guards System", 
  "category": "Health Watch"
},
{
  "command": "healthWatch.createFromTemplate",
  "title": "Create Configuration from Template",
  "category": "Health Watch"
}
```

#### Command Implementations (`src/extension.ts`)
```typescript
export function activate(context: vscode.ExtensionContext) {
  // Existing commands...
  
  // Documentation commands
  context.subscriptions.push(
    vscode.commands.registerCommand('healthWatch.openConfigurationGuide', () => {
      vscode.env.openExternal(vscode.Uri.parse(
        'https://github.com/GSejas/health-watch/blob/main/docs/CONFIGURATION-USER-GUIDE.md'
      ));
    })
  );
  
  context.subscriptions.push(
    vscode.commands.registerCommand('healthWatch.openGlossary', () => {
      vscode.env.openExternal(vscode.Uri.parse(
        'https://github.com/GSejas/health-watch/blob/main/docs/GLOSSARY.md'
      ));
    })
  );
  
  context.subscriptions.push(
    vscode.commands.registerCommand('healthWatch.openProbeTypesHelp', () => {
      vscode.env.openExternal(vscode.Uri.parse(
        'https://github.com/GSejas/health-watch/blob/main/docs/CONFIGURATION-USER-GUIDE.md#probe-types-deep-dive'
      ));
    })
  );
  
  // Template creation command
  context.subscriptions.push(
    vscode.commands.registerCommand('healthWatch.createFromTemplate', async () => {
      const template = await vscode.window.showQuickPick([
        { label: 'Simple Web Service', value: 'simple' },
        { label: 'Microservices Stack', value: 'microservices' },
        { label: 'Development Environment', value: 'development' },
        { label: 'Production Monitoring', value: 'production' }
      ], {
        placeHolder: 'Choose a configuration template'
      });
      
      if (template) {
        await createConfigurationFromTemplate(template.value);
        // Show link to guide
        const action = await vscode.window.showInformationMessage(
          'Configuration template created!',
          'Open Configuration Guide'
        );
        if (action) {
          vscode.commands.executeCommand('healthWatch.openConfigurationGuide');
        }
      }
    })
  );
}
```

### 3. **Status Bar Context Menus**

#### Status Bar Item Context Menu (`src/ui/statusBar.ts`)
```typescript
private createStatusBarItem(): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  
  // Add context menu
  item.command = {
    command: 'healthWatch.showStatusBarMenu',
    title: 'Health Watch Options'
  };
  
  return item;
}

// Register context menu command
vscode.commands.registerCommand('healthWatch.showStatusBarMenu', async () => {
  const choice = await vscode.window.showQuickPick([
    { label: '$(gear) Configure Health Watch', value: 'configure' },
    { label: '$(add) Add New Channel', value: 'add' },
    { label: '$(question) Troubleshoot Issues', value: 'troubleshoot' },
    { label: '$(book) View Documentation', value: 'docs' }
  ], {
    placeHolder: 'Health Watch Actions'
  });
  
  switch (choice?.value) {
    case 'configure':
      vscode.env.openExternal(vscode.Uri.parse(
        'https://github.com/GSejas/health-watch/blob/main/docs/CONFIGURATION-USER-GUIDE.md#configuration-anatomy'
      ));
      break;
    case 'add':
      vscode.env.openExternal(vscode.Uri.parse(
        'https://github.com/GSejas/health-watch/blob/main/docs/CONFIGURATION-USER-GUIDE.md#quick-start-guide'
      ));
      break;
    case 'troubleshoot':
      vscode.env.openExternal(vscode.Uri.parse(
        'https://github.com/GSejas/health-watch/blob/main/docs/CONFIGURATION-USER-GUIDE.md#troubleshooting--validation'
      ));
      break;
    case 'docs':
      vscode.commands.executeCommand('healthWatch.openConfigurationGuide');
      break;
  }
});
```

### 4. **Tree View Actions**

#### Channel Tree View Context Menu (`src/ui/treeView.ts`)
```typescript
export class ChannelTreeProvider implements vscode.TreeDataProvider<ChannelTreeItem> {
  // Existing implementation...
  
  // Add context menu commands in package.json:
  // "view/item/context": [
  //   {
  //     "command": "healthWatch.editChannelConfig",
  //     "when": "view == healthWatchChannels && viewItem == channel"
  //   },
  //   {
  //     "command": "healthWatch.helpWithProbeType", 
  //     "when": "view == healthWatchChannels && viewItem == channel"
  //   }
  // ]
}

// Command implementations
vscode.commands.registerCommand('healthWatch.editChannelConfig', (item: ChannelTreeItem) => {
  // Open .healthwatch.json and navigate to this channel
  // Then show helpful message
  vscode.window.showInformationMessage(
    `Editing ${item.channelId}. Need help? See the configuration guide.`,
    'Open Guide'
  ).then(action => {
    if (action) {
      const probeType = item.channel.type;
      const section = `${probeType}-probes`.toLowerCase();
      vscode.env.openExternal(vscode.Uri.parse(
        `https://github.com/GSejas/health-watch/blob/main/docs/CONFIGURATION-USER-GUIDE.md#${section}`
      ));
    }
  });
});

vscode.commands.registerCommand('healthWatch.helpWithProbeType', (item: ChannelTreeItem) => {
  const probeType = item.channel.type;
  const section = `${probeType}-probes`.toLowerCase(); 
  vscode.env.openExternal(vscode.Uri.parse(
    `https://github.com/GSejas/health-watch/blob/main/docs/CONFIGURATION-USER-GUIDE.md#${section}`
  ));
});
```

### 5. **Dashboard Integration**

#### Dashboard Webview Help Links (`src/ui/dashboard.ts`)
```typescript
private getWebviewContent(): string {
  return `<!DOCTYPE html>
  <html>
  <head>
    <!-- existing head content -->
  </head>
  <body>
    <div class="dashboard-header">
      <h1>Health Watch Dashboard</h1>
      <div class="help-links">
        <a href="#" onclick="openConfigGuide()">📖 Configuration Guide</a>
        <a href="#" onclick="openProbeHelp()">🔌 Probe Types</a>
        <a href="#" onclick="openTroubleshooting()">🐛 Troubleshooting</a>
      </div>
    </div>
    
    <!-- existing dashboard content -->
    
    <script>
      function openConfigGuide() {
        vscode.postMessage({ 
          command: 'openUrl', 
          url: 'https://github.com/GSejas/health-watch/blob/main/docs/CONFIGURATION-USER-GUIDE.md'
        });
      }
      
      function openProbeHelp() {
        vscode.postMessage({ 
          command: 'openUrl', 
          url: 'https://github.com/GSejas/health-watch/blob/main/docs/CONFIGURATION-USER-GUIDE.md#probe-types-deep-dive'
        });
      }
      
      function openTroubleshooting() {
        vscode.postMessage({ 
          command: 'openUrl', 
          url: 'https://github.com/GSejas/health-watch/blob/main/docs/CONFIGURATION-USER-GUIDE.md#troubleshooting--validation'
        });
      }
    </script>
  </body>
  </html>`;
}
```

### 6. **Configuration File Creation**

#### New File Detection (`src/config.ts`)
```typescript
export class ConfigManager {
  // Existing implementation...
  
  private async handleFirstTimeSetup(): Promise<void> {
    // When no .healthwatch.json exists
    const action = await vscode.window.showInformationMessage(
      'No Health Watch configuration found. Would you like to create one?',
      'Create from Template',
      'View Configuration Guide',
      'Create Empty'
    );
    
    switch (action) {
      case 'Create from Template':
        vscode.commands.executeCommand('healthWatch.createFromTemplate');
        break;
      case 'View Configuration Guide':
        vscode.commands.executeCommand('healthWatch.openConfigurationGuide');
        break;
      case 'Create Empty':
        await this.createEmptyConfiguration();
        break;
    }
  }
  
  private async createEmptyConfiguration(): Promise<void> {
    const config = {
      channels: [
        {
          id: 'example',
          name: 'Example Service',
          type: 'https',
          url: 'https://httpbin.org/status/200',
          intervalSec: 30
        }
      ]
    };
    
    // Write to .healthwatch.json
    // Then show guide
    vscode.window.showInformationMessage(
      'Basic configuration created! Customize it to monitor your services.',
      'Open Configuration Guide'
    ).then(action => {
      if (action) {
        vscode.commands.executeCommand('healthWatch.openConfigurationGuide');
      }
    });
  }
}
```

### 7. **Hover Providers & IntelliSense**

#### JSON Schema Enhancements
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Health Watch Configuration",
  "description": "Health Watch monitoring configuration. Full documentation: https://github.com/GSejas/health-watch/blob/main/docs/CONFIGURATION-USER-GUIDE.md",
  
  "properties": {
    "channels": {
      "type": "array",
      "description": "Monitoring channel definitions. See probe types guide: https://github.com/GSejas/health-watch/blob/main/docs/CONFIGURATION-USER-GUIDE.md#probe-types-deep-dive",
      "items": {
        "allOf": [
          {
            "if": { "properties": { "type": { "const": "https" } } },
            "then": {
              "description": "HTTPS probe configuration. Documentation: https://github.com/GSejas/health-watch/blob/main/docs/CONFIGURATION-USER-GUIDE.md#httpshttp-probes"
            }
          },
          {
            "if": { "properties": { "type": { "const": "tcp" } } },
            "then": {
              "description": "TCP connectivity probe. Documentation: https://github.com/GSejas/health-watch/blob/main/docs/CONFIGURATION-USER-GUIDE.md#tcp-connectivity-probes"
            }
          }
        ]
      }
    },
    
    "guards": {
      "description": "Conditional monitoring guards. Documentation: https://github.com/GSejas/health-watch/blob/main/docs/CONFIGURATION-USER-GUIDE.md#guards-system"
    }
  }
}
```

### 8. **Extension Welcome Experience**

#### First Activation Welcome (`src/extension.ts`)
```typescript
export function activate(context: vscode.ExtensionContext) {
  // Check if this is first activation
  const isFirstActivation = !context.globalState.get('healthWatch.welcomed');
  
  if (isFirstActivation) {
    showWelcomeMessage(context);
    context.globalState.update('healthWatch.welcomed', true);
  }
  
  // Rest of activation...
}

async function showWelcomeMessage(context: vscode.ExtensionContext): Promise<void> {
  const action = await vscode.window.showInformationMessage(
    '🎉 Welcome to Health Watch! Monitor your services directly from VS Code.',
    'Quick Start Guide',
    'Create Configuration',
    'Dismiss'
  );
  
  switch (action) {
    case 'Quick Start Guide':
      vscode.env.openExternal(vscode.Uri.parse(
        'https://github.com/GSejas/health-watch/blob/main/docs/CONFIGURATION-USER-GUIDE.md#quick-start-guide'
      ));
      break;
    case 'Create Configuration':
      vscode.commands.executeCommand('healthWatch.createFromTemplate');
      break;
  }
}
```

---

## 🎯 Implementation Priority

### Phase 1: High-Impact, Low-Effort
1. **Command Palette Commands** - Add documentation commands
2. **Error Message Enhancement** - Include help URLs in validation errors  
3. **JSON Schema Updates** - Add documentation links to property descriptions
4. **Welcome Message** - First-time user guidance

### Phase 2: Medium-Impact, Medium-Effort  
1. **Status Bar Context Menu** - Right-click help options
2. **Tree View Context Actions** - Channel-specific help
3. **Configuration Templates** - Built-in template creation
4. **Dashboard Help Links** - Webview documentation integration

### Phase 3: High-Impact, High-Effort
1. **IntelliSense Enhancements** - Contextual documentation in hover
2. **Configuration Wizard** - Step-by-step setup flow
3. **Interactive Tutorial** - In-editor guided tour
4. **Video/GIF Integration** - Embedded help content

---

## 📋 Code Integration Checklist

### Files to Modify
- [ ] `src/extension.ts` - Add documentation commands and welcome flow
- [ ] `src/config.ts` - Enhance error messages with help links
- [ ] `src/ui/statusBar.ts` - Add context menu with documentation links
- [ ] `src/ui/treeView.ts` - Add channel-specific help commands
- [ ] `src/ui/dashboard.ts` - Integrate help links in webview
- [ ] `package.json` - Add new commands and context menu contributions
- [ ] `resources/schema/vscode-healthwatch.schema.json` - Add documentation URLs

### New Files to Create
- [ ] `src/templates/` - Configuration template files
- [ ] `src/help/` - Help system utilities
- [ ] `src/ui/welcome.ts` - First-time user experience

### Documentation Updates
- [ ] `README.md` - Link to configuration guide
- [ ] `CHANGELOG.md` - Document new help features
- [ ] `docs/` - Cross-reference between documentation files

---

## 🔗 URL Strategy

### Documentation Base URL
```
https://github.com/GSejas/health-watch/blob/main/docs/CONFIGURATION-USER-GUIDE.md
```

### Section Anchors
```
#quick-start-guide
#configuration-anatomy  
#probe-types-deep-dive
#httpshttp-probes
#tcp-connectivity-probes
#dns-resolution-probes
#script-probes-advanced
#guards-system
#ui--status-bar-customization
#troubleshooting--validation
#real-world-examples
```

### Context-Specific URLs
```typescript
const HELP_URLS = {
  quickStart: `${BASE_URL}#quick-start-guide`,
  probeTypes: `${BASE_URL}#probe-types-deep-dive`, 
  guards: `${BASE_URL}#guards-system`,
  troubleshooting: `${BASE_URL}#troubleshooting--validation`,
  examples: `${BASE_URL}#real-world-examples`,
  https: `${BASE_URL}#httpshttp-probes`,
  tcp: `${BASE_URL}#tcp-connectivity-probes`,
  dns: `${BASE_URL}#dns-resolution-probes`,
  script: `${BASE_URL}#script-probes-advanced`
};
```

---

This integration strategy ensures users always have contextual access to comprehensive documentation, reducing support burden and improving the user experience. The progressive disclosure approach guides users from simple error messages to comprehensive tutorials based on their needs.
