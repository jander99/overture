# @overture/ports-process

Hexagonal architecture ports for process execution and environment information.

## Purpose

This library provides **pure TypeScript interfaces** that define the contracts for:

- **Process Execution**: Running external commands and checking command availability
- **Environment Information**: Accessing OS platform, home directory, and environment variables

Following hexagonal architecture principles, these ports decouple the application core from infrastructure details. Implementations (adapters) can use Node.js APIs, mocks for testing, or any other mechanism.

## Features

- ✅ **Pure TypeScript types** - Zero runtime dependencies
- ✅ **Hexagonal architecture** - Clean separation between core and infrastructure
- ✅ **Comprehensive documentation** - Full JSDoc comments with examples
- ✅ **Test-friendly** - Easy to mock for testing
- ✅ **ESM-first** - Modern module system with `.js` extensions

## Installation

```bash
npm install @overture/ports-process
```

## Exports

### ProcessPort

Interface for executing external commands.

```typescript
import type { ProcessPort, ExecResult } from '@overture/ports-process';

// Example implementation (actual adapter would use child_process)
const processPort: ProcessPort = {
  async exec(command: string, args: string[] = []): Promise<ExecResult> {
    // Implementation using Node.js child_process
    return { stdout: '', stderr: '', exitCode: 0 };
  },

  async commandExists(command: string): Promise<boolean> {
    // Check if command is in PATH
    return true;
  },
};

// Usage
const result = await processPort.exec('npm', ['--version']);
if (result.exitCode === 0) {
  console.log('npm version:', result.stdout.trim());
}

const hasDocker = await processPort.commandExists('docker');
```

### EnvironmentPort

Interface for accessing environment information.

```typescript
import type { EnvironmentPort, Platform } from '@overture/ports-process';

// Example implementation (actual adapter would use Node.js os and process)
const envPort: EnvironmentPort = {
  platform(): Platform {
    return 'linux'; // or 'darwin' or 'win32'
  },

  homedir(): string {
    return '/home/user';
  },

  env: process.env,
};

// Usage
const platform = envPort.platform();
const home = envPort.homedir();
const configPath = `${home}/.config/overture.yml`;

const apiKey = envPort.env.API_KEY ?? 'default-key';
```

## Type Definitions

### ExecResult

Result of command execution:

```typescript
interface ExecResult {
  stdout: string; // Standard output
  stderr: string; // Standard error
  exitCode: number; // Exit code (0 = success)
}
```

### Platform

Supported operating system platforms:

```typescript
type Platform = 'linux' | 'darwin' | 'win32';
```

## Usage Patterns

### Platform-Specific Logic

```typescript
import type { EnvironmentPort, Platform } from '@overture/ports-process';

function getConfigPath(envPort: EnvironmentPort): string {
  const home = envPort.homedir();
  const separator = envPort.platform() === 'win32' ? '\\' : '/';
  return `${home}${separator}.config${separator}overture.yml`;
}
```

### Command Execution with Error Handling

```typescript
import type { ProcessPort, ExecResult } from '@overture/ports-process';

async function installPackage(
  processPort: ProcessPort,
  packageName: string,
): Promise<void> {
  const result = await processPort.exec('npm', ['install', packageName]);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to install ${packageName}: ${result.stderr}`);
  }

  console.log(result.stdout);
}
```

### Environment Detection

```typescript
import type { EnvironmentPort } from '@overture/ports-process';

function isWSL(envPort: EnvironmentPort): boolean {
  return (
    envPort.platform() === 'linux' && envPort.env.WSL_DISTRO_NAME !== undefined
  );
}

function isProduction(envPort: EnvironmentPort): boolean {
  return envPort.env.NODE_ENV === 'production';
}
```

## Testing

This library makes testing easy by providing pure interfaces that can be mocked:

```typescript
import { describe, it, expect } from 'vitest';
import type {
  ProcessPort,
  ExecResult,
  EnvironmentPort,
} from '@overture/ports-process';

describe('my feature', () => {
  it('should execute commands', async () => {
    // Create a mock implementation
    const mockProcess: ProcessPort = {
      exec: async (
        command: string,
        args: string[] = [],
      ): Promise<ExecResult> => ({
        stdout: `Mocked: ${command} ${args.join(' ')}`,
        stderr: '',
        exitCode: 0,
      }),
      commandExists: async (command: string): Promise<boolean> => {
        return ['npm', 'node'].includes(command);
      },
    };

    // Test your code with the mock
    const result = await mockProcess.exec('npm', ['install']);
    expect(result.exitCode).toBe(0);
  });
});
```

For comprehensive mock utilities, use `@overture/testing`:

```typescript
import { createMockProcess, buildExecResult } from '@overture/testing';

const mockProcess = createMockProcess([
  buildExecResult('Success!', '', 0),
  buildExecResult('', 'Error!', 1),
]);
```

## Architecture

This library follows **hexagonal architecture** (ports and adapters):

```
┌─────────────────────────────────────┐
│   Application Core (Domain Logic)  │
│                                     │
│  Uses: ProcessPort, EnvironmentPort│
└─────────────┬───────────────────────┘
              │ depends on interfaces
              │
┌─────────────▼───────────────────────┐
│  @overture/ports-process (Ports)    │◄─── This library
│                                     │
│  Defines: ProcessPort, EnvPort      │
└─────────────┬───────────────────────┘
              │ implemented by
              │
┌─────────────▼───────────────────────┐
│  Adapters (Infrastructure Layer)    │
│                                     │
│  - NodeProcessAdapter (uses child_process)
│  - NodeEnvironmentAdapter (uses os, process)
│  - MockProcessAdapter (for testing)
└─────────────────────────────────────┘
```

**Benefits:**

- ✅ Application core has no dependencies on Node.js APIs
- ✅ Easy to test with mock implementations
- ✅ Can swap implementations without changing core logic
- ✅ Clear boundaries between business logic and infrastructure

## Related Libraries

- **@overture/ports-output** - Port for CLI output (console, logging)
- **@overture/testing** - Mock implementations and test utilities
- **@overture/config-types** - Configuration type definitions

## License

Private (part of Overture monorepo)
