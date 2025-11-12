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
import type { OvertureConfigV2 } from '../../domain/config-v2.types';

// Mock dependencies
jest.mock('../../core/audit-service');
jest.mock('../../core/config-loader');
jest.mock('../../adapters/adapter-registry');
jest.mock('../../utils/logger');
jest.mock('../../core/path-resolver');

describe('CLI Command: audit', () => {
  let command: Command;
  let mockExit: jest.SpyInstance;
  let auditServiceMock: jest.Mocked<AuditService>;

  beforeEach(() => {
    jest.clearAllMocks();
    command = createAuditCommand();

    // Mock process.exit to prevent test termination
    mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit: ${code}`);
    });

    // Create mock audit service
    auditServiceMock = {
      auditClient: jest.fn(),
      auditAllClients: jest.fn(),
      compareConfigs: jest.fn(),
      generateSuggestions: jest.fn(),
    } as any;

    (AuditService as jest.Mock).mockImplementation(() => auditServiceMock);
    (getPlatform as jest.Mock).mockReturnValue('linux');
  });

  afterEach(() => {
    mockExit.mockRestore();
  });

  describe('Successful audit', () => {
    it('should audit all installed clients when no --client flag', async () => {
      // Arrange
      const mockConfig: OvertureConfigV2 = {
        version: '2.0',
        mcp: {
          github: {
            command: 'mcp-server-github',
            args: [],
            env: {},
            transport: 'stdio',
            scope: 'global',
          },
        },
      };

      const mockAdapter1: ClientAdapter = {
        name: 'claude-code',
        schemaRootKey: 'mcpServers',
        detectConfigPath: jest.fn(),
        readConfig: jest.fn(),
        writeConfig: jest.fn(),
        convertFromOverture: jest.fn(),
        supportsTransport: jest.fn(),
        needsEnvVarExpansion: jest.fn(),
        isInstalled: jest.fn(),
      };

      const mockAdapter2: ClientAdapter = {
        name: 'vscode',
        schemaRootKey: 'servers',
        detectConfigPath: jest.fn(),
        readConfig: jest.fn(),
        writeConfig: jest.fn(),
        convertFromOverture: jest.fn(),
        supportsTransport: jest.fn(),
        needsEnvVarExpansion: jest.fn(),
        isInstalled: jest.fn(),
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

      (loadConfig as jest.Mock).mockReturnValue(mockConfig);
      (adapterRegistry.getInstalledAdapters as jest.Mock).mockReturnValue([mockAdapter1, mockAdapter2]);
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
      const mockConfig: OvertureConfigV2 = {
        version: '2.0',
        mcp: {},
      };

      const mockAdapter: ClientAdapter = {
        name: 'claude-code',
        schemaRootKey: 'mcpServers',
        detectConfigPath: jest.fn(),
        readConfig: jest.fn(),
        writeConfig: jest.fn(),
        convertFromOverture: jest.fn(),
        supportsTransport: jest.fn(),
        needsEnvVarExpansion: jest.fn(),
        isInstalled: jest.fn().mockReturnValue(true),
      };

      const unmanaged = ['filesystem', 'slack'];

      (loadConfig as jest.Mock).mockReturnValue(mockConfig);
      (adapterRegistry.get as jest.Mock).mockReturnValue(mockAdapter);
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
      const mockConfig: OvertureConfigV2 = {
        version: '2.0',
        mcp: {
          github: {
            command: 'mcp-server-github',
            args: [],
            env: {},
            transport: 'stdio',
            scope: 'global',
          },
        },
      };

      const mockAdapter: ClientAdapter = {
        name: 'claude-code',
        schemaRootKey: 'mcpServers',
        detectConfigPath: jest.fn(),
        readConfig: jest.fn(),
        writeConfig: jest.fn(),
        convertFromOverture: jest.fn(),
        supportsTransport: jest.fn(),
        needsEnvVarExpansion: jest.fn(),
        isInstalled: jest.fn(),
      };

      (loadConfig as jest.Mock).mockReturnValue(mockConfig);
      (adapterRegistry.getInstalledAdapters as jest.Mock).mockReturnValue([mockAdapter]);
      auditServiceMock.auditAllClients.mockReturnValue({});

      // Act
      await command.parseAsync(['node', 'overture']);

      // Assert
      expect(Logger.success).toHaveBeenCalledWith(expect.stringContaining('No unmanaged'));
    });

    it('should display suggestions section', async () => {
      // Arrange
      const mockConfig: OvertureConfigV2 = {
        version: '2.0',
        mcp: {},
      };

      const mockAdapter: ClientAdapter = {
        name: 'claude-code',
        schemaRootKey: 'mcpServers',
        detectConfigPath: jest.fn(),
        readConfig: jest.fn(),
        writeConfig: jest.fn(),
        convertFromOverture: jest.fn(),
        supportsTransport: jest.fn(),
        needsEnvVarExpansion: jest.fn(),
        isInstalled: jest.fn(),
      };

      const unmanagedByClient = {
        'claude-code': ['filesystem'],
      };

      const suggestions = ['overture user add mcp filesystem'];

      (loadConfig as jest.Mock).mockReturnValue(mockConfig);
      (adapterRegistry.getInstalledAdapters as jest.Mock).mockReturnValue([mockAdapter]);
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
      (adapterRegistry.get as jest.Mock).mockReturnValue(undefined);

      // Act & Assert
      await expect(async () => {
        await command.parseAsync(['node', 'overture', '--client', 'unknown-client']);
      }).rejects.toThrow('process.exit: 1');

      expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('unknown-client'));
    });

    it('should error when config cannot be loaded', async () => {
      // Arrange
      (loadConfig as jest.Mock).mockImplementation(() => {
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
      const mockConfig: OvertureConfigV2 = {
        version: '2.0',
        mcp: {},
      };

      (loadConfig as jest.Mock).mockReturnValue(mockConfig);
      (adapterRegistry.getInstalledAdapters as jest.Mock).mockReturnValue([]);

      // Act & Assert
      await expect(async () => {
        await command.parseAsync(['node', 'overture']);
      }).rejects.toThrow('process.exit: 1');

      expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('No installed'));
    });

    it('should handle audit service errors gracefully', async () => {
      // Arrange
      const mockConfig: OvertureConfigV2 = {
        version: '2.0',
        mcp: {},
      };

      const mockAdapter: ClientAdapter = {
        name: 'claude-code',
        schemaRootKey: 'mcpServers',
        detectConfigPath: jest.fn(),
        readConfig: jest.fn(),
        writeConfig: jest.fn(),
        convertFromOverture: jest.fn(),
        supportsTransport: jest.fn(),
        needsEnvVarExpansion: jest.fn(),
        isInstalled: jest.fn(),
      };

      (loadConfig as jest.Mock).mockReturnValue(mockConfig);
      (adapterRegistry.getInstalledAdapters as jest.Mock).mockReturnValue([mockAdapter]);
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
      const mockConfig: OvertureConfigV2 = {
        version: '2.0',
        mcp: {},
      };

      const mockAdapter1: ClientAdapter = {
        name: 'claude-code',
        schemaRootKey: 'mcpServers',
        detectConfigPath: jest.fn(),
        readConfig: jest.fn(),
        writeConfig: jest.fn(),
        convertFromOverture: jest.fn(),
        supportsTransport: jest.fn(),
        needsEnvVarExpansion: jest.fn(),
        isInstalled: jest.fn(),
      };

      (loadConfig as jest.Mock).mockReturnValue(mockConfig);
      (adapterRegistry.getInstalledAdapters as jest.Mock).mockReturnValue([mockAdapter1]);
      auditServiceMock.auditAllClients.mockReturnValue({});

      // Act
      await command.parseAsync(['node', 'overture']);

      // Assert
      expect(adapterRegistry.getInstalledAdapters).toHaveBeenCalledWith('linux');
      expect(auditServiceMock.auditAllClients).toHaveBeenCalledWith([mockAdapter1], mockConfig, 'linux');
    });

    it('should verify specific client is installed before auditing', async () => {
      // Arrange
      const mockConfig: OvertureConfigV2 = {
        version: '2.0',
        mcp: {},
      };

      const mockAdapter: ClientAdapter = {
        name: 'claude-code',
        schemaRootKey: 'mcpServers',
        detectConfigPath: jest.fn().mockReturnValue(null), // Not installed
        readConfig: jest.fn(),
        writeConfig: jest.fn(),
        convertFromOverture: jest.fn(),
        supportsTransport: jest.fn(),
        needsEnvVarExpansion: jest.fn(),
        isInstalled: jest.fn().mockReturnValue(false),
      };

      (loadConfig as jest.Mock).mockReturnValue(mockConfig);
      (adapterRegistry.get as jest.Mock).mockReturnValue(mockAdapter);

      // Act & Assert
      await expect(async () => {
        await command.parseAsync(['node', 'overture', '--client', 'claude-code']);
      }).rejects.toThrow('process.exit: 1');

      expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('not installed'));
    });
  });
});
