# 🎯 Epic: VS Code Tasks Integration

![Priority](https://img.shields.io/badge/Priority-HIGH-red?style=flat-square)
![Story Points](https://img.shields.io/badge/Story_Points-8_SP-green?style=flat-square)
![Type](https://img.shields.io/badge/Type-Epic-purple?style=flat-square)
![Status](https://img.shields.io/badge/Status-Ready_for_Implementation-blue?style=flat-square)

## Feature Overview

Enable Health Watch to execute VS Code tasks as monitoring probes instead of custom scripts.

## Why This Approach

- **Zero Learning Curve**: Users reference existing tasks they already understand
- **Natural Security**: Tasks run with user permissions, fully transparent in terminal
- **Immediate Value**: Leverage existing investments in tasks and workflows
- **Maintainable**: Simple, stable VS Code APIs

## User Experience

```json
// .healthwatch.json
{
  "channels": [
    {
      "id": "api-health",
      "name": "API Health Check",
      "type": "task",
      "runTask": {
        "label": "healthwatch:check-api",
        "problemMatcher": "$healthwatch-http",
        "isBackground": false
      },
      "interval": 60
    }
  ]
}
```

```json
// .vscode/tasks.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "healthwatch:check-api",
      "type": "shell",
      "command": "./scripts/check-api.sh",
      "args": ["--url", "${config:myapp.apiUrl}"],
      "group": "test",
      "problemMatcher": {
        "owner": "healthwatch",
        "pattern": {
          "regexp": "^ERROR: (.*)$",
          "message": 1
        }
      },
      "presentation": {
        "reveal": "silent",
        "panel": "shared"
      }
    }
  ]
}
```

## Implementation Requirements (2025 Best Practices)

### Core Components

1. **Task Discovery**
   - Use `vscode.tasks.fetchTasks()` with result caching on activation
   - Listen to `onDidChangeTasks` to refresh cache automatically
   - Filter by task properties (name, type, group) for efficiency

2. **Task Execution & Lifecycle**
   - Use `vscode.tasks.executeTask()` for execution
   - Monitor with all lifecycle events: `onDidStartTask`, `onDidEndTask`, `onDidStartTaskProcess`, `onDidEndTaskProcess`
   - Handle `isBackground` tasks properly for long-running processes
   - Correlate events with unique task identifiers for precise tracking

3. **Output Parsing (Modern Approach)**
   - **Primary**: Leverage problem matchers in tasks.json for automatic parsing
   - **Advanced**: Use new `taskProblemMatcherStatus` API (proposed) for fine-grained monitoring
   - **Fallback**: Exit code mapping (0 = success, non-zero = failure)
   - Integrate with VS Code Problems panel for error surfacing

4. **Configuration Schema**
   - Add `runTask` field to ChannelConfig interface
   - Support problem matcher configuration
   - Include timeout, retry, and background task options

### Success Criteria

- Users can reference any existing VS Code task
- Task execution visible in integrated terminal
- Results properly mapped to health samples
- Setup takes under 5 minutes for existing tasks

## Implementation Tickets

- **Config Schema** - Add runTask config field (1 SP)
- **Task Templates** - Create common task examples (1 SP) 
- **Execution Engine** - Core task discovery and execution (3 SP)
- **Error Handling** - Timeouts, missing tasks, failures (1 SP)
- **Testing & Docs** - Unit tests, integration tests, user guides (2 SP)

**Total: 8 Story Points**

## Risk Assessment: LOW

- Uses stable VS Code Task APIs
- No complex execution model required
- Graceful fallback to existing script probes
- Tasks run with normal user permissions

---

## 📋 **Review Checklist**
- [x] **Architecture Review**: Reviewed implementation approach and patterns
- [ ] **Security Review**: Confirmed task execution security model
- [ ] **Performance Review**: Validated caching and lifecycle management
- [ ] **Documentation Review**: All tickets and examples are clear
- [ ] **Testing Strategy**: Comprehensive test coverage planned
- [ ] **Ready for Implementation**: All requirements understood and approved