/**
 * Client Adapter Mock Utilities
 *
 * Factory functions for creating client adapter mocks.
 * Used for testing client integration without actual filesystem operations.
 *
 * @module lib/mocks/adapter.mock
 */

/**
 * Mock client adapter for testing
 */
export interface MockClientAdapter {
  /**
   * Client name
   */
  name: string;

  /**
   * Whether adapter is enabled
   */
  enabled: boolean;

  /**
   * Mock detection result
   */
  isDetected: boolean;

  /**
   * Mock configuration path
   */
  configPath?: string;

  /**
   * Mock configuration object
   */
  config?: Record<string, any>;

  /**
   * History of write operations
   */
  writeHistory: Array<{ config: Record<string, any> }>;

  /**
   * Detect if client is available
   */
  detect: () => Promise<boolean>;

  /**
   * Read client configuration
   */
  readConfig: () => Promise<Record<string, any>>;

  /**
   * Write client configuration
   */
  writeConfig: (config: Record<string, any>) => Promise<void>;

  /**
   * Backup client configuration
   */
  backup: () => Promise<void>;
}

/**
 * Create a mock client adapter
 *
 * @param name - Client name (default: 'test-client')
 * @param options - Configuration options
 * @returns MockClientAdapter
 *
 * @example
 * ```typescript
 * const mockAdapter = createMockAdapter('claude-code', {
 *   enabled: true,
 *   isDetected: true,
 *   config: { mcpServers: {} }
 * });
 *
 * const detected = await mockAdapter.detect(); // true
 * const config = await mockAdapter.readConfig(); // { mcpServers: {} }
 * ```
 */
export function createMockAdapter(
  name = 'test-client',
  options: {
    enabled?: boolean;
    isDetected?: boolean;
    configPath?: string;
    config?: Record<string, any>;
  } = {}
): MockClientAdapter {
  const adapter: MockClientAdapter = {
    name,
    enabled: options.enabled ?? true,
    isDetected: options.isDetected ?? true,
    configPath: options.configPath,
    config: options.config ?? {},
    writeHistory: [],

    detect: async () => adapter.isDetected,

    readConfig: async () => {
      if (!adapter.config) {
        throw new Error(`No configuration found for ${name}`);
      }
      return adapter.config;
    },

    writeConfig: async (config: Record<string, any>) => {
      adapter.config = config;
      adapter.writeHistory.push({ config });
    },

    backup: async () => {
      // Mock backup operation
    },
  };

  return adapter;
}

/**
 * Create a detected adapter with valid configuration
 *
 * @param name - Client name
 * @param config - Initial configuration
 * @returns MockClientAdapter
 *
 * @example
 * ```typescript
 * const adapter = createDetectedAdapter('claude-code', {
 *   mcpServers: {
 *     github: { command: 'mcp-server-github' }
 *   }
 * });
 * ```
 */
export function createDetectedAdapter(
  name: string,
  config: Record<string, any> = {}
): MockClientAdapter {
  return createMockAdapter(name, {
    enabled: true,
    isDetected: true,
    configPath: `/mock/${name}/config.json`,
    config,
  });
}

/**
 * Create an undetected adapter (client not installed)
 *
 * @param name - Client name
 * @returns MockClientAdapter
 *
 * @example
 * ```typescript
 * const adapter = createUndetectedAdapter('cursor');
 * const detected = await adapter.detect(); // false
 * ```
 */
export function createUndetectedAdapter(name: string): MockClientAdapter {
  return createMockAdapter(name, {
    enabled: true,
    isDetected: false,
    configPath: undefined,
    config: undefined,
  });
}

/**
 * Create a disabled adapter
 *
 * @param name - Client name
 * @returns MockClientAdapter
 *
 * @example
 * ```typescript
 * const adapter = createDisabledAdapter('windsurf');
 * ```
 */
export function createDisabledAdapter(name: string): MockClientAdapter {
  return createMockAdapter(name, {
    enabled: false,
    isDetected: true,
  });
}

/**
 * Reset an adapter's write history
 *
 * @param adapter - The mock adapter to reset
 *
 * @example
 * ```typescript
 * const adapter = createMockAdapter();
 * // ... perform writes ...
 * resetAdapterHistory(adapter);
 * // adapter.writeHistory is now empty
 * ```
 */
export function resetAdapterHistory(adapter: MockClientAdapter): void {
  adapter.writeHistory = [];
}

/**
 * Get the last written configuration from an adapter
 *
 * @param adapter - The mock adapter
 * @returns The last written configuration, or undefined if none
 *
 * @example
 * ```typescript
 * const adapter = createMockAdapter();
 * await adapter.writeConfig({ mcpServers: {} });
 * const lastConfig = getLastWrittenConfig(adapter);
 * // Returns: { mcpServers: {} }
 * ```
 */
export function getLastWrittenConfig(
  adapter: MockClientAdapter
): Record<string, any> | undefined {
  if (adapter.writeHistory.length === 0) {
    return undefined;
  }
  return adapter.writeHistory[adapter.writeHistory.length - 1].config;
}
