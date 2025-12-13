import type { Mock, Mocked, MockedObject, MockedFunction, MockInstance } from 'vitest';
/**
 * Audit Command Tests
 *
 * Tests for the audit command that detects unmanaged MCPs in client configs.
 *
 * @module cli/commands/audit.spec
 */

import { Command } from 'commander';
import { createAuditCommand } from './audit';
import { AuditService } from '../../core/audit-service';
import { loadConfig } from '../../core/config-loader';
import { adapterRegistry } from '../../adapters/adapter-registry';
import { Logger } from '../../utils/logger';
import { getPlatform } from '../../core/path-resolver';
import type { ClientAdapter } from '../../adapters/client-adapter.interface';
import type { OvertureConfig } from '../../domain/config.types';

// Create mock instance using vi.hoisted for proper hoisting
const { auditServiceMock, MockAuditService } = vi.hoisted(() => {
  const mockInstance = {
    auditClient: vi.fn(),
    auditAllClients: vi.fn(),
    compareConfigs: vi.fn(),
    generateSuggestions: vi.fn(),
  };
  return {
    auditServiceMock: mockInstance,
    MockAuditService: function AuditService() {
      return mockInstance;
    },
  };
});

// Mock dependencies
vi.mock('../../core/audit-service', () => ({
  AuditService: MockAuditService,
}));
vi.mock('../../core/config-loader');
vi.mock('../../adapters/adapter-registry');
vi.mock('../../utils/logger');
vi.mock('../../core/path-resolver');

describe('CLI Command: audit', () => {
  let command: Command;
  let mockExit: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    command = createAuditCommand();

    // Mock process.exit to prevent test termination
    mockExit = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit: ${code}`);
    });

    (getPlatform as Mock).mockReturnValue('linux');
  });

  afterEach(() => {
    mockExit.mockRestore();
  });

  describe('Successful audit', () => {
    it('should audit all installed clients when no --client flag', async () => {
      // Arrange
      const mockConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          github: {
            command: 'mcp-server-github',
            args: [],
            env: {},
            transport: 'stdio',
          },
        },
      };

      const mockAdapter1: ClientAdapter = {
        name: 'claude-code',
        schemaRootKey: 'mcpServers',
        detectConfigPath: vi.fn(),
        readConfig: vi.fn(),
        writeConfig: vi.fn(),
        convertFromOverture: vi.fn(),
        supportsTransport: vi.fn(),
        needsEnvVarExpansion: vi.fn(),
        isInstalled: vi.fn(),
      };

      const mockAdapter2: ClientAdapter = {
        name: 'vscode',
        schemaRootKey: 'servers',
        detectConfigPath: vi.fn(),
        readConfig: vi.fn(),
        writeConfig: vi.fn(),
        convertFromOverture: vi.fn(),
        supportsTransport: vi.fn(),
        needsEnvVarExpansion: vi.fn(),
        isInstalled: vi.fn(),
      };

      const unmanagedByClient = {
        'claude-code': ['filesystem', 'slack'],
        vscode: ['github-alt'],
      };

      const suggestions = [
        'overture user add mcp filesystem',
        'overture user add mcp github-alt',
        'overture user add mcp slack',
      ];

      (loadConfig as Mock).mockReturnValue(mockConfig);
      (adapterRegistry.getInstalledAdapters as Mock).mockReturnValue([mockAdapter1, mockAdapter2]);
      auditServiceMock.auditAllClients.mockReturnValue(unmanagedByClient);
      auditServiceMock.generateSuggestions.mockReturnValue(suggestions);

      // Act
      await command.parseAsync(['node', 'overture']);

      // Assert
      expect(loadConfig).toHaveBeenCalled();
      expect(adapterRegistry.getInstalledAdapters).toHaveBeenCalledWith('linux');
      expect(auditServiceMock.auditAllClients).toHaveBeenCalledWith([mockAdapter1, mockAdapter2], mockConfig, 'linux');
      expect(auditServiceMock.generateSuggestions).toHaveBeenCalledWith(unmanagedByClient);
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('claude-code'));
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('filesystem'));
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('slack'));
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('vscode'));
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('github-alt'));
    });

    it('should audit specific client when --client flag provided', async () => {
      // Arrange
      const mockConfig: OvertureConfig = {
        version: '2.0',
        mcp: {},
      };

      const mockAdapter: ClientAdapter = {
        name: 'claude-code',
        schemaRootKey: 'mcpServers',
        detectConfigPath: vi.fn(),
        readConfig: vi.fn(),
        writeConfig: vi.fn(),
        convertFromOverture: vi.fn(),
        supportsTransport: vi.fn(),
        needsEnvVarExpansion: vi.fn(),
        isInstalled: vi.fn().mockReturnValue(true),
      };

      const unmanaged = ['filesystem', 'slack'];

      (loadConfig as Mock).mockReturnValue(mockConfig);
      (adapterRegistry.get as Mock).mockReturnValue(mockAdapter);
      auditServiceMock.auditClient.mockReturnValue(unmanaged);
      auditServiceMock.generateSuggestions.mockReturnValue([
        'overture user add mcp filesystem',
        'overture user add mcp slack',
      ]);

      // Act
      await command.parseAsync(['node', 'overture', '--client', 'claude-code']);

      // Assert
      expect(adapterRegistry.get).toHaveBeenCalledWith('claude-code');
      expect(auditServiceMock.auditClient).toHaveBeenCalledWith(mockAdapter, mockConfig, 'linux');
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('claude-code'));
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('filesystem'));
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('slack'));
    });

    it('should report when no unmanaged MCPs found', async () => {
      // Arrange
      const mockConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          github: {
            command: 'mcp-server-github',
            args: [],
            env: {},
            transport: 'stdio',
          },
        },
      };

      const mockAdapter: ClientAdapter = {
        name: 'claude-code',
        schemaRootKey: 'mcpServers',
        detectConfigPath: vi.fn(),
        readConfig: vi.fn(),
        writeConfig: vi.fn(),
        convertFromOverture: vi.fn(),
        supportsTransport: vi.fn(),
        needsEnvVarExpansion: vi.fn(),
        isInstalled: vi.fn(),
      };

      (loadConfig as Mock).mockReturnValue(mockConfig);
      (adapterRegistry.getInstalledAdapters as Mock).mockReturnValue([mockAdapter]);
      auditServiceMock.auditAllClients.mockReturnValue({});

      // Act
      await command.parseAsync(['node', 'overture']);

      // Assert
      expect(Logger.success).toHaveBeenCalledWith(expect.stringContaining('No unmanaged'));
    });

    it('should display suggestions section', async () => {
      // Arrange
      const mockConfig: OvertureConfig = {
        version: '2.0',
        mcp: {},
      };

      const mockAdapter: ClientAdapter = {
        name: 'claude-code',
        schemaRootKey: 'mcpServers',
        detectConfigPath: vi.fn(),
        readConfig: vi.fn(),
        writeConfig: vi.fn(),
        convertFromOverture: vi.fn(),
        supportsTransport: vi.fn(),
        needsEnvVarExpansion: vi.fn(),
        isInstalled: vi.fn(),
      };

      const unmanagedByClient = {
        'claude-code': ['filesystem'],
      };

      const suggestions = ['overture user add mcp filesystem'];

      (loadConfig as Mock).mockReturnValue(mockConfig);
      (adapterRegistry.getInstalledAdapters as Mock).mockReturnValue([mockAdapter]);
      auditServiceMock.auditAllClients.mockReturnValue(unmanagedByClient);
      auditServiceMock.generateSuggestions.mockReturnValue(suggestions);

      // Act
      await command.parseAsync(['node', 'overture']);

      // Assert
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('Suggestions'));
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('overture user add mcp filesystem'));
    });
  });

  describe('Error handling', () => {
    it('should error when --client flag references unknown client', async () => {
      // Arrange
      (adapterRegistry.get as Mock).mockReturnValue(undefined);

      // Act & Assert
      await expect(async () => {
        await command.parseAsync(['node', 'overture', '--client', 'unknown-client']);
      }).rejects.toThrow('process.exit: 1');

      expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('unknown-client'));
    });

    it('should error when config cannot be loaded', async () => {
      // Arrange
      (loadConfig as Mock).mockImplementation(() => {
        throw new Error('Config not found');
      });

      // Act & Assert
      await expect(async () => {
        await command.parseAsync(['node', 'overture']);
      }).rejects.toThrow('process.exit: 1');

      expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('Config not found'));
    });

    it('should error when no installed clients found', async () => {
      // Arrange
      const mockConfig: OvertureConfig = {
        version: '2.0',
        mcp: {},
      };

      (loadConfig as Mock).mockReturnValue(mockConfig);
      (adapterRegistry.getInstalledAdapters as Mock).mockReturnValue([]);

      // Act - should complete without throwing
      await command.parseAsync(['node', 'overture']);

      // Assert
      expect(Logger.warn).toHaveBeenCalledWith(expect.stringContaining('No installed'));
      expect(Logger.success).toHaveBeenCalledWith(expect.stringContaining('No unmanaged'));
    });

    it('should handle audit service errors gracefully', async () => {
      // Arrange
      const mockConfig: OvertureConfig = {
        version: '2.0',
        mcp: {},
      };

      const mockAdapter: ClientAdapter = {
        name: 'claude-code',
        schemaRootKey: 'mcpServers',
        detectConfigPath: vi.fn(),
        readConfig: vi.fn(),
        writeConfig: vi.fn(),
        convertFromOverture: vi.fn(),
        supportsTransport: vi.fn(),
        needsEnvVarExpansion: vi.fn(),
        isInstalled: vi.fn(),
      };

      (loadConfig as Mock).mockReturnValue(mockConfig);
      (adapterRegistry.getInstalledAdapters as Mock).mockReturnValue([mockAdapter]);
      auditServiceMock.auditAllClients.mockImplementation(() => {
        throw new Error('Audit failed');
      });

      // Act & Assert
      await expect(async () => {
        await command.parseAsync(['node', 'overture']);
      }).rejects.toThrow('process.exit: 1');

      expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('Audit failed'));
    });
  });

  describe('Client filtering', () => {
    it('should only audit installed clients', async () => {
      // Arrange
      const mockConfig: OvertureConfig = {
        version: '2.0',
        mcp: {},
      };

      const mockAdapter1: ClientAdapter = {
        name: 'claude-code',
        schemaRootKey: 'mcpServers',
        detectConfigPath: vi.fn(),
        readConfig: vi.fn(),
        writeConfig: vi.fn(),
        convertFromOverture: vi.fn(),
        supportsTransport: vi.fn(),
        needsEnvVarExpansion: vi.fn(),
        isInstalled: vi.fn(),
      };

      (loadConfig as Mock).mockReturnValue(mockConfig);
      (adapterRegistry.getInstalledAdapters as Mock).mockReturnValue([mockAdapter1]);
      auditServiceMock.auditAllClients.mockReturnValue({});

      // Act
      await command.parseAsync(['node', 'overture']);

      // Assert
      expect(adapterRegistry.getInstalledAdapters).toHaveBeenCalledWith('linux');
      expect(auditServiceMock.auditAllClients).toHaveBeenCalledWith([mockAdapter1], mockConfig, 'linux');
    });

    it('should verify specific client is installed before auditing', async () => {
      // Arrange
      const mockConfig: OvertureConfig = {
        version: '2.0',
        mcp: {},
      };

      const mockAdapter: ClientAdapter = {
        name: 'claude-code',
        schemaRootKey: 'mcpServers',
        detectConfigPath: vi.fn().mockReturnValue(null), // Not installed
        readConfig: vi.fn(),
        writeConfig: vi.fn(),
        convertFromOverture: vi.fn(),
        supportsTransport: vi.fn(),
        needsEnvVarExpansion: vi.fn(),
        isInstalled: vi.fn().mockReturnValue(false),
      };

      (loadConfig as Mock).mockReturnValue(mockConfig);
      (adapterRegistry.get as Mock).mockReturnValue(mockAdapter);

      // Act - should complete without throwing
      await command.parseAsync(['node', 'overture', '--client', 'claude-code']);

      // Assert
      expect(Logger.warn).toHaveBeenCalledWith(expect.stringContaining('not installed'));
      expect(Logger.success).toHaveBeenCalledWith(expect.stringContaining('No unmanaged'));
    });
  });
});
