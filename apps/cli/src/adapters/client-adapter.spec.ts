/**
 * Client Adapter Base Tests
 *
 * Tests for BaseClientAdapter helper methods and common functionality.
 *
 * @module adapters/client-adapter.spec
 */

import { BaseClientAdapter, type ConfigPathResult, type ClientMcpConfig } from './client-adapter.interface';
import type { Platform, ClientName, TransportType, OvertureConfigV2 } from '../domain/config-v2.types';

// Test implementation of BaseClientAdapter
class TestAdapter extends BaseClientAdapter {
  readonly name: ClientName = 'claude-code';
  readonly schemaRootKey: 'mcpServers' | 'servers' = 'mcpServers';

  private supportedTransports: TransportType[] = ['stdio', 'http'];

  detectConfigPath(platform: Platform, projectRoot?: string): ConfigPathResult {
    return '/test/config.json';
  }

  readConfig(path: string): ClientMcpConfig {
    return { mcpServers: {} };
  }

  writeConfig(path: string, config: ClientMcpConfig): void {
    // Mock implementation
  }

  convertFromOverture(overtureConfig: OvertureConfigV2, platform: Platform): ClientMcpConfig {
    return { mcpServers: {} };
  }

  supportsTransport(transport: TransportType): boolean {
    return this.supportedTransports.includes(transport);
  }

  needsEnvVarExpansion(): boolean {
    return false;
  }

  // Expose protected method for testing
  public testShouldSyncMcp(mcpConfig: OvertureConfigV2['mcp'][string], platform: Platform): boolean {
    return this.shouldSyncMcp(mcpConfig, platform);
  }
}

describe('BaseClientAdapter', () => {
  let adapter: TestAdapter;

  beforeEach(() => {
    adapter = new TestAdapter();
  });

  describe('isInstalled', () => {
    it('should return true when detectConfigPath returns a path', () => {
      expect(adapter.isInstalled('linux')).toBe(true);
    });

    it('should return false when detectConfigPath returns null', () => {
      // Override detectConfigPath to return null
      adapter.detectConfigPath = () => null;

      expect(adapter.isInstalled('linux')).toBe(false);
    });
  });

  describe('shouldSyncMcp', () => {
    const baseMcpConfig: OvertureConfigV2['mcp'][string] = {
      command: 'test-server',
      args: [],
      env: {},
      transport: 'stdio',
      scope: 'global',
    };

    it('should return true for basic config', () => {
      const result = adapter.testShouldSyncMcp(baseMcpConfig, 'linux');
      expect(result).toBe(true);
    });

    it('should return false when platform is excluded', () => {
      const config = {
        ...baseMcpConfig,
        platforms: {
          exclude: ['linux' as Platform],
        },
      };

      const result = adapter.testShouldSyncMcp(config, 'linux');
      expect(result).toBe(false);
    });

    it('should return true when different platform is excluded', () => {
      const config = {
        ...baseMcpConfig,
        platforms: {
          exclude: ['win32' as Platform],
        },
      };

      const result = adapter.testShouldSyncMcp(config, 'linux');
      expect(result).toBe(true);
    });

    it('should return false when client is excluded', () => {
      const config = {
        ...baseMcpConfig,
        clients: {
          exclude: ['claude-code' as ClientName],
        },
      };

      const result = adapter.testShouldSyncMcp(config, 'linux');
      expect(result).toBe(false);
    });

    it('should return true when different client is excluded', () => {
      const config = {
        ...baseMcpConfig,
        clients: {
          exclude: ['vscode' as ClientName],
        },
      };

      const result = adapter.testShouldSyncMcp(config, 'linux');
      expect(result).toBe(true);
    });

    it('should return true when client is in include list', () => {
      const config = {
        ...baseMcpConfig,
        clients: {
          include: ['claude-code' as ClientName, 'vscode' as ClientName],
        },
      };

      const result = adapter.testShouldSyncMcp(config, 'linux');
      expect(result).toBe(true);
    });

    it('should return false when client is not in include list', () => {
      const config = {
        ...baseMcpConfig,
        clients: {
          include: ['vscode' as ClientName, 'cursor' as ClientName],
        },
      };

      const result = adapter.testShouldSyncMcp(config, 'linux');
      expect(result).toBe(false);
    });

    it('should return false when transport is not supported', () => {
      const config = {
        ...baseMcpConfig,
        transport: 'sse' as TransportType, // Not supported by TestAdapter
      };

      const result = adapter.testShouldSyncMcp(config, 'linux');
      expect(result).toBe(false);
    });

    it('should return true when transport is supported', () => {
      const config = {
        ...baseMcpConfig,
        transport: 'http' as TransportType, // Supported by TestAdapter
      };

      const result = adapter.testShouldSyncMcp(config, 'linux');
      expect(result).toBe(true);
    });

    it('should handle multiple exclusion rules', () => {
      const config = {
        ...baseMcpConfig,
        clients: {
          exclude: ['vscode' as ClientName],
        },
        platforms: {
          exclude: ['win32' as Platform],
        },
      };

      // Should pass - different client and platform
      const result1 = adapter.testShouldSyncMcp(config, 'linux');
      expect(result1).toBe(true);

      // Should fail - excluded platform
      const result2 = adapter.testShouldSyncMcp(config, 'win32');
      expect(result2).toBe(false);
    });

    it('should prioritize include over no exclusions', () => {
      const config = {
        ...baseMcpConfig,
        clients: {
          include: ['vscode' as ClientName],
        },
      };

      // Should fail - not in include list
      const result = adapter.testShouldSyncMcp(config, 'linux');
      expect(result).toBe(false);
    });

    it('should handle all exclusion reasons', () => {
      const config1 = {
        ...baseMcpConfig,
        platforms: { exclude: ['linux' as Platform] },
      };
      expect(adapter.testShouldSyncMcp(config1, 'linux')).toBe(false);

      const config2 = {
        ...baseMcpConfig,
        clients: { exclude: ['claude-code' as ClientName] },
      };
      expect(adapter.testShouldSyncMcp(config2, 'linux')).toBe(false);

      const config3 = {
        ...baseMcpConfig,
        clients: { include: ['vscode' as ClientName] },
      };
      expect(adapter.testShouldSyncMcp(config3, 'linux')).toBe(false);

      const config4 = {
        ...baseMcpConfig,
        transport: 'sse' as TransportType,
      };
      expect(adapter.testShouldSyncMcp(config4, 'linux')).toBe(false);
    });

    it('should pass all checks for valid config', () => {
      const config = {
        ...baseMcpConfig,
        transport: 'stdio' as TransportType,
        clients: {
          include: ['claude-code' as ClientName, 'cursor' as ClientName],
        },
        platforms: {
          exclude: ['win32' as Platform],
        },
      };

      const result = adapter.testShouldSyncMcp(config, 'linux');
      expect(result).toBe(true);
    });
  });

  describe('Real-world scenarios', () => {
    it('should correctly filter GitHub MCP for Copilot CLI', () => {
      const githubMcp: OvertureConfigV2['mcp'][string] = {
        command: 'mcp-server-github',
        args: [],
        env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
        transport: 'stdio',
        scope: 'global',
        clients: {
          exclude: ['copilot-cli'], // Copilot CLI bundles GitHub MCP
        },
      };

      // Should sync to claude-code
      expect(adapter.testShouldSyncMcp(githubMcp, 'linux')).toBe(true);

      // Should NOT sync to copilot-cli (if adapter name was copilot-cli)
      adapter.name = 'copilot-cli';
      expect(adapter.testShouldSyncMcp(githubMcp, 'linux')).toBe(false);
    });

    it('should respect platform-specific MCP (e.g., WSL-only)', () => {
      const wslMcp: OvertureConfigV2['mcp'][string] = {
        command: 'wsl-tool',
        args: [],
        env: {},
        transport: 'stdio',
        scope: 'global',
        platforms: {
          exclude: ['darwin', 'win32'],
        },
      };

      // Should sync on Linux only
      expect(adapter.testShouldSyncMcp(wslMcp, 'linux')).toBe(true);
      expect(adapter.testShouldSyncMcp(wslMcp, 'darwin')).toBe(false);
      expect(adapter.testShouldSyncMcp(wslMcp, 'win32')).toBe(false);
    });

    it('should handle HTTP-only MCP for clients that support it', () => {
      const httpMcp: OvertureConfigV2['mcp'][string] = {
        command: 'http-server',
        args: [],
        env: {},
        transport: 'http',
        scope: 'global',
      };

      // TestAdapter supports HTTP
      expect(adapter.testShouldSyncMcp(httpMcp, 'linux')).toBe(true);

      // Simulate adapter that doesn't support HTTP
      adapter.supportsTransport = (transport) => transport === 'stdio';
      expect(adapter.testShouldSyncMcp(httpMcp, 'linux')).toBe(false);
    });
  });
});
