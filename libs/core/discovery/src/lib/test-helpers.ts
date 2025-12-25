/**
 * Test Helpers for Discovery Core
 *
 * Utilities for creating mocks and test fixtures.
 *
 * @module lib/test-helpers
 */

import type { ProcessPort, EnvironmentPort } from '@overture/ports-process';
import type { ClientAdapter, Platform } from '@overture/config-types';

/**
 * Create a mock ProcessPort
 */
export function createMockProcessPort(
  execResults: Map<
    string,
    { stdout: string; stderr: string; exitCode: number }
  > = new Map(),
  commandExistsResults: Map<string, boolean> = new Map(),
): ProcessPort {
  return {
    exec: async (command: string, args: string[] = []) => {
      const key = `${command} ${args.join(' ')}`;
      const result = execResults.get(key);
      if (!result) {
        return { stdout: '', stderr: '', exitCode: 127 };
      }
      return result;
    },
    commandExists: async (command: string) => {
      return commandExistsResults.get(command) ?? false;
    },
  };
}

/**
 * Create a mock EnvironmentPort
 */
export function createMockEnvironmentPort(
  platform: Platform = 'linux',
  env: Record<string, string | undefined> = {},
): EnvironmentPort {
  return {
    platform: () => platform,
    homedir: () => '/home/testuser',
    env: {
      HOME: '/home/testuser',
      PATH: '/usr/bin:/bin',
      ...env,
    },
  };
}

/**
 * Create a mock filesystem
 */
export interface MockFilesystem {
  files: Map<string, string>;
  directories: Set<string>;
}

export function createMockFilesystem(
  files: Map<string, string> = new Map(),
  directories: Set<string> = new Set(),
): MockFilesystem {
  return { files, directories };
}

/**
 * Create filesystem functions from mock
 */
export function createFilesystemFunctions(fs: MockFilesystem) {
  return {
    fileExists: (path: string): boolean => {
      return fs.files.has(path) || fs.directories.has(path);
    },
    readFile: (path: string): string => {
      const content = fs.files.get(path);
      if (content === undefined) {
        throw new Error(`File not found: ${path}`);
      }
      return content;
    },
    readDir: (path: string): string[] => {
      if (!fs.directories.has(path)) {
        throw new Error(`Directory not found: ${path}`);
      }
      // Find all files and dirs that are children of this path
      const children = new Set<string>();

      // Check files
      for (const file of fs.files.keys()) {
        if (file.startsWith(path + '/')) {
          const relative = file.substring(path.length + 1);
          const firstPart = relative.split('/')[0];
          children.add(firstPart);
        }
      }

      // Check directories
      for (const dir of fs.directories) {
        if (dir.startsWith(path + '/') && dir !== path) {
          const relative = dir.substring(path.length + 1);
          const firstPart = relative.split('/')[0];
          children.add(firstPart);
        }
      }

      return Array.from(children);
    },
    isDirectory: (path: string): boolean => {
      return fs.directories.has(path);
    },
  };
}

/**
 * Create a mock ClientAdapter
 */
export function createMockAdapter(
  name = 'test-client',
  overrides: Partial<ClientAdapter> = {},
): ClientAdapter {
  return {
    name: name as ClientAdapter['name'],
    schemaRootKey: 'mcpServers',
    detectConfigPath: () => null,
    supportsTransport: () => true,
    isInstalled: () => false,
    getBinaryNames: () => [],
    getAppBundlePaths: () => [],
    requiresBinary: () => false,
    ...overrides,
  };
}

/**
 * Simple path join implementation for tests
 */
export function joinPath(...paths: string[]): string {
  return paths.join('/').replace(/\/+/g, '/');
}

/**
 * Simple tilde expansion for tests
 */
export function expandTilde(path: string): string {
  if (path.startsWith('~/')) {
    return '/home/testuser' + path.substring(1);
  }
  return path;
}
