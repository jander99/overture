/**
 * Filesystem Mock Utilities
 *
 * Factory functions for creating filesystem mocks compatible with vitest.
 * Provides typed mocks for fs module operations.
 *
 * @module lib/mocks/filesystem.mock
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Mocked } from 'vitest';
import type * as fs from 'node:fs';

/**
 * Mock filesystem structure for testing
 */
export interface MockFileSystem {
  /**
   * Map of file paths to their contents
   */
  files: Map<string, string>;

  /**
   * Set of directory paths that exist
   */
  directories: Set<string>;
}

/**
 * Create a mock filesystem with predefined files and directories
 *
 * @param files - Object mapping file paths to their string contents
 * @param directories - Array of directory paths that exist
 * @returns MockFileSystem instance
 *
 * @example
 * ```typescript
 * const mockFs = createMockFs({
 *   '/home/user/.config/overture.yml': 'version: "2.0"',
 *   '/project/.overture/config.yaml': 'version: "2.0"'
 * }, ['/home/user/.config', '/project/.overture']);
 * ```
 */
export function createMockFs(
  files: Record<string, string> = {},
  directories: string[] = [],
): MockFileSystem {
  return {
    files: new Map(Object.entries(files)),
    directories: new Set(directories),
  };
}

/**
 * Configure fs.existsSync mock based on MockFileSystem
 *
 * @param mockFs - The mock filesystem
 * @param existsSyncMock - The vitest mock function for existsSync
 *
 * @example
 * ```typescript
 * const mockFs = createMockFs({ '/test/file.txt': 'content' });
 * configureMockFsExists(mockFs, fs.existsSync as any);
 * ```
 */
export function configureMockFsExists(
  mockFs: MockFileSystem,
  existsSyncMock: any,
): void {
  existsSyncMock.mockImplementation((path: string) => {
    return mockFs.files.has(path) || mockFs.directories.has(path);
  });
}

/**
 * Configure fs.readFileSync mock based on MockFileSystem
 *
 * @param mockFs - The mock filesystem
 * @param readFileSyncMock - The vitest mock function for readFileSync
 *
 * @example
 * ```typescript
 * const mockFs = createMockFs({ '/test/file.txt': 'content' });
 * configureMockFsReadFile(mockFs, fs.readFileSync as any);
 * ```
 */
export function configureMockFsReadFile(
  mockFs: MockFileSystem,
  readFileSyncMock: any,
): void {
  readFileSyncMock.mockImplementation((path: string) => {
    const content = mockFs.files.get(path);
    if (content === undefined) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return content;
  });
}

/**
 * Configure fs.writeFileSync mock to update MockFileSystem
 *
 * @param mockFs - The mock filesystem
 * @param writeFileSyncMock - The vitest mock function for writeFileSync
 *
 * @example
 * ```typescript
 * const mockFs = createMockFs();
 * configureMockFsWriteFile(mockFs, fs.writeFileSync as any);
 * ```
 */
export function configureMockFsWriteFile(
  mockFs: MockFileSystem,
  writeFileSyncMock: any,
): void {
  writeFileSyncMock.mockImplementation((path: string, content: string) => {
    mockFs.files.set(path, content);
  });
}

/**
 * Configure fs.mkdirSync mock to update MockFileSystem
 *
 * @param mockFs - The mock filesystem
 * @param mkdirSyncMock - The vitest mock function for mkdirSync
 *
 * @example
 * ```typescript
 * const mockFs = createMockFs();
 * configureMockFsMkdir(mockFs, fs.mkdirSync as any);
 * ```
 */
export function configureMockFsMkdir(
  mockFs: MockFileSystem,
  mkdirSyncMock: any,
): void {
  mkdirSyncMock.mockImplementation((path: string) => {
    mockFs.directories.add(path);
  });
}

/**
 * Configure all common fs mocks at once
 *
 * @param mockFs - The mock filesystem
 * @param fsMock - The mocked fs module
 *
 * @example
 * ```typescript
 * vi.mock('fs');
 * const mockFs = createMockFs({ '/test.txt': 'content' });
 * configureAllFsMocks(mockFs, fs as Mocked<typeof fs>);
 * ```
 */
export function configureAllFsMocks(
  mockFs: MockFileSystem,
  fsMock: Mocked<typeof fs>,
): void {
  configureMockFsExists(mockFs, fsMock.existsSync);
  configureMockFsReadFile(mockFs, fsMock.readFileSync);
  configureMockFsWriteFile(mockFs, fsMock.writeFileSync);
  configureMockFsMkdir(mockFs, fsMock.mkdirSync);
}
