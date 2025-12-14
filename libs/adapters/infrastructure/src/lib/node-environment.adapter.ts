/**
 * Node.js Environment Adapter
 *
 * Implements the EnvironmentPort interface using Node.js os and process APIs.
 * This is the primary adapter for production use.
 *
 * @module lib/node-environment.adapter
 */

import type { EnvironmentPort, Platform } from '@overture/ports-process';
import os from 'node:os';

/**
 * Node.js implementation of EnvironmentPort
 *
 * Uses Node.js os module for environment information.
 *
 * @example
 * ```typescript
 * const environment = new NodeEnvironmentAdapter();
 *
 * // Get platform
 * const platform = environment.platform();
 * if (platform === 'win32') {
 *   console.log('Running on Windows');
 * }
 *
 * // Get home directory
 * const home = environment.homedir();
 * const configPath = `${home}/.config/overture.yml`;
 *
 * // Access environment variables
 * const token = environment.env.GITHUB_TOKEN;
 * ```
 */
export class NodeEnvironmentAdapter implements EnvironmentPort {
  /**
   * Get the current operating system platform
   *
   * @returns Platform identifier ('linux', 'darwin', or 'win32')
   *
   * @example
   * ```typescript
   * const platform = adapter.platform();
   * const separator = platform === 'win32' ? '\\' : '/';
   * ```
   */
  platform(): Platform {
    return os.platform() as Platform;
  }

  /**
   * Get the user's home directory path
   *
   * @returns Absolute path to home directory
   *
   * @example
   * ```typescript
   * const home = adapter.homedir();
   * // Linux/macOS: '/home/user' or '/Users/user'
   * // Windows: 'C:\\Users\\user'
   * ```
   */
  homedir(): string {
    return os.homedir();
  }

  /**
   * Environment variables
   *
   * Key-value pairs of environment variables.
   * Values may be undefined if the variable is not set.
   *
   * @example
   * ```typescript
   * const path = adapter.env.PATH;
   * const custom = adapter.env.MY_CUSTOM_VAR ?? 'default';
   * ```
   */
  get env(): Record<string, string | undefined> {
    return process.env;
  }
}
