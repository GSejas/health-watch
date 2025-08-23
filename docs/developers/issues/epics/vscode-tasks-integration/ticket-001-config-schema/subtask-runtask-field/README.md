# 🔸 Subtask: RunTask Field Implementation

![Story Points](https://img.shields.io/badge/Story_Points-1_SP-green?style=flat-square)
![Type](https://img.shields.io/badge/Type-Implementation-orange?style=flat-square)
![Priority](https://img.shields.io/badge/Priority-HIGH-red?style=flat-square)

## 🎯 Subtask Objective

**Implement the TypeScript schema, validation logic, and JSON Schema export for the new `runTask` configuration field that enables task-based channel monitoring.**

## 🔧 Technical Implementation

### Schema Definition
```typescript
// src/types.ts - Add to ChannelConfig interface
interface RunTaskConfig {
  /** Enable task-based monitoring for this channel */
  enabled: boolean;
  
  /** VS Code task label to execute */
  label: string;
  
  /** Consent mode for task execution */
  consent: 'explicit' | 'auto';
  
  /** Override default task timeout (milliseconds) */
  maxDuration?: number;
  
  /** Retry policy for failed task executions */
  retryPolicy?: {
    maxAttempts: number;
    backoffMs: number;
  };
  
  /** Additional arguments to pass to task */
  args?: Record<string, string>;
  
  /** Environment variables for task execution */
  env?: Record<string, string>;
}

interface ChannelConfig {
  // ... existing fields
  
  /** Task-based probe configuration */
  runTask?: RunTaskConfig;
}
```

### Validation Implementation
```typescript
// src/config/validation.ts
import { z } from 'zod';

const RunTaskConfigSchema = z.object({
  enabled: z.boolean(),
  label: z.string().min(1, 'Task label cannot be empty'),
  consent: z.enum(['explicit', 'auto']),
  maxDuration: z.number().min(1000).max(300000).optional(), // 1s to 5min
  retryPolicy: z.object({
    maxAttempts: z.number().min(1).max(10),
    backoffMs: z.number().min(100).max(30000)
  }).optional(),
  args: z.record(z.string()).optional(),
  env: z.record(z.string()).optional()
});

export const ChannelConfigSchema = z.object({
  // ... existing validation
  runTask: RunTaskConfigSchema.optional()
});
```

## 📊 Configuration Patterns

### Basic Task Reference
```json
{
  "id": "api-health",
  "name": "API Health Check",
  "type": "task",
  "runTask": {
    "enabled": true,
    "label": "healthwatch:check-api",
    "consent": "explicit"
  },
  "interval": 60
}
```

### Advanced Task Configuration
```json
{
  "id": "database-check",
  "name": "Database Connection Test",
  "type": "task", 
  "runTask": {
    "enabled": true,
    "label": "healthwatch:check-database",
    "consent": "explicit",
    "maxDuration": 30000,
    "retryPolicy": {
      "maxAttempts": 3,
      "backoffMs": 5000
    },
    "env": {
      "DB_TIMEOUT": "10000",
      "LOG_LEVEL": "info"
    }
  },
  "interval": 300
}
```

## 🎨 JSON Schema Export

### Schema Generation
```typescript
// src/config/schema-export.ts
import { zodToJsonSchema } from 'zod-to-json-schema';

export function generateConfigSchema() {
  const jsonSchema = zodToJsonSchema(ChannelConfigSchema, {
    name: 'HealthWatchChannelConfig',
    description: 'Health Watch channel configuration schema'
  });
  
  // Enhance with VS Code-specific properties
  return {
    ...jsonSchema,
    '$schema': 'http://json-schema.org/draft-07/schema#',
    'x-vscode': {
      'suggestions': {
        'runTask.label': {
          'source': 'tasks',
          'description': 'Reference to VS Code task label'
        }
      }
    }
  };
}
```

### IDE Integration
```json
// .vscode/settings.json - Enable schema validation
{
  "json.schemas": [
    {
      "fileMatch": [".healthwatch.json", "healthwatch.config.json"],
      "url": "./node_modules/health-watch/schema/config.schema.json"
    }
  ]
}
```

## ✅ Validation Rules

### Required Field Validation
- [ ] **`enabled`** must be boolean
- [ ] **`label`** must be non-empty string
- [ ] **`consent`** must be 'explicit' or 'auto'

### Optional Field Validation  
- [ ] **`maxDuration`** between 1s and 5 minutes if specified
- [ ] **`retryPolicy.maxAttempts`** between 1 and 10 if specified
- [ ] **`retryPolicy.backoffMs`** between 100ms and 30s if specified
- [ ] **`args`** must be string key-value pairs if specified
- [ ] **`env`** must be string key-value pairs if specified

### Business Logic Validation
- [ ] **Task existence** - referenced task label exists in workspace
- [ ] **Consent requirement** - 'auto' consent only for low-risk tasks
- [ ] **Timeout bounds** - maxDuration reasonable for task type
- [ ] **Retry limits** - retryPolicy prevents infinite loops

## 🧪 Test Coverage

### Unit Tests
```typescript
describe('RunTaskConfig Validation', () => {
  it('accepts valid minimal configuration', () => {
    const config = {
      enabled: true,
      label: 'test-task',
      consent: 'explicit'
    };
    expect(() => RunTaskConfigSchema.parse(config)).not.toThrow();
  });

  it('rejects empty task label', () => {
    const config = {
      enabled: true,
      label: '',
      consent: 'explicit'
    };
    expect(() => RunTaskConfigSchema.parse(config)).toThrow();
  });

  it('validates retry policy bounds', () => {
    const config = {
      enabled: true,
      label: 'test-task',
      consent: 'explicit',
      retryPolicy: {
        maxAttempts: 15, // Invalid: > 10
        backoffMs: 1000
      }
    };
    expect(() => RunTaskConfigSchema.parse(config)).toThrow();
  });
});
```

### Integration Tests
```typescript
describe('Channel Config with RunTask', () => {
  it('integrates runTask into full channel config', () => {
    const channelConfig = {
      id: 'test-channel',
      name: 'Test Channel',
      type: 'task',
      runTask: {
        enabled: true,
        label: 'healthwatch:test',
        consent: 'explicit'
      },
      interval: 60
    };
    
    expect(() => ChannelConfigSchema.parse(channelConfig)).not.toThrow();
  });
});
```

## 📋 Deliverables

### Code Artifacts
- [ ] **TypeScript interfaces** in `src/types.ts`
- [ ] **Zod validation schemas** in `src/config/validation.ts`
- [ ] **JSON Schema export** in `src/config/schema-export.ts`
- [ ] **Unit tests** for all validation rules
- [ ] **Integration tests** for full config parsing

### Documentation
- [ ] **Schema documentation** with examples
- [ ] **Validation error reference** for troubleshooting
- [ ] **Migration guide** from script-based configs
- [ ] **IDE setup instructions** for schema validation

### Build Integration
- [ ] **Schema generation** in build process
- [ ] **Type checking** in CI pipeline  
- [ ] **Test coverage** reporting for validation logic
- [ ] **Schema validation** in package.json scripts

---

*This subtask creates the foundational type safety and validation that makes task-based monitoring both robust and developer-friendly. Strong typing here prevents runtime errors and enables excellent IDE support.*

⚡ **Type Safety First** | 🎯 **Developer Experience** | 🔧 **Validation Excellence**
