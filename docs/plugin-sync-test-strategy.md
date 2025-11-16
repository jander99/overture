# Plugin Sync Testing Strategy

**Version**: 1.0
**Created**: 2025-01-15
**Target Feature**: v0.3.0 Plugin Sync
**Related**: [PLUGIN-SYNC-IMPLEMENTATION.md](./PLUGIN-SYNC-IMPLEMENTATION.md)

---

## Table of Contents

1. [Overview](#overview)
2. [Testing Philosophy](#testing-philosophy)
3. [Test Organization](#test-organization)
4. [Mock Strategies](#mock-strategies)
5. [Test Fixtures](#test-fixtures)
6. [Coverage Goals](#coverage-goals)
7. [TDD Workflow](#tdd-workflow)
8. [Test Scenarios](#test-scenarios)
9. [Performance Testing](#performance-testing)
10. [CI/CD Integration](#cicd-integration)

---

## Overview

This document outlines the comprehensive testing strategy for Overture's plugin sync feature. The strategy is designed to:

- **Support TDD Workflow**: Enable test-first development with clear mock patterns
- **Ensure High Coverage**: Target >90% coverage for core services
- **Validate Integration**: Test full sync workflows end-to-end
- **Handle Edge Cases**: Cover error scenarios and recovery paths
- **Maintain Velocity**: Fast test execution (<2s for unit tests)
- **Enable Debugging**: Clear test names and failure messages

---

## Testing Philosophy

### Test-Driven Development (TDD)

All plugin sync components will be developed using **strict TDD**:

1. **Write Failing Test First** - Define expected behavior with a failing test
2. **Verify Test Failure** - Ensure test fails for the right reason
3. **Implement Minimal Code** - Write just enough code to pass the test
4. **Confirm Test Passes** - Validate implementation correctness
5. **Refactor with Confidence** - Improve code while tests protect against regressions

### Test Pyramid

```
       ╱╲
      ╱E2E╲         E2E Tests (CLI integration)
     ╱────╲         - 5-10 critical workflows
    ╱Integration╲    Integration Tests (service composition)
   ╱────────────╲   - 20-30 scenarios
  ╱  Unit Tests  ╲  Unit Tests (individual components)
 ╱────────────────╲ - 100+ test cases
```

**Distribution**:
- **Unit Tests**: 70% of tests (fast, isolated, comprehensive)
- **Integration Tests**: 25% of tests (service collaboration)
- **E2E Tests**: 5% of tests (critical user workflows)

### Testing Principles

1. **Fast Feedback**: Unit tests run in <2s, full suite in <10s
2. **Isolation**: Mock external dependencies (file system, child_process, inquirer)
3. **Clarity**: Test names describe behavior, not implementation
4. **Maintainability**: Shared test utilities reduce duplication
5. **Confidence**: High coverage of critical paths and error handling

---

## Test Organization

### Directory Structure

```
apps/cli/src/
├── core/
│   ├── __fixtures__/
│   │   └── plugin-sync/
│   │       ├── claude-settings/           # .claude/settings.json examples
│   │       │   ├── valid-settings.json
│   │       │   ├── empty-settings.json
│   │       │   ├── malformed-settings.json
│   │       │   ├── disabled-plugins.json
│   │       │   └── mixed-marketplaces.json
│   │       ├── configs/                   # Overture config examples
│   │       │   ├── user-with-plugins.yaml
│   │       │   ├── project-with-plugins.yaml
│   │       │   ├── empty-plugins.yaml
│   │       │   └── invalid-marketplace.yaml
│   │       └── command-outputs/           # CLI command output examples
│   │           ├── install-success.txt
│   │           ├── install-failure.txt
│   │           └── marketplace-add.txt
│   ├── plugin-detector.ts
│   ├── plugin-detector.spec.ts
│   ├── plugin-installer.ts
│   ├── plugin-installer.spec.ts
│   ├── plugin-exporter.ts
│   ├── plugin-exporter.spec.ts
│   └── sync-engine.spec.ts               # Integration tests
├── domain/
│   ├── marketplace-registry.ts
│   └── marketplace-registry.spec.ts
└── __tests__/
    └── plugin-sync.integration.spec.ts   # Full workflow integration tests
```

### Test File Naming

- **Unit Tests**: `<component>.spec.ts` (co-located with source)
- **Integration Tests**: `<feature>.integration.spec.ts`
- **E2E Tests**: `<workflow>.e2e.spec.ts` (in `apps/cli-e2e/`)

---

## Mock Strategies

### 1. File System Operations (fs/promises)

**Strategy**: Mock `fs/promises` to control file reads/writes without touching disk.

#### Mock Setup

```typescript
import * as fs from 'fs/promises';

jest.mock('fs/promises');

const mockFs = fs as jest.Mocked<typeof fs>;
```

#### Common Patterns

**Reading Files:**
```typescript
describe('PluginDetector', () => {
  beforeEach(() => {
    mockFs.readFile.mockResolvedValue(
      JSON.stringify({
        plugins: {
          'python-development': {
            marketplace: 'claude-code-workflows',
            enabled: true
          }
        }
      })
    );
  });

  it('should parse .claude/settings.json', async () => {
    const detector = new PluginDetector();
    const plugins = await detector.detectInstalledPlugins();

    expect(plugins).toHaveLength(1);
    expect(plugins[0].name).toBe('python-development');
  });
});
```

**File Not Found:**
```typescript
mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
```

**Permission Denied:**
```typescript
mockFs.readFile.mockRejectedValue({ code: 'EACCES' });
```

**Writing Files:**
```typescript
mockFs.writeFile.mockResolvedValue(undefined);

// Verify write was called with correct content
expect(mockFs.writeFile).toHaveBeenCalledWith(
  '/path/to/config.yaml',
  expect.stringContaining('python-development')
);
```

#### Test Fixtures Integration

```typescript
import { loadFixture } from '../__fixtures__/fixture-loader';

describe('PluginDetector with fixtures', () => {
  it('should handle valid settings', async () => {
    const fixture = await loadFixture('plugin-sync/claude-settings/valid-settings.json');
    mockFs.readFile.mockResolvedValue(fixture);

    const detector = new PluginDetector();
    const plugins = await detector.detectInstalledPlugins();

    expect(plugins.length).toBeGreaterThan(0);
  });
});
```

---

### 2. Child Process Execution (ProcessExecutor)

**Strategy**: Mock `ProcessExecutor` to simulate CLI command execution without spawning processes.

#### Mock Setup

```typescript
import { ProcessExecutor } from '../../infrastructure/process-executor';

jest.mock('../../infrastructure/process-executor');

const mockProcessExecutor = ProcessExecutor as jest.MockedClass<typeof ProcessExecutor>;
```

#### Common Patterns

**Successful Command:**
```typescript
mockProcessExecutor.exec.mockResolvedValue({
  stdout: 'Plugin installed successfully\n',
  stderr: '',
  exitCode: 0
});
```

**Command Failure:**
```typescript
mockProcessExecutor.exec.mockRejectedValue(
  new Error('Command execution failed: Plugin not found')
);
```

**Command-Specific Responses:**
```typescript
mockProcessExecutor.exec.mockImplementation(async (command, args) => {
  if (command === 'claude' && args[0] === 'plugin') {
    if (args[1] === 'install') {
      return {
        stdout: `Installing ${args[2]}...\nDone!\n`,
        stderr: '',
        exitCode: 0
      };
    }
    if (args[1] === 'marketplace' && args[2] === 'add') {
      return {
        stdout: `Marketplace ${args[3]} added\n`,
        stderr: '',
        exitCode: 0
      };
    }
  }
  throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
});
```

**Testing Command Construction:**
```typescript
it('should execute correct install command', async () => {
  const installer = new PluginInstaller();
  await installer.installPlugin('python-development', 'claude-code-workflows');

  expect(mockProcessExecutor.exec).toHaveBeenCalledWith(
    'claude',
    ['plugin', 'install', 'python-development@claude-code-workflows']
  );
});
```

**Binary Detection:**
```typescript
mockProcessExecutor.commandExists.mockResolvedValue(true); // Claude binary exists
mockProcessExecutor.commandExists.mockResolvedValue(false); // Claude binary not found
```

---

### 3. Interactive Prompts (inquirer)

**Strategy**: Mock `inquirer` to simulate user input without interactive prompts.

#### Mock Setup

```typescript
import inquirer from 'inquirer';

jest.mock('inquirer');

const mockInquirer = inquirer as jest.Mocked<typeof inquirer>;
```

#### Common Patterns

**Single Selection:**
```typescript
mockInquirer.prompt.mockResolvedValue({
  selectedPlugins: ['python-development', 'backend-development']
});
```

**User Confirmation:**
```typescript
mockInquirer.prompt.mockResolvedValue({
  confirm: true
});
```

**Dynamic Prompts:**
```typescript
mockInquirer.prompt.mockImplementation(async (questions: any) => {
  if (questions[0].name === 'selectedPlugins') {
    return { selectedPlugins: ['python-development'] };
  }
  if (questions[0].name === 'confirm') {
    return { confirm: true };
  }
  return {};
});
```

**Testing Prompt Content:**
```typescript
it('should show all installed plugins in selection', async () => {
  const detector = { detectInstalledPlugins: jest.fn() };
  detector.detectInstalledPlugins.mockResolvedValue([
    { name: 'plugin-a', marketplace: 'marketplace-a', enabled: true },
    { name: 'plugin-b', marketplace: 'marketplace-b', enabled: true }
  ]);

  const exporter = new PluginExporter(detector);
  await exporter.exportPlugins({ interactive: true });

  const promptCall = mockInquirer.prompt.mock.calls[0][0];
  expect(promptCall[0].choices).toHaveLength(2);
  expect(promptCall[0].choices[0]).toMatchObject({
    name: expect.stringContaining('plugin-a'),
    value: 'plugin-a'
  });
});
```

---

### 4. Configuration Loading

**Strategy**: Mock `config-loader` module to provide test configurations.

#### Mock Setup

```typescript
import * as configLoader from './config-loader';

jest.mock('./config-loader');

const mockConfigLoader = configLoader as jest.Mocked<typeof configLoader>;
```

#### Common Patterns

**User Config with Plugins:**
```typescript
mockConfigLoader.loadUserConfig.mockResolvedValue({
  version: '2.0',
  plugins: {
    'python-development': {
      marketplace: 'claude-code-workflows',
      enabled: true,
      mcps: ['python-repl', 'ruff']
    }
  },
  mcp: {}
});
```

**Project Config Warning Test:**
```typescript
mockConfigLoader.loadProjectConfig.mockResolvedValue({
  version: '2.0',
  project: { name: 'my-api', type: 'python-backend' },
  plugins: {
    'python-development': {
      marketplace: 'claude-code-workflows',
      enabled: true
    }
  },
  mcp: {}
});

// Test should warn about plugins in project config
```

**No Plugins Configured:**
```typescript
mockConfigLoader.loadUserConfig.mockResolvedValue({
  version: '2.0',
  mcp: { github: { command: 'gh', args: [], transport: 'stdio' } }
});
```

---

### 5. Test Utilities

Create shared utilities to reduce test boilerplate.

#### Fixture Loader

```typescript
// apps/cli/src/__fixtures__/fixture-loader.ts

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Load a test fixture file
 */
export async function loadFixture(relativePath: string): Promise<string> {
  const fixturePath = path.join(__dirname, relativePath);
  return await fs.readFile(fixturePath, 'utf-8');
}

/**
 * Load and parse JSON fixture
 */
export async function loadJsonFixture<T>(relativePath: string): Promise<T> {
  const content = await loadFixture(relativePath);
  return JSON.parse(content);
}

/**
 * Load YAML fixture (requires js-yaml)
 */
export async function loadYamlFixture<T>(relativePath: string): Promise<T> {
  const yaml = await import('js-yaml');
  const content = await loadFixture(relativePath);
  return yaml.load(content) as T;
}
```

#### Mock Builders

```typescript
// apps/cli/src/core/__tests__/mock-builders.ts

import type { InstalledPlugin } from '../plugin-detector';
import type { OvertureConfig } from '../../domain/config.types';

/**
 * Build mock installed plugin
 */
export function buildInstalledPlugin(
  overrides?: Partial<InstalledPlugin>
): InstalledPlugin {
  return {
    name: 'test-plugin',
    marketplace: 'test-marketplace',
    enabled: true,
    installedAt: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Build mock config with plugins
 */
export function buildConfigWithPlugins(
  plugins: Record<string, any> = {}
): OvertureConfig {
  return {
    version: '2.0',
    plugins,
    mcp: {}
  };
}

/**
 * Build process execution result
 */
export function buildExecResult(
  stdout: string = '',
  stderr: string = '',
  exitCode: number = 0
) {
  return { stdout, stderr, exitCode };
}
```

---

## Test Fixtures

### Directory: `apps/cli/src/core/__fixtures__/plugin-sync/`

#### 1. Claude Settings Files (`claude-settings/`)

**valid-settings.json**
```json
{
  "plugins": {
    "python-development": {
      "marketplace": "claude-code-workflows",
      "enabled": true,
      "installedAt": "2025-01-15T10:00:00Z"
    },
    "backend-development": {
      "marketplace": "claude-code-workflows",
      "enabled": false,
      "installedAt": "2025-01-14T15:30:00Z"
    },
    "custom-plugin": {
      "marketplace": "myorg/custom-marketplace",
      "enabled": true,
      "installedAt": "2025-01-13T08:45:00Z"
    }
  },
  "marketplaces": [
    "anthropics/claude-code-workflows",
    "myorg/custom-marketplace"
  ]
}
```

**empty-settings.json**
```json
{
  "plugins": {},
  "marketplaces": []
}
```

**malformed-settings.json**
```json
{
  "plugins": {
    "invalid-plugin": "this-should-be-an-object",
    "another-bad-plugin": null
  }
}
```

**disabled-plugins.json**
```json
{
  "plugins": {
    "python-development": {
      "marketplace": "claude-code-workflows",
      "enabled": false,
      "installedAt": "2025-01-15T10:00:00Z"
    },
    "backend-development": {
      "marketplace": "claude-code-workflows",
      "enabled": false,
      "installedAt": "2025-01-14T15:30:00Z"
    }
  }
}
```

**mixed-marketplaces.json**
```json
{
  "plugins": {
    "known-plugin": {
      "marketplace": "claude-code-workflows",
      "enabled": true
    },
    "custom-plugin": {
      "marketplace": "custom-org/custom-marketplace",
      "enabled": true
    },
    "local-plugin": {
      "marketplace": "./local-dev-marketplace",
      "enabled": true
    }
  }
}
```

#### 2. Overture Configs (`configs/`)

**user-with-plugins.yaml**
```yaml
version: "2.0"

# User global plugins
plugins:
  python-development:
    marketplace: claude-code-workflows
    enabled: true
    mcps: [python-repl, ruff, filesystem]

  backend-development:
    marketplace: claude-code-workflows
    enabled: true
    mcps: [docker, postgres]

  kubernetes-operations:
    marketplace: claude-code-workflows
    enabled: false
    mcps: [kubectl]

# User MCP servers
mcp:
  github:
    command: mcp-server-github
    args: []
    transport: stdio
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
```

**project-with-plugins.yaml**
```yaml
version: "2.0"

project:
  name: my-api
  type: python-backend

# ⚠️ This should trigger a warning - plugins in project config
plugins:
  python-development:
    marketplace: claude-code-workflows
    enabled: true

mcp:
  python-repl:
    command: uvx
    args: [mcp-server-python-repl]
    transport: stdio
```

**empty-plugins.yaml**
```yaml
version: "2.0"

plugins: {}

mcp:
  filesystem:
    command: mcp-server-filesystem
    args: []
    transport: stdio
```

**invalid-marketplace.yaml**
```yaml
version: "2.0"

plugins:
  test-plugin:
    marketplace: 123  # Invalid: should be string
    enabled: true
```

#### 3. Command Outputs (`command-outputs/`)

**install-success.txt**
```
Installing python-development@claude-code-workflows...
✓ Downloading plugin...
✓ Extracting files...
✓ Installing dependencies...
✓ Plugin installed successfully

Plugin: python-development
Version: 1.2.0
Marketplace: claude-code-workflows
```

**install-failure.txt**
```
Installing bad-plugin@unknown-marketplace...
✗ Error: Marketplace 'unknown-marketplace' not found

Please add the marketplace first:
  claude plugin marketplace add <org/repo>
```

**marketplace-add.txt**
```
Adding marketplace: anthropics/claude-code-workflows
✓ Marketplace added successfully
```

---

## Coverage Goals

### Overall Project Target

- **Current Coverage**: 83%+ (911 tests passing)
- **Goal**: Maintain or exceed 83% after plugin sync implementation
- **Plugin Sync Modules**: >90% coverage

### Component-Specific Targets

| Component | Target Coverage | Rationale |
|-----------|----------------|-----------|
| **MarketplaceRegistry** | 100% | Pure functions, no external dependencies |
| **PluginDetector** | 95%+ | Critical path, handles malformed data |
| **PluginInstaller** | 90%+ | External process execution, some paths hard to test |
| **PluginExporter** | 90%+ | Interactive prompts, config manipulation |
| **SyncEngine (plugin sync)** | 90%+ | Integration logic, orchestration |
| **CLI Commands** | 85%+ | User-facing, interactive flows |

### Coverage Categories

1. **Statement Coverage**: >90% (every line executed)
2. **Branch Coverage**: >85% (if/else paths covered)
3. **Function Coverage**: >95% (all functions tested)
4. **Line Coverage**: >90% (consistent with statements)

### Hard-to-Test Scenarios (Acceptable <100%)

Some scenarios are difficult to test and provide diminishing returns:

- **Binary not in PATH**: Mocked via ProcessExecutor
- **Actual plugin installation**: Would require real Claude CLI
- **Interactive terminal edge cases**: Complex TTY mocking
- **Concurrent process conflicts**: Race conditions

**Strategy**: Mock these scenarios to achieve testable coverage while documenting limitations.

---

## TDD Workflow

### Red-Green-Refactor Cycle

#### 1. Red: Write Failing Test

**Example: PluginDetector**

```typescript
// plugin-detector.spec.ts

describe('PluginDetector', () => {
  it('should parse valid .claude/settings.json', async () => {
    // Arrange: Set up fixture
    mockFs.readFile.mockResolvedValue(
      JSON.stringify({
        plugins: {
          'python-development': {
            marketplace: 'claude-code-workflows',
            enabled: true
          }
        }
      })
    );

    // Act: Call the method (will fail because not implemented)
    const detector = new PluginDetector();
    const plugins = await detector.detectInstalledPlugins();

    // Assert: Define expected behavior
    expect(plugins).toHaveLength(1);
    expect(plugins[0]).toMatchObject({
      name: 'python-development',
      marketplace: 'claude-code-workflows',
      enabled: true
    });
  });
});
```

**Run Test**: `nx test @overture/cli`
**Expected**: ❌ Test fails (method not implemented)

#### 2. Green: Implement Minimal Code

```typescript
// plugin-detector.ts

export class PluginDetector {
  async detectInstalledPlugins(): Promise<InstalledPlugin[]> {
    const settingsPath = this.getSettingsPath();
    const content = await fs.readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(content);

    return Object.entries(settings.plugins || {}).map(([name, config]: [string, any]) => ({
      name,
      marketplace: config.marketplace,
      enabled: config.enabled ?? true,
      installedAt: config.installedAt
    }));
  }

  private getSettingsPath(): string {
    return path.join(os.homedir(), '.claude', 'settings.json');
  }
}
```

**Run Test**: `nx test @overture/cli`
**Expected**: ✅ Test passes

#### 3. Refactor: Improve Code

Add error handling, extract methods, improve readability:

```typescript
export class PluginDetector {
  async detectInstalledPlugins(): Promise<InstalledPlugin[]> {
    try {
      const settings = await this.loadSettings();
      return this.parsePlugins(settings);
    } catch (error) {
      if (this.isFileNotFound(error)) {
        console.warn('⚠️  .claude/settings.json not found');
        return [];
      }
      throw error;
    }
  }

  private async loadSettings(): Promise<any> {
    const settingsPath = this.getSettingsPath();
    const content = await fs.readFile(settingsPath, 'utf-8');
    return JSON.parse(content);
  }

  private parsePlugins(settings: any): InstalledPlugin[] {
    const plugins = settings.plugins || {};
    return Object.entries(plugins).map(([name, config]: [string, any]) => ({
      name,
      marketplace: config.marketplace,
      enabled: config.enabled ?? true,
      installedAt: config.installedAt
    }));
  }

  private isFileNotFound(error: any): boolean {
    return error.code === 'ENOENT';
  }

  private getSettingsPath(): string {
    return path.join(os.homedir(), '.claude', 'settings.json');
  }
}
```

**Run Test**: `nx test @overture/cli`
**Expected**: ✅ Test still passes (refactoring preserved behavior)

#### 4. Add More Tests (Continue TDD)

```typescript
it('should return empty array when settings.json not found', async () => {
  mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });

  const detector = new PluginDetector();
  const plugins = await detector.detectInstalledPlugins();

  expect(plugins).toEqual([]);
});

it('should handle malformed JSON gracefully', async () => {
  mockFs.readFile.mockResolvedValue('{ invalid json }');

  const detector = new PluginDetector();

  await expect(detector.detectInstalledPlugins()).rejects.toThrow();
});
```

### TDD Best Practices

1. **Start with simplest test** - Build complexity incrementally
2. **One test at a time** - Focus on single behavior
3. **Run tests frequently** - After every small change
4. **Commit on green** - Version control at stable points
5. **Refactor confidently** - Tests protect against regressions

---

## Test Scenarios

### Unit Test Scenarios

#### MarketplaceRegistry

```typescript
describe('MarketplaceRegistry', () => {
  describe('resolveMarketplace', () => {
    it('should resolve known marketplace shortcuts', () => {
      expect(MarketplaceRegistry.resolveMarketplace('claude-code-workflows'))
        .toBe('anthropics/claude-code-workflows');
    });

    it('should return custom marketplace as-is', () => {
      expect(MarketplaceRegistry.resolveMarketplace('myorg/custom'))
        .toBe('myorg/custom');
    });

    it('should return local marketplace path as-is', () => {
      expect(MarketplaceRegistry.resolveMarketplace('./local-dev'))
        .toBe('./local-dev');
    });
  });

  describe('isKnownMarketplace', () => {
    it('should return true for known marketplaces', () => {
      expect(MarketplaceRegistry.isKnownMarketplace('claude-code-workflows'))
        .toBe(true);
    });

    it('should return false for custom marketplaces', () => {
      expect(MarketplaceRegistry.isKnownMarketplace('myorg/custom'))
        .toBe(false);
    });
  });
});
```

#### PluginDetector

```typescript
describe('PluginDetector', () => {
  describe('detectInstalledPlugins', () => {
    it('should parse valid settings.json', async () => { /* ... */ });
    it('should return empty array when file not found', async () => { /* ... */ });
    it('should handle malformed JSON', async () => { /* ... */ });
    it('should extract plugin metadata correctly', async () => { /* ... */ });
    it('should default enabled to true if missing', async () => { /* ... */ });
    it('should handle empty plugins object', async () => { /* ... */ });
  });

  describe('isPluginInstalled', () => {
    it('should return true when plugin is installed', async () => { /* ... */ });
    it('should return false when plugin not installed', async () => { /* ... */ });
    it('should match marketplace correctly', async () => { /* ... */ });
  });
});
```

#### PluginInstaller

```typescript
describe('PluginInstaller', () => {
  describe('installPlugin', () => {
    it('should execute install command successfully', async () => { /* ... */ });
    it('should auto-add known marketplaces', async () => { /* ... */ });
    it('should skip marketplace add for custom marketplaces', async () => { /* ... */ });
    it('should handle installation failures', async () => { /* ... */ });
    it('should throw when Claude binary not found', async () => { /* ... */ });
    it('should support dry-run mode', async () => { /* ... */ });
    it('should capture command output', async () => { /* ... */ });
  });

  describe('ensureMarketplace', () => {
    it('should add marketplace if not present', async () => { /* ... */ });
    it('should skip if marketplace already added', async () => { /* ... */ });
  });

  describe('checkClaudeBinary', () => {
    it('should return true when binary exists', async () => { /* ... */ });
    it('should return false when binary not found', async () => { /* ... */ });
  });
});
```

#### PluginExporter

```typescript
describe('PluginExporter', () => {
  describe('exportPlugins', () => {
    it('should prompt for plugin selection interactively', async () => { /* ... */ });
    it('should export specified plugins non-interactively', async () => { /* ... */ });
    it('should update user config preserving structure', async () => { /* ... */ });
    it('should handle no plugins selected', async () => { /* ... */ });
    it('should handle config file not found', async () => { /* ... */ });
  });

  describe('updateUserConfig', () => {
    it('should add new plugins to config', async () => { /* ... */ });
    it('should update existing plugin entries', async () => { /* ... */ });
    it('should preserve existing MCPs', async () => { /* ... */ });
  });
});
```

### Integration Test Scenarios

#### SyncEngine

```typescript
describe('SyncEngine - Plugin Sync Integration', () => {
  it('should install missing plugins from user config', async () => {
    // Arrange: User config has 3 plugins, 1 already installed
    mockConfigLoader.loadUserConfig.mockResolvedValue(/* config */);
    mockPluginDetector.detectInstalledPlugins.mockResolvedValue([/* 1 plugin */]);

    // Act
    const engine = new SyncEngine();
    await engine.syncPlugins();

    // Assert: 2 plugins installed, 1 skipped
    expect(mockPluginInstaller.installPlugin).toHaveBeenCalledTimes(2);
  });

  it('should warn when plugins found in project config', async () => { /* ... */ });
  it('should handle partial installation failures gracefully', async () => { /* ... */ });
  it('should show progress indicators during installation', async () => { /* ... */ });
  it('should continue with MCP sync after plugin sync', async () => { /* ... */ });
});
```

#### Full Workflow Tests

```typescript
describe('Plugin Sync Workflow', () => {
  it('should complete full sync workflow on fresh machine', async () => {
    // Scenario: New machine, no plugins installed
    // Config: 5 plugins declared
    // Expected: All 5 plugins installed
  });

  it('should handle partial sync (some plugins already installed)', async () => {
    // Scenario: 3 plugins installed, config has 5
    // Expected: 2 new plugins installed, 3 skipped
  });

  it('should export plugins and update config', async () => {
    // Scenario: 3 plugins installed, user exports 2
    // Expected: Config updated with 2 selected plugins
  });
});
```

### Error Scenario Tests

```typescript
describe('Error Handling', () => {
  it('should handle Claude binary not found', async () => { /* ... */ });
  it('should handle marketplace not found', async () => { /* ... */ });
  it('should handle plugin installation timeout', async () => { /* ... */ });
  it('should handle config file permission denied', async () => { /* ... */ });
  it('should handle malformed settings.json', async () => { /* ... */ });
  it('should handle network errors during installation', async () => { /* ... */ });
});
```

---

## Performance Testing

### Unit Test Performance

**Target**: <2 seconds for full unit test suite

**Strategy**:
- Mock all external dependencies (no real I/O)
- Avoid `setTimeout` unless necessary
- Use `jest.useFakeTimers()` for time-based tests

**Measurement**:
```bash
nx test @overture/cli --maxWorkers=1 --verbose
```

### Integration Test Performance

**Target**: <5 seconds for integration tests

**Strategy**:
- Use in-memory fixtures (no disk I/O)
- Parallel test execution where possible
- Mock slow operations (network, process spawning)

### Performance Benchmarks

Track test execution time over development:

```typescript
// performance/plugin-sync-benchmark.spec.ts

describe('Plugin Sync Performance Benchmarks', () => {
  it('should detect plugins in <10ms', async () => {
    const start = performance.now();

    const detector = new PluginDetector();
    await detector.detectInstalledPlugins();

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(10);
  });

  it('should install plugin in <100ms (mocked)', async () => {
    const start = performance.now();

    const installer = new PluginInstaller();
    await installer.installPlugin('test-plugin', 'test-marketplace');

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });
});
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/plugin-sync-tests.yml

name: Plugin Sync Tests

on:
  pull_request:
    paths:
      - 'apps/cli/src/core/plugin-*.ts'
      - 'apps/cli/src/domain/marketplace-registry.ts'
      - 'apps/cli/src/core/sync-engine.ts'
      - 'apps/cli/src/core/__fixtures__/plugin-sync/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run plugin sync tests
        run: |
          nx test @overture/cli --testPathPattern=plugin

      - name: Check coverage
        run: |
          nx test @overture/cli --coverage --testPathPattern=plugin

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: plugin-sync
```

### Pre-commit Hooks

```bash
# .husky/pre-commit

#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run tests for changed files
nx affected --target=test --base=HEAD~1
```

### Coverage Enforcement

```json
// jest.config.ts (partial)

{
  "coverageThreshold": {
    "global": {
      "branches": 85,
      "functions": 90,
      "lines": 90,
      "statements": 90
    },
    "./apps/cli/src/core/plugin-*.ts": {
      "branches": 90,
      "functions": 95,
      "lines": 95,
      "statements": 95
    },
    "./apps/cli/src/domain/marketplace-registry.ts": {
      "branches": 100,
      "functions": 100,
      "lines": 100,
      "statements": 100
    }
  }
}
```

---

## Appendix: Test Template Examples

### Unit Test Template

```typescript
/**
 * <Component> Tests
 *
 * Tests for <component description>
 *
 * @module core/<component>.spec
 */

import { <Component> } from './<component>';
import type { <Types> } from '../domain/config.types';

// Mock dependencies
jest.mock('<dependency-module>');

describe('<Component>', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up default mocks
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('<method>', () => {
    it('should <expected behavior>', async () => {
      // Arrange: Set up test data and mocks

      // Act: Call the method under test

      // Assert: Verify expected outcomes
      expect(/* ... */).toBe(/* ... */);
    });

    it('should handle <edge case>', async () => {
      // ...
    });
  });
});
```

### Integration Test Template

```typescript
/**
 * <Feature> Integration Tests
 *
 * End-to-end integration tests for <feature description>
 *
 * @module __tests__/<feature>.integration.spec
 */

import { <Services> } from '../core/<services>';

describe('<Feature> Integration', () => {
  beforeEach(() => {
    // Set up integration test environment
  });

  afterEach(() => {
    // Clean up test environment
  });

  it('should complete <workflow> successfully', async () => {
    // Arrange: Set up complex scenario

    // Act: Execute workflow

    // Assert: Verify end-to-end behavior
  });
});
```

---

## Summary

This testing strategy provides:

✅ **Clear TDD workflow** - Red-green-refactor cycle
✅ **Comprehensive mock patterns** - File system, process execution, prompts
✅ **Realistic test fixtures** - Based on actual Claude Code format
✅ **High coverage goals** - >90% for core services
✅ **Fast test execution** - <2s for unit tests
✅ **CI/CD integration** - Automated testing and coverage tracking

**Next Steps**:

1. Create test fixture files (Step 1.3 in implementation plan)
2. Write first failing test for MarketplaceRegistry (TDD start)
3. Implement component with minimal code to pass test
4. Refactor and add more tests
5. Track coverage with `nx test @overture/cli --coverage`

---

**End of Testing Strategy**
