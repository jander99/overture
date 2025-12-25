/**
 * Platform Mock Utilities
 *
 * Factory functions for creating OS/platform mocks.
 * Used for testing platform-specific behavior.
 *
 * @module lib/mocks/platform.mock
 */

import type { Mocked } from 'vitest';
import type * as os from 'os';

/**
 * Platform type
 */
export type Platform = 'linux' | 'darwin' | 'win32';

/**
 * Mock platform configuration
 */
export interface MockPlatformConfig {
  /**
   * Platform type
   */
  platform: Platform;

  /**
   * Home directory path
   */
  homedir: string;

  /**
   * Temporary directory path
   */
  tmpdir?: string;

  /**
   * Hostname
   */
  hostname?: string;
}

/**
 * Create a mock platform configuration for Linux
 *
 * @param homedir - Home directory path (default: '/home/testuser')
 * @returns MockPlatformConfig
 *
 * @example
 * ```typescript
 * const linux = createLinuxPlatform('/home/john');
 * ```
 */
export function createLinuxPlatform(
  homedir = '/home/testuser',
): MockPlatformConfig {
  return {
    platform: 'linux',
    homedir,
    tmpdir: '/tmp',
    hostname: 'test-linux',
  };
}

/**
 * Create a mock platform configuration for macOS
 *
 * @param homedir - Home directory path (default: '/Users/testuser')
 * @returns MockPlatformConfig
 *
 * @example
 * ```typescript
 * const macos = createMacOSPlatform('/Users/john');
 * ```
 */
export function createMacOSPlatform(
  homedir = '/Users/testuser',
): MockPlatformConfig {
  return {
    platform: 'darwin',
    homedir,
    tmpdir: '/tmp',
    hostname: 'test-macos',
  };
}

/**
 * Create a mock platform configuration for Windows
 *
 * @param homedir - Home directory path (default: 'C:\\Users\\testuser')
 * @returns MockPlatformConfig
 *
 * @example
 * ```typescript
 * const windows = createWindowsPlatform('C:\\Users\\john');
 * ```
 */
export function createWindowsPlatform(
  homedir = 'C:\\Users\\testuser',
): MockPlatformConfig {
  return {
    platform: 'win32',
    homedir,
    tmpdir: 'C:\\Temp',
    hostname: 'test-windows',
  };
}

/**
 * Create a mock platform configuration for WSL2
 *
 * Linux platform with Windows-style paths accessible
 *
 * @param homedir - Home directory path (default: '/home/testuser')
 * @returns MockPlatformConfig
 *
 * @example
 * ```typescript
 * const wsl = createWSL2Platform('/home/john');
 * ```
 */
export function createWSL2Platform(
  homedir = '/home/testuser',
): MockPlatformConfig {
  return {
    platform: 'linux',
    homedir,
    tmpdir: '/tmp',
    hostname: 'test-wsl2',
  };
}

/**
 * Configure os module mock based on platform config
 *
 * @param platformConfig - The mock platform configuration
 * @param osMock - The mocked os module
 *
 * @example
 * ```typescript
 * vi.mock('os');
 * const platform = createLinuxPlatform('/home/testuser');
 * configureMockOs(platform, os as Mocked<typeof os>);
 * ```
 */
export function configureMockOs(
  platformConfig: MockPlatformConfig,
  osMock: Mocked<typeof os>,
): void {
  osMock.platform.mockReturnValue(platformConfig.platform as NodeJS.Platform);
  osMock.homedir.mockReturnValue(platformConfig.homedir);

  if (platformConfig.tmpdir) {
    osMock.tmpdir.mockReturnValue(platformConfig.tmpdir);
  }

  if (platformConfig.hostname) {
    osMock.hostname.mockReturnValue(platformConfig.hostname);
  }
}

/**
 * Create and configure a Linux platform mock
 *
 * @param osMock - The mocked os module
 * @param homedir - Home directory path (default: '/home/testuser')
 *
 * @example
 * ```typescript
 * vi.mock('os');
 * mockLinuxPlatform(os as Mocked<typeof os>, '/home/john');
 * ```
 */
export function mockLinuxPlatform(
  osMock: Mocked<typeof os>,
  homedir = '/home/testuser',
): void {
  const config = createLinuxPlatform(homedir);
  configureMockOs(config, osMock);
}

/**
 * Create and configure a macOS platform mock
 *
 * @param osMock - The mocked os module
 * @param homedir - Home directory path (default: '/Users/testuser')
 *
 * @example
 * ```typescript
 * vi.mock('os');
 * mockMacOSPlatform(os as Mocked<typeof os>, '/Users/john');
 * ```
 */
export function mockMacOSPlatform(
  osMock: Mocked<typeof os>,
  homedir = '/Users/testuser',
): void {
  const config = createMacOSPlatform(homedir);
  configureMockOs(config, osMock);
}

/**
 * Create and configure a Windows platform mock
 *
 * @param osMock - The mocked os module
 * @param homedir - Home directory path (default: 'C:\\Users\\testuser')
 *
 * @example
 * ```typescript
 * vi.mock('os');
 * mockWindowsPlatform(os as Mocked<typeof os>, 'C:\\Users\\john');
 * ```
 */
export function mockWindowsPlatform(
  osMock: Mocked<typeof os>,
  homedir = 'C:\\Users\\testuser',
): void {
  const config = createWindowsPlatform(homedir);
  configureMockOs(config, osMock);
}

/**
 * Create and configure a WSL2 platform mock
 *
 * @param osMock - The mocked os module
 * @param homedir - Home directory path (default: '/home/testuser')
 *
 * @example
 * ```typescript
 * vi.mock('os');
 * mockWSL2Platform(os as Mocked<typeof os>, '/home/john');
 * ```
 */
export function mockWSL2Platform(
  osMock: Mocked<typeof os>,
  homedir = '/home/testuser',
): void {
  const config = createWSL2Platform(homedir);
  configureMockOs(config, osMock);
}
