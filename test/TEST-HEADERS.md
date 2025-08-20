# Test File Headers

## Standard Headers by Type

### React Component Tests
```typescript
/**
 * @fileoverview [ComponentName] component tests
 * @module test/unit/react
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ComponentName } from '../../../src/ui/react/path/ComponentName';

// Mock window.vscode
const mockVSCode = { postMessage: vi.fn() };
Object.defineProperty(window, 'vscode', { value: mockVSCode, writable: true });

describe('ComponentName', () => {
  beforeEach(() => vi.clearAllMocks());
  
  // tests here
});
```

### Core Business Logic Tests
```typescript
/**
 * @fileoverview [ModuleName] core logic tests
 * @module test/unit/core
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModuleName } from '../../../src/module';

describe('ModuleName', () => {
  beforeEach(() => vi.clearAllMocks());
  
  // tests here
});
```

### Storage Tests
```typescript
/**
 * @fileoverview [StorageType] storage backend tests
 * @module test/unit/storage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StorageClass } from '../../../src/storage/StorageClass';

describe('StorageClass', () => {
  let storage: StorageClass;
  
  beforeEach(() => {
    vi.clearAllMocks();
    // setup
  });
  
  afterEach(() => {
    // cleanup
  });
  
  // tests here
});
```

### Probe Tests
```typescript
/**
 * @fileoverview [ProbeType] probe tests
 * @module test/unit/probes
 */

import { describe, it, expect, vi } from 'vitest';
import { ProbeClass } from '../../../src/probes/ProbeClass';

// Mock network modules
vi.mock('http');
vi.mock('https');
vi.mock('net');
vi.mock('dns');

describe('ProbeClass', () => {
  beforeEach(() => vi.clearAllMocks());
  
  // tests here
});
```

### VS Code UI Tests
```typescript
/**
 * @fileoverview [UIComponent] VS Code integration tests
 * @module test/unit/ui
 */

import { describe, it, expect, vi } from 'vitest';
import { UIClass } from '../../../src/ui/UIClass';

describe('UIClass', () => {
  beforeEach(() => vi.clearAllMocks());
  
  // tests here
});
```

### Integration Tests
```typescript
/**
 * @fileoverview [Feature] integration tests
 * @module test/integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('[Feature] Integration', () => {
  let tempDir: string;
  
  beforeEach(() => {
    tempDir = path.join(__dirname, 'temp-' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });
  });
  
  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
  
  // tests here
});
```