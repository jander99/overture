# Plugin Sync Testing Quick Start

**For developers implementing plugin sync components**

---

## TL;DR

1. **Load test fixtures**: Use `fixture-loader.ts`
2. **Build mock data**: Use `mock-builders.ts`
3. **See examples**: Check `mock-examples.spec.ts`
4. **Follow TDD**: Red → Green → Refactor

---

## Quick Examples

### Load a Fixture

```typescript
import { loadJsonFixture } from '../../../__fixtures__/fixture-loader';

// In your test
const settings = await loadJsonFixture('plugin-sync/claude-settings/valid-settings.json');
```

### Mock File System

```typescript
import * as fs from 'fs/promises';
jest.mock('fs/promises');

const mockFs = fs as jest.Mocked<typeof fs>;
mockFs.readFile.mockResolvedValue(JSON.stringify({ plugins: {} }));
```

### Mock Process Execution

```typescript
import { ProcessExecutor } from '../../infrastructure/process-executor';
jest.mock('../../infrastructure/process-executor');

const mockExec = ProcessExecutor as jest.MockedClass<typeof ProcessExecutor>;
mockExec.exec.mockResolvedValue({ stdout: 'Success\n', stderr: '', exitCode: 0 });
```

### Mock Interactive Prompts

```typescript
import inquirer from 'inquirer';
jest.mock('inquirer');

const mockInquirer = inquirer as jest.Mocked<typeof inquirer>;
mockInquirer.prompt.mockResolvedValue({ selectedPlugins: ['plugin-a'] });
```

### Build Mock Data

```typescript
import { buildInstalledPlugin, buildConfigWithPlugins } from './mock-builders';

const plugin = buildInstalledPlugin({ name: 'python-development' });
const config = buildConfigWithPlugins({ 'python-development': { marketplace: 'claude-code-workflows' } });
```

---

## TDD Workflow

### 1. Write Failing Test (RED)

```typescript
describe('PluginDetector', () => {
  it('should detect installed plugins', async () => {
    // Arrange: Set up mocks
    const fixture = await loadJsonFixture('plugin-sync/claude-settings/valid-settings.json');
    mockFs.readFile.mockResolvedValue(JSON.stringify(fixture));

    // Act: Call method (will fail - not implemented yet)
    const detector = new PluginDetector();
    const plugins = await detector.detectInstalledPlugins();

    // Assert: Define expected behavior
    expect(plugins).toHaveLength(3);
    expect(plugins[0].name).toBe('python-development');
  });
});
```

### 2. Implement Code (GREEN)

```typescript
export class PluginDetector {
  async detectInstalledPlugins(): Promise<InstalledPlugin[]> {
    const settings = await this.loadSettings();
    return this.parsePlugins(settings);
  }
}
```

### 3. Refactor (REFACTOR)

```typescript
export class PluginDetector {
  async detectInstalledPlugins(): Promise<InstalledPlugin[]> {
    try {
      const settings = await this.loadSettings();
      return this.parsePlugins(settings);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return []; // No settings file
      }
      throw error;
    }
  }
}
```

---

## Available Fixtures

### Claude Settings (`claude-settings/`)

```
valid-settings.json        - 3 plugins (happy path)
empty-settings.json        - No plugins
malformed-settings.json    - Invalid entries
disabled-plugins.json      - All disabled
mixed-marketplaces.json    - Various marketplace types
```

### Overture Configs (`configs/`)

```
user-with-plugins.yaml     - User global config
project-with-plugins.yaml  - Project config (warning test)
empty-plugins.yaml         - No plugins section
invalid-marketplace.yaml   - Schema validation
```

### Command Outputs (`command-outputs/`)

```
install-success.txt        - Successful installation
install-failure.txt        - Failed installation
marketplace-add.txt        - Marketplace addition
```

---

## Coverage Targets

| Component | Target |
|-----------|--------|
| MarketplaceRegistry | 100% |
| PluginDetector | 95%+ |
| PluginInstaller | 90%+ |
| PluginExporter | 90%+ |

**Check coverage**:
```bash
nx test @overture/cli --coverage --testPathPattern=plugin
```

---

## Common Patterns

### Test File Template

```typescript
import * as fs from 'fs/promises';
import { ProcessExecutor } from '../../infrastructure/process-executor';
import { loadJsonFixture } from '../../../__fixtures__/fixture-loader';
import { buildInstalledPlugin } from './mock-builders';

jest.mock('fs/promises');
jest.mock('../../infrastructure/process-executor');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockExec = ProcessExecutor as jest.MockedClass<typeof ProcessExecutor>;

describe('YourComponent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should do something', async () => {
    // Your test here
  });
});
```

### Error Testing

```typescript
it('should handle file not found', async () => {
  mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });

  const detector = new PluginDetector();
  const plugins = await detector.detectInstalledPlugins();

  expect(plugins).toEqual([]); // Graceful handling
});
```

---

## Resources

- **Full Strategy**: `/home/jeff/workspaces/ai/overture/docs/plugin-sync-test-strategy.md`
- **Deliverables Summary**: `/home/jeff/workspaces/ai/overture/docs/plugin-sync-test-deliverables.md`
- **Mock Examples**: `./mock-examples.spec.ts`
- **Implementation Plan**: `/home/jeff/workspaces/ai/overture/docs/PLUGIN-SYNC-IMPLEMENTATION.md`

---

## Need Help?

Check these files for working examples:
- `mock-examples.spec.ts` - 19 test examples
- `mock-builders.ts` - Mock factory functions
- `fixture-loader.ts` - Fixture loading utilities
