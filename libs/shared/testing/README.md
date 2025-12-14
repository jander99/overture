# @overture/testing

Shared testing utilities for the Overture monorepo. Provides mocks, fixtures, and builders for consistent testing across all libraries.

## Overview

This library is the foundation for all other Overture libraries and provides:

- **Mocks**: Factory functions for creating test mocks (filesystem, process, adapters, platform)
- **Fixtures**: Predefined configuration objects for common test scenarios
- **Builders**: Builder pattern utilities for flexible test data creation

## Installation

This library is already available in the Overture monorepo via package exports:

```typescript
import { createMockFs, buildConfig, validUserConfig } from '@overture/testing';
```

## Usage

### Filesystem Mocks

Mock filesystem operations without touching the real filesystem:

```typescript
import { createMockFs, configureMockFsExists } from '@overture/testing';
import * as fs from 'fs';
import { vi } from 'vitest';

// Mock the fs module
vi.mock('fs');

// Create mock filesystem
const mockFs = createMockFs(
  { '/config/overture.yml': 'version: "2.0"' },
  ['/config']
);

// Configure fs.existsSync mock
configureMockFsExists(mockFs, fs.existsSync as any);

// Now fs.existsSync works with your mock data
fs.existsSync('/config/overture.yml'); // true
fs.existsSync('/nonexistent'); // false
```

### Process Mocks

Mock command execution without running actual processes:

```typescript
import { createMockProcess, buildExecResult } from '@overture/testing';

// Create mock process with queued results
const mockProcess = createMockProcess([
  buildExecResult('Plugin installed successfully\n'),
  buildExecResult('', 'Error: Plugin not found\n', 1),
]);

// Execute commands (returns queued results)
const result1 = await mockProcess.execute('claude', ['plugin', 'install']);
// { stdout: 'Plugin installed successfully\n', stderr: '', exitCode: 0 }

const result2 = await mockProcess.execute('claude', ['plugin', 'list']);
// { stdout: '', stderr: 'Error: Plugin not found\n', exitCode: 1 }

// Check execution history
console.log(mockProcess.history);
// [{ command: 'claude', args: ['plugin', 'install'] }, ...]
```

### Adapter Mocks

Mock client adapters for testing client integration:

```typescript
import { createDetectedAdapter, getLastWrittenConfig } from '@overture/testing';

// Create mock adapter for detected client
const adapter = createDetectedAdapter('claude-code', {
  mcpServers: { github: { command: 'mcp-server-github' } },
});

// Test adapter methods
await adapter.detect(); // true
const config = await adapter.readConfig(); // { mcpServers: {...} }

await adapter.writeConfig({ mcpServers: { updated: {} } });

// Check write history
const lastConfig = getLastWrittenConfig(adapter);
```

### Platform Mocks

Mock OS/platform operations:

```typescript
import { mockLinuxPlatform } from '@overture/testing';
import * as os from 'os';
import { vi } from 'vitest';

vi.mock('os');

// Mock Linux platform
mockLinuxPlatform(os as any, '/home/testuser');

os.platform(); // 'linux'
os.homedir(); // '/home/testuser'
```

### Configuration Fixtures

Use predefined configuration objects:

```typescript
import { validUserConfig, validProjectConfig, configWithPlugins } from '@overture/testing';

describe('Config Loader', () => {
  it('should load valid user config', () => {
    const config = validUserConfig;
    expect(config.version).toBe('2.0');
  });
});
```

### Configuration Builders

Build flexible test configurations:

```typescript
import { buildConfig, buildMcpServer, buildPluginConfig } from '@overture/testing';

const config = buildConfig({
  version: '2.0',
  plugins: {
    'python-development': buildPluginConfig('claude-code-workflows', true, ['python-repl']),
  },
  mcp: {
    'python-repl': buildMcpServer('uvx', ['mcp-server-python-repl'], {}, 'stdio'),
  },
});
```

## API Reference

### Mocks

#### Filesystem
- `createMockFs(files, directories)` - Create mock filesystem
- `configureMockFsExists(mockFs, existsSyncMock)` - Configure existsSync
- `configureMockFsReadFile(mockFs, readFileSyncMock)` - Configure readFileSync
- `configureMockFsWriteFile(mockFs, writeFileSyncMock)` - Configure writeFileSync
- `configureMockFsMkdir(mockFs, mkdirSyncMock)` - Configure mkdirSync
- `configureAllFsMocks(mockFs, fsMock)` - Configure all fs mocks at once

#### Process
- `buildExecResult(stdout, stderr, exitCode)` - Build execution result
- `createMockProcess(results)` - Create mock process executor
- `createSuccessProcess(output)` - Create always-succeeding process
- `createFailureProcess(error, exitCode)` - Create always-failing process
- `resetMockProcess(executor)` - Reset process history
- `addMockResults(executor, results)` - Add more results to queue

#### Adapter
- `createMockAdapter(name, options)` - Create mock client adapter
- `createDetectedAdapter(name, config)` - Create detected adapter
- `createUndetectedAdapter(name)` - Create undetected adapter
- `createDisabledAdapter(name)` - Create disabled adapter
- `resetAdapterHistory(adapter)` - Reset write history
- `getLastWrittenConfig(adapter)` - Get last written config

#### Platform
- `createLinuxPlatform(homedir)` - Create Linux platform config
- `createMacOSPlatform(homedir)` - Create macOS platform config
- `createWindowsPlatform(homedir)` - Create Windows platform config
- `createWSL2Platform(homedir)` - Create WSL2 platform config
- `configureMockOs(platformConfig, osMock)` - Configure os module mock
- `mockLinuxPlatform(osMock, homedir)` - Quick Linux setup
- `mockMacOSPlatform(osMock, homedir)` - Quick macOS setup
- `mockWindowsPlatform(osMock, homedir)` - Quick Windows setup

### Fixtures

- `validUserConfig` - Complete user global configuration
- `validProjectConfig` - Complete project configuration
- `configWithPlugins` - Configuration with plugins
- `configWithExclusions` - Configuration with client exclusions
- `configWithIncludes` - Configuration with client includes
- `configWithPlatformOverrides` - Configuration with platform overrides
- `configWithWSL2` - Configuration with WSL2 discovery
- `minimalConfig` - Minimal valid configuration
- `emptyConfig` - Empty configuration (no MCPs)
- `invalidConfig` - Invalid configuration (for error testing)

### Builders

- `buildMcpServer(command, args, env, transport, overrides)` - Build MCP server config
- `buildClientConfig(enabled, overrides)` - Build client config
- `buildPluginConfig(marketplace, enabled, mcps)` - Build plugin config
- `buildSyncOptions(overrides)` - Build sync options
- `buildConfig(options)` - Build full Overture config
- `buildUserConfig(plugins, mcp)` - Build user global config
- `buildProjectConfig(mcp)` - Build project config
- `buildConfigWithPlugins(plugins, mcp)` - Build config with plugins
- `buildClaudeSettings(plugins, marketplaces)` - Build Claude settings
- `buildInstalledPlugin(overrides)` - Build installed plugin
- `buildInstalledPlugins(count, baseOverrides)` - Build multiple plugins
- `buildInstallationResult(overrides)` - Build installation result
- `buildBinaryDetectionResult(status, overrides)` - Build detection result
- `buildSyncResult(success, clientResults)` - Build sync result
- `buildClientSyncResult(success, synced, skipped, overrides)` - Build client sync result

## Building

Run `nx build @overture/testing` to build the library.

## Running unit tests

Run `nx test @overture/testing` to execute the unit tests via [Vitest](https://vitest.dev/).

## Dependencies

This library has **zero production dependencies** and only requires:
- `tslib` - TypeScript runtime library
- `vitest` - Test runner (dev dependency)

All other dependencies are peer dependencies that consuming libraries must provide.
