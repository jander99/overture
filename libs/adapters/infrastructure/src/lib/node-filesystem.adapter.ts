/**
 * Node.js Filesystem Adapter
 *
 * Implements the FilesystemPort interface using Node.js fs/promises API.
 * This is the primary adapter for production use.
 *
 * @module lib/node-filesystem.adapter
 */

import type { FilesystemPort, Stats } from '@overture/ports-filesystem';
import fs from 'node:fs/promises';

/**
 * Node.js implementation of FilesystemPort
 *
 * Uses Node.js fs/promises for async filesystem operations.
 *
 * @example
 * ```typescript
 * const filesystem = new NodeFilesystemAdapter();
 *
 * // Read a file
 * const content = await filesystem.readFile('package.json');
 *
 * // Write a file
 * await filesystem.writeFile('output.txt', 'Hello, World!');
 *
 * // Check if file exists
 * if (await filesystem.exists('config.yml')) {
 *   console.log('Config found');
 * }
 * ```
 */
export class NodeFilesystemAdapter implements FilesystemPort {
  /**
   * Read the contents of a file as UTF-8 string
   *
   * @param path - Absolute or relative path to the file
   * @returns Promise resolving to file contents as string
   * @throws Error if file doesn't exist or cannot be read
   */
  async readFile(path: string): Promise<string> {
    return await fs.readFile(path, 'utf-8');
  }

  /**
   * Write content to a file, creating it if it doesn't exist
   *
   * @param path - Absolute or relative path to the file
   * @param content - String content to write
   * @returns Promise resolving when write completes
   * @throws Error if file cannot be written
   */
  async writeFile(path: string, content: string): Promise<void> {
    await fs.writeFile(path, content, 'utf-8');
  }

  /**
   * Check if a path exists (file or directory)
   *
   * @param path - Absolute or relative path to check
   * @returns Promise resolving to true if path exists, false otherwise
   */
  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a directory
   *
   * @param path - Absolute or relative path to create
   * @param options - Optional configuration
   * @param options.recursive - If true, create parent directories as needed
   * @returns Promise resolving when directory is created
   * @throws Error if directory cannot be created (unless recursive and parents exist)
   */
  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await fs.mkdir(path, options);
  }

  /**
   * Read the contents of a directory
   *
   * @param path - Absolute or relative path to directory
   * @returns Promise resolving to array of entry names (files and directories)
   * @throws Error if path is not a directory or cannot be read
   */
  async readdir(path: string): Promise<string[]> {
    return await fs.readdir(path);
  }

  /**
   * Get file or directory statistics
   *
   * @param path - Absolute or relative path to check
   * @returns Promise resolving to stats object
   * @throws Error if path doesn't exist or cannot be accessed
   */
  async stat(path: string): Promise<Stats> {
    const stats = await fs.stat(path);

    return {
      isFile: () => stats.isFile(),
      isDirectory: () => stats.isDirectory(),
      size: stats.size,
      mtime: stats.mtime,
    };
  }

  /**
   * Remove a file or directory
   *
   * @param path - Absolute or relative path to remove
   * @param options - Optional configuration
   * @param options.recursive - If true, remove directories and their contents
   * @returns Promise resolving when removal completes
   * @throws Error if path cannot be removed
   */
  async rm(path: string, options?: { recursive?: boolean }): Promise<void> {
    await fs.rm(path, options);
  }
}
