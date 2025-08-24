# 🎫 Ticket 001: Config Schema

![Priority](https://img.shields.io/badge/Priority-HIGH-red?style=flat-square)
![Story Points](https://img.shields.io/badge/Story_Points-1_SP-green?style=flat-square)
![Type](https://img.shields.io/badge/Type-Core_Feature-brightgreen?style=flat-square)
![Status](https://img.shields.io/badge/Status-Ready_for_Implementation-blue?style=flat-square)

## 📋 Ticket Summary

**Add `runTask` field to channel configuration schema for task-based monitoring with modern 2025 patterns including problem matchers and lifecycle management.**

## Summary
Add `runTask` field to channel configuration schema for task-based monitoring.

## Requirements

### TypeScript Schema (2025 Standards)
```typescript
interface ChannelConfig {
  // existing fields...
  runTask?: {
    label: string;              // Task label to execute
    problemMatcher?: string;    // Problem matcher name for output parsing
    isBackground?: boolean;     // Handle long-running background tasks
    timeout?: number;          // Max execution time (ms)
    retryAttempts?: number;    // Retry failed tasks
    telemetryEvents?: boolean; // Log execution events
  };
}
```

### Configuration Example
```json
{
  "channels": [
    {
      "id": "api-check",
      "type": "task", 
      "runTask": {
        "label": "healthwatch:check-api",
        "problemMatcher": "$healthwatch-http",
        "isBackground": false,
        "timeout": 30000,
        "retryAttempts": 2,
        "telemetryEvents": true
      }
    }
  ]
}
```

## Implementation Tasks
- [ ] Add TypeScript interfaces
- [ ] Update JSON schema for IDE support
- [ ] Add validation for task references
- [ ] Update configuration documentation

**Story Points: 1**

---

## 📋 **Review Checklist**
- [ ] **Schema Design**: TypeScript interfaces are well-structured and extensible
- [ ] **JSON Schema**: IDE autocompletion support is properly configured
- [ ] **Validation**: Runtime validation handles all edge cases
- [ ] **Documentation**: Configuration examples are clear and comprehensive
- [ ] **Ready for Implementation**: Schema requirements are fully defined