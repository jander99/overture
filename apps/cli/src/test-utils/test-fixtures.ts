/**
 * Test Fixtures for CLI Command Tests
 *
 * Factory functions for creating mock data structures used across test files.
 * Reduces code duplication and ensures consistency in test data.
 *
 * @module test-utils/test-fixtures
 */

import { vi } from 'vitest';
import type { ClientName, Platform } from '@overture/config-types';
import type { BackupMetadata } from '@overture/sync-core';
import type { ClientAdapter } from '@overture/client-adapters';
import { TEST_CLIENTS, TEST_PLATFORMS } from './test-constants.js';

/**
 * Discovery report structure (from discovery-core)
 */
export interface DiscoveryReport {
  environment: {
    platform: Platform;
    isWSL2: boolean;
    wsl2Info?: {
      distroName: string;
      windowsUserProfile: string;
    };
  };
  clients: ClientDetection[];
}

/**
 * Client detection result structure (from discovery-core)
 */
export interface ClientDetection {
  client: ClientName;
  detection:
    | {
        status: 'found';
        binaryPath: string;
        version: string;
        warnings: string[];
      }
    | {
        status: 'not-found';
        warnings: string[];
      }
    | {
        status: 'skipped';
        warnings: string[];
      };
  source: 'linux-native' | 'wsl2-windows' | 'wsl2-linux';
  environment: 'linux' | 'windows' | 'darwin';
}

/**
 * Create a mock discovery report with sensible defaults
 *
 * @param overrides - Partial overrides for the discovery report
 * @returns Complete discovery report
 *
 * @example
 * ```typescript
 * const report = createMockDiscoveryReport({
 *   environment: { platform: 'darwin', isWSL2: false },
 *   clients: [createFoundClient('claude-code')]
 * });
 * ```
 */
export function createMockDiscoveryReport(
  overrides?: Partial<DiscoveryReport>,
): DiscoveryReport {
  return {
    environment: {
      platform: 'linux' as const,
      isWSL2: false,
      ...overrides?.environment,
    },
    clients: overrides?.clients ?? [],
  };
}

/**
 * Create a mock "found" client detection result
 *
 * @param clientName - Name of the client
 * @param overrides - Partial overrides for the detection result
 * @returns ClientDetection with "found" status
 *
 * @example
 * ```typescript
 * const client = createFoundClient('claude-code', {
 *   detection: { version: '2.0.0' }
 * });
 * ```
 */
export function createFoundClient(
  clientName: ClientName = TEST_CLIENTS.CLAUDE_CODE,
  overrides?: Partial<ClientDetection>,
): ClientDetection {
  return {
    client: clientName,
    detection: {
      status: 'found' as const,
      binaryPath: `/usr/local/bin/${clientName}`,
      version: '1.0.0',
      warnings: [],
      ...(overrides?.detection &&
      'status' in overrides.detection &&
      overrides.detection.status === 'found'
        ? overrides.detection
        : {}),
    },
    source: TEST_PLATFORMS.LINUX_NATIVE,
    environment: TEST_PLATFORMS.LINUX,
    ...overrides,
  };
}

/**
 * Create a mock "not-found" client detection result
 *
 * @param clientName - Name of the client
 * @param overrides - Partial overrides for the detection result
 * @returns ClientDetection with "not-found" status
 *
 * @example
 * ```typescript
 * const client = createNotFoundClient('vscode');
 * ```
 */
export function createNotFoundClient(
  clientName: ClientName,
  overrides?: Partial<ClientDetection>,
): ClientDetection {
  return {
    client: clientName,
    detection: {
      status: 'not-found' as const,
      warnings: [],
      ...(overrides?.detection &&
      'status' in overrides.detection &&
      overrides.detection.status === 'not-found'
        ? overrides.detection
        : {}),
    },
    source: 'linux-native' as const,
    environment: 'linux' as const,
    ...overrides,
  };
}

/**
 * Create a mock "skipped" client detection result
 *
 * @param clientName - Name of the client
 * @param overrides - Partial overrides for the detection result
 * @returns ClientDetection with "skipped" status
 *
 * @example
 * ```typescript
 * const client = createSkippedClient('cursor');
 * ```
 */
export function createSkippedClient(
  clientName: ClientName,
  overrides?: Partial<ClientDetection>,
): ClientDetection {
  return {
    client: clientName,
    detection: {
      status: 'skipped' as const,
      warnings: [],
      ...(overrides?.detection &&
      'status' in overrides.detection &&
      overrides.detection.status === 'skipped'
        ? overrides.detection
        : {}),
    },
    source: 'linux-native' as const,
    environment: 'linux' as const,
    ...overrides,
  };
}

/**
 * Create a mock WSL2 discovery report
 *
 * @param distroName - WSL2 distribution name
 * @param windowsUserProfile - Windows user profile path
 * @param clients - Array of client detections
 * @returns DiscoveryReport with WSL2 environment
 *
 * @example
 * ```typescript
 * const report = createWSL2Report('Ubuntu-22.04', '/mnt/c/Users/TestUser', [
 *   createFoundClient('claude-code')
 * ]);
 * ```
 */
export function createWSL2Report(
  distroName = 'Ubuntu-22.04',
  windowsUserProfile = '/mnt/c/Users/TestUser',
  clients: ClientDetection[] = [],
): DiscoveryReport {
  return {
    environment: {
      platform: 'linux' as const,
      isWSL2: true,
      wsl2Info: {
        distroName,
        windowsUserProfile,
      },
    },
    clients,
  };
}

/**
 * Create a mock ClientAdapter for testing
 *
 * @param name - Adapter name
 * @param overrides - Partial overrides for adapter methods
 * @returns Mocked ClientAdapter
 *
 * @example
 * ```typescript
 * const adapter = createMockAdapter('claude-code', {
 *   readConfig: vi.fn().mockResolvedValue({ mcp: {} })
 * });
 * ```
 */
export function createMockAdapter(
  name: ClientName = TEST_CLIENTS.CLAUDE_CODE,
  overrides?: Partial<ClientAdapter>,
): ClientAdapter {
  return {
    name,
    isInstalled: vi.fn().mockReturnValue(true),
    detectConfigPath: vi
      .fn()
      .mockReturnValue(`/home/user/.config/${name}/mcp.json`),
    readConfig: vi.fn().mockResolvedValue({}),
    writeConfig: vi.fn().mockResolvedValue(undefined),
    validateTransport: vi.fn().mockReturnValue(true),
    ...overrides,
  } as unknown as ClientAdapter;
}

/**
 * Create a mock BackupMetadata for testing
 *
 * @param overrides - Partial overrides for backup metadata
 * @returns Complete backup metadata
 *
 * @example
 * ```typescript
 * const backup = createMockBackupMetadata({
 *   client: 'claude-desktop',
 *   timestamp: '2025-01-12T10-00-00-000Z'
 * });
 * ```
 */
export function createMockBackupMetadata(
  overrides?: Partial<BackupMetadata>,
): BackupMetadata {
  const client = overrides?.client ?? 'claude-code';
  const timestamp = overrides?.timestamp ?? '2025-01-11T14-30-45-123Z';

  return {
    client,
    timestamp,
    size: 1024,
    path: `/backups/${client}-${timestamp}.json`,
    ...overrides,
  };
}

/**
 * Create multiple backup metadata entries for testing
 *
 * @param count - Number of backups to create
 * @param clientName - Client name for all backups
 * @returns Array of backup metadata
 *
 * @example
 * ```typescript
 * const backups = createMockBackups(3, 'claude-code');
 * // Creates 3 backups with different timestamps
 * ```
 */
export function createMockBackups(
  count: number,
  clientName: ClientName = 'claude-code',
): BackupMetadata[] {
  return Array.from({ length: count }, (_, i) => {
    const timestamp = `2025-01-11T${String(14 + i).padStart(2, '0')}-00-00-000Z`;
    return createMockBackupMetadata({
      client: clientName,
      timestamp,
      size: 1024 * (i + 1),
    });
  });
}
