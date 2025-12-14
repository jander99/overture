/**
 * Environment Port
 *
 * Hexagonal architecture port for environment information.
 * Abstracts OS platform, home directory, and environment variables from infrastructure.
 *
 * @module lib/environment.port
 */

/**
 * Operating system platform
 */
export type Platform = 'linux' | 'darwin' | 'win32';

/**
 * Port interface for environment information
 *
 * Provides abstraction for accessing OS-level information like platform,
 * home directory, and environment variables.
 *
 * @example
 * ```typescript
 * // Get platform information
 * const platform = environmentPort.platform();
 * if (platform === 'win32') {
 *   console.log('Running on Windows');
 * }
 *
 * // Get home directory
 * const home = environmentPort.homedir();
 * const configPath = `${home}/.config/overture.yml`;
 *
 * // Access environment variables
 * const token = environmentPort.env.GITHUB_TOKEN;
 * ```
 */
export interface EnvironmentPort {
  /**
   * Get the current operating system platform
   *
   * @returns Platform identifier ('linux', 'darwin', or 'win32')
   *
   * @example
   * ```typescript
   * const platform = environmentPort.platform();
   * const separator = platform === 'win32' ? '\\' : '/';
   * ```
   */
  platform(): Platform;

  /**
   * Get the user's home directory path
   *
   * @returns Absolute path to home directory
   *
   * @example
   * ```typescript
   * const home = environmentPort.homedir();
   * // Linux/macOS: '/home/user' or '/Users/user'
   * // Windows: 'C:\\Users\\user'
   * ```
   */
  homedir(): string;

  /**
   * Environment variables
   *
   * Key-value pairs of environment variables.
   * Values may be undefined if the variable is not set.
   *
   * @example
   * ```typescript
   * const path = environmentPort.env.PATH;
   * const custom = environmentPort.env.MY_CUSTOM_VAR ?? 'default';
   * ```
   */
  env: Record<string, string | undefined>;
}
