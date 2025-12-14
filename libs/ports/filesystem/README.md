# @overture/ports-filesystem

Hexagonal architecture port for filesystem operations.

## Purpose

This library defines the **contract (interface)** for filesystem operations without providing any implementation. It follows the [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/) (Ports and Adapters) pattern, where this library represents a **port** - a boundary through which the application interacts with the external world.

**This is a pure interface library with zero runtime dependencies.**

## Architecture Pattern

```
┌─────────────────────────────────────┐
│   Application / Domain Layer        │
│                                      │
│   Uses: FilesystemPort interface    │
└──────────────┬──────────────────────┘
               │
               │ depends on (compile time)
               ▼
┌──────────────────────────────────────┐
│   @overture/ports-filesystem         │
│                                       │
│   Defines: FilesystemPort interface  │
│   Defines: Stats type                │
└──────────────▲──────────────────────┘
               │
               │ implements (runtime)
               │
┌──────────────┴──────────────────────┐
│   Adapter Layer                      │
│                                       │
│   - NodeFilesystemAdapter            │
│   - InMemoryFilesystemAdapter        │
│   - MockFilesystemAdapter (testing)  │
└──────────────────────────────────────┘
```

## Installation

```bash
npm install @overture/ports-filesystem
```

## Usage

### Defining a Service That Needs Filesystem Access

```typescript
import type { FilesystemPort } from '@overture/ports-filesystem';

export class ConfigurationService {
  constructor(private readonly fs: FilesystemPort) {}

  async loadConfig(path: string): Promise<object> {
    const exists = await this.fs.exists(path);
    if (!exists) {
      throw new Error(`Config file not found: ${path}`);
    }

    const content = await this.fs.readFile(path);
    return JSON.parse(content);
  }

  async saveConfig(path: string, config: object): Promise<void> {
    const content = JSON.stringify(config, null, 2);
    await this.fs.writeFile(path, content);
  }
}
```

### Implementing an Adapter

```typescript
import { promises as fs } from 'fs';
import type { FilesystemPort, Stats } from '@overture/ports-filesystem';

export class NodeFilesystemAdapter implements FilesystemPort {
  async readFile(path: string): Promise<string> {
    return fs.readFile(path, 'utf-8');
  }

  async writeFile(path: string, content: string): Promise<void> {
    await fs.writeFile(path, content, 'utf-8');
  }

  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await fs.mkdir(path, options);
  }

  async readdir(path: string): Promise<string[]> {
    return fs.readdir(path);
  }

  async stat(path: string): Promise<Stats> {
    const stats = await fs.stat(path);
    return {
      isFile: () => stats.isFile(),
      isDirectory: () => stats.isDirectory(),
      size: stats.size,
      mtime: stats.mtime,
    };
  }

  async rm(path: string, options?: { recursive?: boolean }): Promise<void> {
    await fs.rm(path, options);
  }
}
```

### Using Dependency Injection

```typescript
// Production code
const filesystem = new NodeFilesystemAdapter();
const configService = new ConfigurationService(filesystem);

// Test code
const mockFilesystem: FilesystemPort = {
  readFile: vi.fn().mockResolvedValue('{"version": "1.0"}'),
  writeFile: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(true),
  mkdir: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
  stat: vi.fn().mockResolvedValue({
    isFile: () => true,
    isDirectory: () => false,
    size: 20,
    mtime: new Date(),
  }),
  rm: vi.fn().mockResolvedValue(undefined),
};
const configService = new ConfigurationService(mockFilesystem);
```

## API Reference

### FilesystemPort Interface

The main port interface defining all filesystem operations.

#### Methods

##### `readFile(path: string): Promise<string>`

Read the contents of a file as a UTF-8 string.

- **Parameters:**
  - `path` - Absolute or relative path to the file
- **Returns:** Promise resolving to file contents as string
- **Throws:** Error if file doesn't exist or cannot be read

##### `writeFile(path: string, content: string): Promise<void>`

Write content to a file, creating it if it doesn't exist.

- **Parameters:**
  - `path` - Absolute or relative path to the file
  - `content` - String content to write
- **Returns:** Promise resolving when write completes
- **Throws:** Error if file cannot be written

##### `exists(path: string): Promise<boolean>`

Check if a path exists (file or directory).

- **Parameters:**
  - `path` - Absolute or relative path to check
- **Returns:** Promise resolving to true if path exists, false otherwise

##### `mkdir(path: string, options?: { recursive?: boolean }): Promise<void>`

Create a directory.

- **Parameters:**
  - `path` - Absolute or relative path to create
  - `options.recursive` - If true, create parent directories as needed
- **Returns:** Promise resolving when directory is created
- **Throws:** Error if directory cannot be created

##### `readdir(path: string): Promise<string[]>`

Read the contents of a directory.

- **Parameters:**
  - `path` - Absolute or relative path to directory
- **Returns:** Promise resolving to array of entry names (files and directories)
- **Throws:** Error if path is not a directory or cannot be read

##### `stat(path: string): Promise<Stats>`

Get file or directory statistics.

- **Parameters:**
  - `path` - Absolute or relative path to check
- **Returns:** Promise resolving to Stats object
- **Throws:** Error if path doesn't exist or cannot be accessed

##### `rm(path: string, options?: { recursive?: boolean }): Promise<void>`

Remove a file or directory.

- **Parameters:**
  - `path` - Absolute or relative path to remove
  - `options.recursive` - If true, remove directories and their contents
- **Returns:** Promise resolving when removal completes
- **Throws:** Error if path cannot be removed

### Stats Type

Represents metadata about a file or directory.

```typescript
interface Stats {
  isFile(): boolean;
  isDirectory(): boolean;
  size: number;
  mtime: Date;
}
```

## Benefits of This Architecture

1. **Dependency Inversion:** Application code depends on the abstract port, not concrete implementations
2. **Testability:** Easy to inject mock implementations for testing
3. **Flexibility:** Swap implementations without changing application code
4. **Zero Dependencies:** Pure TypeScript interfaces have no runtime overhead
5. **Type Safety:** Full TypeScript support with detailed JSDoc documentation

## Related Libraries

- **@overture/adapters-filesystem** - Production adapter implementations
- **@overture/testing** - Testing utilities with mock adapters
- **@overture/ports-output** - Port for output operations (console, logging)
- **@overture/ports-process** - Port for process operations (exit, cwd, env)

## License

This is part of the Overture monorepo. See the root LICENSE file for details.
