# @overture/discovery-core

Discovery service for detecting AI client installations and configurations.

## Architecture

This library follows **hexagonal architecture** principles with **dependency injection** for maximum testability and flexibility.

### Key Features

- ✅ **No Singletons** - All services use factory functions instead of singleton patterns
- ✅ **Dependency Injection** - All external dependencies injected through ports
- ✅ **Port-Adapter Pattern** - Abstracts infrastructure concerns (filesystem, process execution)
- ✅ **Pure Functions** - Stateless where possible, state managed explicitly
- ✅ **100% Testable** - All functionality can be tested with mocks

## Installation

```bash
npm install @overture/discovery-core @overture/config-types @overture/ports-process @overture/errors
```

## Usage

### Basic Discovery

```typescript
import { createDiscoveryService } from '@overture/discovery-core';
import type { DiscoveryServiceDeps } from '@overture/discovery-core';

// Create dependencies
const deps: DiscoveryServiceDeps = {
  processPort: {
    exec: async (cmd, args) => { /* implementation */ },
    commandExists: async (cmd) => { /* implementation */ },
  },
  environmentPort: {
    platform: () => process.platform as Platform,
    homedir: () => os.homedir(),
    env: process.env,
  },
  fileExists: fs.existsSync,
  readFile: (path) => fs.readFileSync(path, 'utf-8'),
  readDir: fs.readdirSync,
  isDirectory: (path) => fs.statSync(path).isDirectory(),
  joinPath: path.join,
  expandTilde: (p) => p.replace(/^~/, os.homedir()),
};

// Create service
const discovery = createDiscoveryService(deps);

// Discover all clients
const report = await discovery.discoverAll(adapters);

console.log(`Found ${report.summary.detected} of ${report.summary.totalClients} clients`);
if (report.environment.isWSL2) {
  console.log(`WSL2 detected: ${report.environment.wsl2Info?.distroName}`);
}
```

### With Configuration

```typescript
const config = {
  enabled: true,
  wsl2_auto_detect: true,
  clients: {
    'claude-code': {
      enabled: true,
      binary_path: '/custom/path/to/claude',
    },
  },
};

const discovery = createDiscoveryService(deps, config);
```

### Individual Components

#### BinaryDetector

Detects CLI binaries and application bundles:

```typescript
import { createBinaryDetector } from '@overture/discovery-core';

const detector = createBinaryDetector(
  processPort,
  environmentPort,
  fs.existsSync,
  (path) => fs.readFileSync(path, 'utf-8')
);

const result = await detector.detectClient(adapter, 'linux');
```

#### WSL2Detector

Detects WSL2 environment and resolves Windows paths:

```typescript
import { createWSL2Detector } from '@overture/discovery-core';

const detector = createWSL2Detector(
  processPort,
  environmentPort,
  fs.existsSync,
  (path) => fs.readFileSync(path, 'utf-8'),
  fs.readdirSync,
  (path) => fs.statSync(path).isDirectory(),
  path.join
);

const info = await detector.detectEnvironment();
if (info.isWSL2) {
  console.log(`WSL2: ${info.distroName}`);
  console.log(`Windows Profile: ${info.windowsUserProfile}`);
}
```

## Testing

All components are fully testable using mocks:

```typescript
import { describe, it, expect } from 'vitest';
import { createDiscoveryService } from '@overture/discovery-core';
import {
  createMockProcessPort,
  createMockEnvironmentPort,
  createMockFilesystem,
} from '@overture/discovery-core/test-helpers';

describe('MyTest', () => {
  it('should discover clients', async () => {
    const processPort = createMockProcessPort();
    const environmentPort = createMockEnvironmentPort('linux');
    const fs = createMockFilesystem();

    // Configure mocks...

    const service = createDiscoveryService({
      processPort,
      environmentPort,
      // ... other deps
    });

    const report = await service.discoverAll(adapters);
    expect(report.summary.detected).toBeGreaterThan(0);
  });
});
```

## Architecture Benefits

### Hexagonal Architecture

- **Ports** - Abstract interfaces for external concerns (ProcessPort, EnvironmentPort)
- **Adapters** - Concrete implementations (filesystem, process execution)
- **Core Logic** - Pure business logic, no infrastructure dependencies

### Dependency Injection

- All dependencies explicitly declared
- Easy to mock and test
- No hidden global state
- Predictable behavior

### Factory Functions

```typescript
// ❌ Before (Singleton)
const service = DiscoveryService.getInstance();

// ✅ After (Factory with DI)
const service = createDiscoveryService(deps, config);
```

## API Reference

### DiscoveryService

Factory: `createDiscoveryService(deps, config?)`

Methods:
- `discoverAll(adapters)` - Discover all registered clients
- `discoverByAdapter(adapter)` - Discover specific client
- `updateConfig(config)` - Update discovery configuration
- `getConfig()` - Get current configuration

### BinaryDetector

Factory: `createBinaryDetector(processPort, environmentPort, fileExists, readFile)`

Methods:
- `detectClient(adapter, platform)` - Detect client binary/bundle
- `detectBinary(binaryName)` - Detect specific binary in PATH
- `detectAppBundle(paths)` - Detect application bundle
- `validateConfigFile(path)` - Validate JSON config file

### WSL2Detector

Factory: `createWSL2Detector(processPort, environmentPort, fileExists, readFile, readDir, isDirectory, joinPath)`

Methods:
- `detectEnvironment()` - Detect WSL2 environment
- `isWSL2()` - Check if running in WSL2
- `getDistroName()` - Get WSL2 distribution name
- `getWindowsUserProfile()` - Get Windows user profile path
- `translateWindowsPath(path)` - Translate Windows to WSL2 path
- `getWindowsInstallPaths(client, profile)` - Get Windows installation paths
- `getWindowsConfigPath(client, profile)` - Get Windows config path

## Testing Coverage

- **40 tests** passing
- **3 test suites**
- **100% coverage** of core functionality

Test files:
- `binary-detector.spec.ts` (14 tests)
- `wsl2-detector.spec.ts` (17 tests)
- `discovery-service.spec.ts` (9 tests)

## Migration from CLI

This library extracts and refactors discovery logic from `apps/cli/src/core/`:

**Before:**
```typescript
import { discoveryService } from '../core/discovery-service';
// Uses singleton with hardcoded dependencies
```

**After:**
```typescript
import { createDiscoveryService } from '@overture/discovery-core';
// Inject dependencies explicitly
const service = createDiscoveryService(deps);
```

## Dependencies

- `@overture/config-types` - Type definitions
- `@overture/errors` - Error handling
- `@overture/ports-process` - Process and environment ports

## License

Private - Part of Overture monorepo
