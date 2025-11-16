# Plugin Sync Test Fixtures

This directory contains test fixtures for the plugin sync feature.

## Directory Structure

```
plugin-sync/
├── claude-settings/      # .claude/settings.json examples
├── configs/              # Overture config.yaml examples
├── command-outputs/      # CLI command output examples
└── README.md             # This file
```

## Claude Settings Fixtures

**Location**: `claude-settings/`

These fixtures simulate `.claude/settings.json` files that Claude Code uses to track installed plugins.

| File | Description |
|------|-------------|
| `valid-settings.json` | Complete settings with 3 plugins (mixed enabled/disabled) |
| `empty-settings.json` | Settings with no plugins installed |
| `malformed-settings.json` | Invalid plugin entries (test error handling) |
| `disabled-plugins.json` | All plugins disabled |
| `mixed-marketplaces.json` | Plugins from different marketplace types |

## Config Fixtures

**Location**: `configs/`

These fixtures represent Overture configuration files with plugin declarations.

| File | Description |
|------|-------------|
| `user-with-plugins.yaml` | User global config with multiple plugins |
| `project-with-plugins.yaml` | Project config with plugins (should warn) |
| `empty-plugins.yaml` | Config with no plugins section |
| `invalid-marketplace.yaml` | Invalid marketplace type (test validation) |

## Command Output Fixtures

**Location**: `command-outputs/`

These fixtures capture example outputs from `claude` CLI commands.

| File | Description |
|------|-------------|
| `install-success.txt` | Successful plugin installation output |
| `install-failure.txt` | Failed installation (marketplace not found) |
| `marketplace-add.txt` | Successful marketplace addition |

## Usage

### Loading Fixtures in Tests

```typescript
import { loadFixture, loadJsonFixture, loadYamlFixture } from '../../__fixtures__/fixture-loader';

// Load raw fixture content
const output = await loadFixture('plugin-sync/command-outputs/install-success.txt');

// Load and parse JSON
const settings = await loadJsonFixture('plugin-sync/claude-settings/valid-settings.json');

// Load and parse YAML
const config = await loadYamlFixture('plugin-sync/configs/user-with-plugins.yaml');
```

### Using Fixtures with Mocks

```typescript
import * as fs from 'fs/promises';
import { loadFixture } from '../../__fixtures__/fixture-loader';

jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock fs.readFile to return fixture
const settingsFixture = await loadFixture('plugin-sync/claude-settings/valid-settings.json');
mockFs.readFile.mockResolvedValue(settingsFixture);
```

## Maintenance

When updating fixtures:

1. **Valid Settings**: Update `valid-settings.json` if `.claude/settings.json` format changes
2. **Error Cases**: Add new error fixtures as edge cases are discovered
3. **Command Outputs**: Update if Claude CLI output format changes
4. **Configs**: Ensure configs match current schema version

## Related Documentation

- [Plugin Sync Test Strategy](../../../../../docs/plugin-sync-test-strategy.md)
- [Plugin Sync Implementation Plan](../../../../../docs/PLUGIN-SYNC-IMPLEMENTATION.md)
