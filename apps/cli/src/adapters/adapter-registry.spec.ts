import type { Mock, Mocked, MockedObject, MockedFunction, MockInstance } from 'vitest';
/**
 * Adapter Registry Tests
 *
 * @module adapters/adapter-registry.spec
 */

import { AdapterRegistry } from './adapter-registry';
import type { ClientAdapter, ConfigPathResult, ClientMcpConfig } from './client-adapter.interface';
import type { Platform, ClientName, TransportType, OvertureConfig } from '../domain/config.types';

// Mock adapter for testing
class MockAdapter implements ClientAdapter {
  constructor(
    public readonly name: ClientName,
    public readonly schemaRootKey: 'mcpServers' | 'servers' = 'mcpServers',
    private installed = true
  ) {}

  detectConfigPath(platform: Platform, projectRoot?: string): ConfigPathResult {
    if (!this.installed) return null;
    return `/mock/${this.name}/config.json`;
  }

  readConfig(path: string): ClientMcpConfig {
    return { [this.schemaRootKey]: {} };
  }

  writeConfig(path: string, config: ClientMcpConfig): void {
    // Mock implementation
  }

  convertFromOverture(overtureConfig: OvertureConfig, platform: Platform): ClientMcpConfig {
    return { [this.schemaRootKey]: {} };
  }

  supportsTransport(transport: TransportType): boolean {
    return transport === 'stdio';
  }

  needsEnvVarExpansion(): boolean {
    return false;
  }

  isInstalled(platform: Platform): boolean {
    return this.installed;
  }
}

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  describe('register', () => {
    it('should register an adapter', () => {
      const adapter = new MockAdapter('claude-code');
      registry.register(adapter);

      expect(registry.has('claude-code')).toBe(true);
      expect(registry.size).toBe(1);
    });

    it('should register multiple adapters', () => {
      const adapter1 = new MockAdapter('claude-code');
      const adapter2 = new MockAdapter('vscode');
      const adapter3 = new MockAdapter('cursor');

      registry.register(adapter1);
      registry.register(adapter2);
      registry.register(adapter3);

      expect(registry.size).toBe(3);
    });

    it('should replace adapter if registered twice', () => {
      const adapter1 = new MockAdapter('claude-code', 'mcpServers');
      const adapter2 = new MockAdapter('claude-code', 'servers');

      registry.register(adapter1);
      registry.register(adapter2);

      const retrieved = registry.get('claude-code');
      expect(retrieved?.schemaRootKey).toBe('servers');
      expect(registry.size).toBe(1);
    });
  });

  describe('get', () => {
    it('should get registered adapter', () => {
      const adapter = new MockAdapter('claude-code');
      registry.register(adapter);

      const retrieved = registry.get('claude-code');
      expect(retrieved).toBe(adapter);
    });

    it('should return undefined for unregistered adapter', () => {
      const retrieved = registry.get('claude-code');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return empty array when no adapters registered', () => {
      const adapters = registry.getAll();
      expect(adapters).toEqual([]);
    });

    it('should return all registered adapters', () => {
      const adapter1 = new MockAdapter('claude-code');
      const adapter2 = new MockAdapter('vscode');
      const adapter3 = new MockAdapter('cursor');

      registry.register(adapter1);
      registry.register(adapter2);
      registry.register(adapter3);

      const adapters = registry.getAll();
      expect(adapters).toHaveLength(3);
      expect(adapters).toContain(adapter1);
      expect(adapters).toContain(adapter2);
      expect(adapters).toContain(adapter3);
    });
  });

  describe('getAllNames', () => {
    it('should return empty array when no adapters registered', () => {
      const names = registry.getAllNames();
      expect(names).toEqual([]);
    });

    it('should return all registered client names', () => {
      registry.register(new MockAdapter('claude-code'));
      registry.register(new MockAdapter('vscode'));
      registry.register(new MockAdapter('cursor'));

      const names = registry.getAllNames();
      expect(names).toHaveLength(3);
      expect(names).toContain('claude-code');
      expect(names).toContain('vscode');
      expect(names).toContain('cursor');
    });
  });

  describe('detectInstalledClients', () => {
    it('should detect all installed clients', () => {
      registry.register(new MockAdapter('claude-code', 'mcpServers', true));
      registry.register(new MockAdapter('vscode', 'servers', true));
      registry.register(new MockAdapter('cursor', 'mcpServers', true));

      const installed = registry.detectInstalledClients('linux');
      expect(installed).toHaveLength(3);
      expect(installed).toContain('claude-code');
      expect(installed).toContain('vscode');
      expect(installed).toContain('cursor');
    });

    it('should exclude uninstalled clients', () => {
      registry.register(new MockAdapter('claude-code', 'mcpServers', true));
      registry.register(new MockAdapter('vscode', 'servers', false)); // Not installed
      registry.register(new MockAdapter('cursor', 'mcpServers', true));

      const installed = registry.detectInstalledClients('linux');
      expect(installed).toHaveLength(2);
      expect(installed).toContain('claude-code');
      expect(installed).toContain('cursor');
      expect(installed).not.toContain('vscode');
    });

    it('should return empty array when no clients installed', () => {
      registry.register(new MockAdapter('claude-code', 'mcpServers', false));
      registry.register(new MockAdapter('vscode', 'servers', false));

      const installed = registry.detectInstalledClients('linux');
      expect(installed).toEqual([]);
    });

    it('should work with default platform', () => {
      registry.register(new MockAdapter('claude-code', 'mcpServers', true));

      const installed = registry.detectInstalledClients();
      expect(installed).toContain('claude-code');
    });
  });

  describe('getInstalledAdapters', () => {
    it('should return adapters for installed clients only', () => {
      const adapter1 = new MockAdapter('claude-code', 'mcpServers', true);
      const adapter2 = new MockAdapter('vscode', 'servers', false);
      const adapter3 = new MockAdapter('cursor', 'mcpServers', true);

      registry.register(adapter1);
      registry.register(adapter2);
      registry.register(adapter3);

      const installed = registry.getInstalledAdapters('linux');
      expect(installed).toHaveLength(2);
      expect(installed).toContain(adapter1);
      expect(installed).toContain(adapter3);
      expect(installed).not.toContain(adapter2);
    });

    it('should return empty array when no clients installed', () => {
      registry.register(new MockAdapter('claude-code', 'mcpServers', false));

      const installed = registry.getInstalledAdapters('linux');
      expect(installed).toEqual([]);
    });
  });

  describe('has', () => {
    it('should return true for registered adapter', () => {
      registry.register(new MockAdapter('claude-code'));

      expect(registry.has('claude-code')).toBe(true);
    });

    it('should return false for unregistered adapter', () => {
      expect(registry.has('claude-code')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all adapters', () => {
      registry.register(new MockAdapter('claude-code'));
      registry.register(new MockAdapter('vscode'));
      registry.register(new MockAdapter('cursor'));

      expect(registry.size).toBe(3);

      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.getAll()).toEqual([]);
    });
  });

  describe('size', () => {
    it('should return 0 when empty', () => {
      expect(registry.size).toBe(0);
    });

    it('should return correct count', () => {
      registry.register(new MockAdapter('claude-code'));
      expect(registry.size).toBe(1);

      registry.register(new MockAdapter('vscode'));
      expect(registry.size).toBe(2);

      registry.register(new MockAdapter('cursor'));
      expect(registry.size).toBe(3);
    });
  });

  describe('Real-world scenario', () => {
    it('should handle typical workflow', () => {
      // Register all clients
      const claudeCode = new MockAdapter('claude-code', 'mcpServers', true);
      const vscode = new MockAdapter('vscode', 'servers', true);
      const cursor = new MockAdapter('cursor', 'mcpServers', false); // Not installed

      registry.register(claudeCode);
      registry.register(vscode);
      registry.register(cursor);

      // Check registration
      expect(registry.size).toBe(3);
      expect(registry.has('claude-code')).toBe(true);
      expect(registry.has('vscode')).toBe(true);
      expect(registry.has('cursor')).toBe(true);

      // Detect installed clients
      const installed = registry.detectInstalledClients('darwin');
      expect(installed).toEqual(['claude-code', 'vscode']);

      // Get installed adapters for sync
      const adaptersToSync = registry.getInstalledAdapters('darwin');
      expect(adaptersToSync).toHaveLength(2);
      expect(adaptersToSync.map((a) => a.name)).toEqual(['claude-code', 'vscode']);
    });
  });
});
