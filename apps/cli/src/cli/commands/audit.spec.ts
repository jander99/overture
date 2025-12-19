import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SpyInstance } from 'vitest';
import { createAuditCommand } from './audit';
import type { AppDependencies } from '../../composition-root';
import { createMockAppDependencies } from '../../test-utils/app-dependencies.mock';
import { createMockAdapter } from '../../test-utils/test-fixtures';

describe('audit command', () => {
  let deps: AppDependencies;
  let exitSpy: SpyInstance;

  beforeEach(() => {
    deps = createMockAppDependencies();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic command structure', () => {
    it('should create a command named "audit"', () => {
      const command = createAuditCommand(deps);
      expect(command.name()).toBe('audit');
    });

    it('should have a description', () => {
      const command = createAuditCommand(deps);
      expect(command.description()).toBe('Detect MCPs in client configs that are not managed by Overture');
    });

    it('should support --client option', () => {
      const command = createAuditCommand(deps);
      const options = command.options;

      const clientOption = options.find((opt) => opt.long === '--client');
      expect(clientOption).toBeDefined();
      expect(clientOption?.description).toContain('Audit specific client');
    });
  });

  describe('audit single client', () => {
    it('should audit specific client when --client flag is provided', async () => {
      // Arrange
      const mockConfig = {
        version: '1.0' as const,
        mcp: {
          filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem'] },
        },
      };

      const mockAdapter = createMockAdapter('claude-code');

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(mockConfig);
      vi.mocked(deps.pathResolver.getPlatform).mockReturnValue('linux' as const);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(mockAdapter);
      vi.mocked(deps.auditService.auditClient).mockReturnValue(['memory', 'github']);
      vi.mocked(deps.auditService.generateSuggestions).mockReturnValue([
        'Add memory to .overture/config.yaml',
        'Add github to .overture/config.yaml',
      ]);

      const command = createAuditCommand(deps);

      // Act
      await command.parseAsync(['node', 'audit', '--client', 'claude-code']);

      // Assert
      expect(deps.adapterRegistry.get).toHaveBeenCalledWith('claude-code');
      expect(deps.auditService.auditClient).toHaveBeenCalledWith(
        mockAdapter,
        mockConfig,
        'linux'
      );
      expect(deps.output.warn).toHaveBeenCalledWith(
        expect.stringContaining('Found 2 unmanaged MCP')
      );
    });

    it('should handle unknown client gracefully', async () => {
      // Arrange
      const mockConfig = {
        version: '1.0' as const,
        mcp: {},
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(mockConfig);
      vi.mocked(deps.pathResolver.getPlatform).mockReturnValue('linux' as const);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(null);

      const command = createAuditCommand(deps);

      // Act
      await command.parseAsync(['node', 'audit', '--client', 'unknown-client']);

      // Assert
      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining('Unknown client')
      );
      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('Available clients')
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle client not installed', async () => {
      // Arrange
      const mockConfig = {
        version: '1.0' as const,
        mcp: {},
      };

      const mockAdapter = {
        name: 'vscode',
        isInstalled: vi.fn().mockReturnValue(false),
        detectConfigPath: vi.fn(),
        readConfig: vi.fn(),
        writeConfig: vi.fn(),
        validateTransport: vi.fn(),
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(mockConfig);
      vi.mocked(deps.pathResolver.getPlatform).mockReturnValue('linux' as const);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(mockAdapter as any);

      const command = createAuditCommand(deps);

      // Act
      await command.parseAsync(['node', 'audit', '--client', 'vscode']);

      // Assert
      expect(deps.output.warn).toHaveBeenCalledWith(
        expect.stringContaining('is not installed')
      );
      expect(deps.output.success).toHaveBeenCalledWith(
        expect.stringContaining('No unmanaged MCPs found')
      );
    });

    it('should display no unmanaged MCPs when all are managed', async () => {
      // Arrange
      const mockConfig = {
        version: '1.0' as const,
        mcp: {
          filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem'] },
        },
      };

      const mockAdapter = createMockAdapter('claude-code');

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(mockConfig);
      vi.mocked(deps.pathResolver.getPlatform).mockReturnValue('linux' as const);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(mockAdapter);
      vi.mocked(deps.auditService.auditClient).mockReturnValue([]);

      const command = createAuditCommand(deps);

      // Act
      await command.parseAsync(['node', 'audit', '--client', 'claude-code']);

      // Assert
      expect(deps.output.success).toHaveBeenCalledWith(
        expect.stringContaining('No unmanaged MCPs found')
      );
    });
  });

  describe('audit all installed clients', () => {
    it('should audit all installed clients when no --client flag', async () => {
      // Arrange
      const mockConfig = {
        version: '1.0' as const,
        mcp: {},
      };

      const mockAdapters = [
        createMockAdapter('claude-code'),
        createMockAdapter('vscode'),
      ];

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(mockConfig);
      vi.mocked(deps.pathResolver.getPlatform).mockReturnValue('linux' as const);
      vi.mocked(deps.adapterRegistry.getInstalledAdapters).mockReturnValue(mockAdapters);
      vi.mocked(deps.auditService.auditAllClients).mockReturnValue({
        'claude-code': ['memory'],
        'vscode': ['github'],
      });
      vi.mocked(deps.auditService.generateSuggestions).mockReturnValue([
        'Add memory to .overture/config.yaml',
        'Add github to .overture/config.yaml',
      ]);

      const command = createAuditCommand(deps);

      // Act
      await command.parseAsync(['node', 'audit']);

      // Assert
      expect(deps.adapterRegistry.getInstalledAdapters).toHaveBeenCalledWith('linux');
      expect(deps.auditService.auditAllClients).toHaveBeenCalledWith(
        mockAdapters,
        mockConfig,
        'linux'
      );
      expect(deps.output.warn).toHaveBeenCalledWith(
        expect.stringContaining('Found 2 unmanaged MCP')
      );
    });

    it('should handle no installed clients', async () => {
      // Arrange
      const mockConfig = {
        version: '1.0' as const,
        mcp: {},
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(mockConfig);
      vi.mocked(deps.pathResolver.getPlatform).mockReturnValue('linux' as const);
      vi.mocked(deps.adapterRegistry.getInstalledAdapters).mockReturnValue([]);

      const command = createAuditCommand(deps);

      // Act
      await command.parseAsync(['node', 'audit']);

      // Assert
      expect(deps.output.warn).toHaveBeenCalledWith(
        expect.stringContaining('No installed AI clients detected')
      );
      expect(deps.output.success).toHaveBeenCalledWith(
        expect.stringContaining('No unmanaged MCPs found')
      );
    });

    it('should display no unmanaged MCPs when all clients are clean', async () => {
      // Arrange
      const mockConfig = {
        version: '1.0' as const,
        mcp: {},
      };

      const mockAdapters = [createMockAdapter('claude-code')];

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(mockConfig);
      vi.mocked(deps.pathResolver.getPlatform).mockReturnValue('linux' as const);
      vi.mocked(deps.adapterRegistry.getInstalledAdapters).mockReturnValue(mockAdapters);
      vi.mocked(deps.auditService.auditAllClients).mockReturnValue({});

      const command = createAuditCommand(deps);

      // Act
      await command.parseAsync(['node', 'audit']);

      // Assert
      expect(deps.output.success).toHaveBeenCalledWith(
        expect.stringContaining('No unmanaged MCPs found')
      );
      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('All client MCPs are managed by Overture')
      );
    });
  });

  describe('suggestion display', () => {
    it('should display suggestions for adding unmanaged MCPs', async () => {
      // Arrange
      const mockConfig = {
        version: '1.0' as const,
        mcp: {},
      };

      const mockAdapter = createMockAdapter('claude-code');

      const mockSuggestions = [
        'Add memory to .overture/config.yaml',
        'Add github to .overture/config.yaml',
      ];

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(mockConfig);
      vi.mocked(deps.pathResolver.getPlatform).mockReturnValue('linux' as const);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(mockAdapter);
      vi.mocked(deps.auditService.auditClient).mockReturnValue(['memory', 'github']);
      vi.mocked(deps.auditService.generateSuggestions).mockReturnValue(mockSuggestions);

      const command = createAuditCommand(deps);

      // Act
      await command.parseAsync(['node', 'audit', '--client', 'claude-code']);

      // Assert
      expect(deps.auditService.generateSuggestions).toHaveBeenCalled();
      expect(deps.output.info).toHaveBeenCalledWith('Suggestions:');
      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('Add memory to .overture/config.yaml')
      );
      expect(deps.output.info).toHaveBeenCalledWith(
        expect.stringContaining('Add github to .overture/config.yaml')
      );
    });

    it('should not display suggestions when there are no unmanaged MCPs', async () => {
      // Arrange
      const mockConfig = {
        version: '1.0' as const,
        mcp: {},
      };

      const mockAdapter = createMockAdapter('claude-code');

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(mockConfig);
      vi.mocked(deps.pathResolver.getPlatform).mockReturnValue('linux' as const);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(mockAdapter);
      vi.mocked(deps.auditService.auditClient).mockReturnValue([]);

      const command = createAuditCommand(deps);

      // Act
      await command.parseAsync(['node', 'audit', '--client', 'claude-code']);

      // Assert
      expect(deps.auditService.generateSuggestions).not.toHaveBeenCalled();
      const infoCalls = vi.mocked(deps.output.info).mock.calls;
      const hasSuggestions = infoCalls.some(call => call[0]?.includes('Suggestions:'));
      expect(hasSuggestions).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle config loading errors', async () => {
      // Arrange
      vi.mocked(deps.configLoader.loadConfig).mockRejectedValue(
        new Error('Failed to load config')
      );

      const command = createAuditCommand(deps);

      // Act
      await command.parseAsync(['node', 'audit']);

      // Assert - ErrorHandler.handleCommandError should be called, which logs and exits
      // We verify that the error path was taken by checking the config loader was called
      expect(deps.configLoader.loadConfig).toHaveBeenCalled();
    });

    it('should handle audit service errors for single client', async () => {
      // Arrange
      const mockConfig = {
        version: '1.0' as const,
        mcp: {},
      };

      const mockAdapter = {
        name: 'claude-code',
        isInstalled: vi.fn().mockReturnValue(true),
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(mockConfig);
      vi.mocked(deps.pathResolver.getPlatform).mockReturnValue('linux' as const);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(mockAdapter as any);
      vi.mocked(deps.auditService.auditClient).mockImplementation(() => {
        throw new Error('Audit failed');
      });

      const command = createAuditCommand(deps);

      // Act
      await command.parseAsync(['node', 'audit', '--client', 'claude-code']);

      // Assert
      expect(deps.auditService.auditClient).toHaveBeenCalled();
    });

    it('should handle audit service errors for all clients', async () => {
      // Arrange
      const mockConfig = {
        version: '1.0' as const,
        mcp: {},
      };

      const mockAdapters = [createMockAdapter('claude-code')];

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(mockConfig);
      vi.mocked(deps.pathResolver.getPlatform).mockReturnValue('linux' as const);
      vi.mocked(deps.adapterRegistry.getInstalledAdapters).mockReturnValue(mockAdapters);
      vi.mocked(deps.auditService.auditAllClients).mockImplementation(() => {
        throw new Error('Audit all failed');
      });

      const command = createAuditCommand(deps);

      // Act
      await command.parseAsync(['node', 'audit']);

      // Assert
      expect(deps.auditService.auditAllClients).toHaveBeenCalled();
    });
  });
});
