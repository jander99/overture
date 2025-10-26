import { Command } from 'commander';
import { createSyncCommand } from './sync';
import { ConfigManager } from '../../core/config-manager';
import { PluginInstaller } from '../../core/plugin-installer';
import { Generator } from '../../core/generator';
import { Logger } from '../../utils/logger';
import type { OvertureConfig } from '../../domain/schemas';
import type { PluginInstallResult } from '../../domain/types';
import type { GeneratorResult } from '../../domain/types';

// Mock all dependencies
jest.mock('../../core/config-manager');
jest.mock('../../core/plugin-installer');
jest.mock('../../core/generator');
jest.mock('../../utils/logger');

describe('CLI Command: sync', () => {
  let command: Command;
  let mockExit: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    command = createSyncCommand();

    // Mock process.exit to prevent test termination
    mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit: ${code}`);
    });
  });

  afterEach(() => {
    mockExit.mockRestore();
  });

  // ============================================================================
  // Successful Sync Tests
  // ============================================================================
  describe('Successful sync', () => {
    it('should load and merge configs, install plugins, and generate files', async () => {
      // Arrange
      const projectConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project', type: 'python-backend' },
        plugins: {
          'python-development': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            mcps: ['python-repl', 'ruff'],
          },
        },
        mcp: {
          'python-repl': {
            command: 'uvx',
            args: ['mcp-server-python-repl'],
            scope: 'project',
            enabled: true,
          },
        },
      };

      const mergedConfig: OvertureConfig = { ...projectConfig };
      const pluginResults: PluginInstallResult[] = [
        { pluginName: 'python-development', success: true, message: 'Installed' },
      ];
      const generatorResult: GeneratorResult = {
        mcpJson: { mcpServers: { 'python-repl': { command: 'uvx', args: ['mcp-server-python-repl'] } } },
        claudeMd: '# CLAUDE.md',
        filesWritten: ['.mcp.json', 'CLAUDE.md'],
      };

      (ConfigManager.loadProjectConfig as jest.Mock).mockResolvedValue(projectConfig);
      (ConfigManager.loadGlobalConfig as jest.Mock).mockResolvedValue(null);
      (ConfigManager.mergeConfigs as jest.Mock).mockReturnValue(mergedConfig);
      (PluginInstaller.installPlugins as jest.Mock).mockResolvedValue(pluginResults);
      (Generator.generateFiles as jest.Mock).mockResolvedValue(generatorResult);

      // Act
      await command.parseAsync(['node', 'overture']);

      // Assert
      expect(ConfigManager.loadProjectConfig).toHaveBeenCalled();
      expect(ConfigManager.loadGlobalConfig).toHaveBeenCalled();
      expect(ConfigManager.mergeConfigs).toHaveBeenCalledWith(null, projectConfig);
      expect(PluginInstaller.installPlugins).toHaveBeenCalledWith([
        { name: 'python-development', marketplace: 'claude-code-workflows' },
      ]);
      expect(Generator.generateFiles).toHaveBeenCalledWith(mergedConfig);
      expect(Logger.success).toHaveBeenCalledWith('Sync complete!');
    });

    it('should skip plugin installation with --skip-plugins flag', async () => {
      // Arrange
      const projectConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {
          'python-development': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            mcps: [],
          },
        },
        mcp: {},
      };

      const generatorResult: GeneratorResult = {
        mcpJson: { mcpServers: {} },
        claudeMd: '# CLAUDE.md',
        filesWritten: ['.mcp.json', 'CLAUDE.md'],
      };

      (ConfigManager.loadProjectConfig as jest.Mock).mockResolvedValue(projectConfig);
      (ConfigManager.loadGlobalConfig as jest.Mock).mockResolvedValue(null);
      (ConfigManager.mergeConfigs as jest.Mock).mockReturnValue(projectConfig);
      (Generator.generateFiles as jest.Mock).mockResolvedValue(generatorResult);

      // Act
      await command.parseAsync(['node', 'overture', '--skip-plugins']);

      // Assert
      expect(PluginInstaller.installPlugins).not.toHaveBeenCalled();
      expect(Generator.generateFiles).toHaveBeenCalled();
      expect(Logger.success).toHaveBeenCalledWith('Sync complete!');
    });

    it('should install multiple plugins', async () => {
      // Arrange
      const projectConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {
          'python-development': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            mcps: [],
          },
          'typescript-development': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            mcps: [],
          },
          'kubernetes-ops': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            mcps: [],
          },
        },
        mcp: {},
      };

      const pluginResults: PluginInstallResult[] = [
        { pluginName: 'python-development', success: true, message: 'Installed' },
        { pluginName: 'typescript-development', success: true, message: 'Installed' },
        { pluginName: 'kubernetes-ops', success: true, message: 'Installed' },
      ];

      const generatorResult: GeneratorResult = {
        mcpJson: { mcpServers: {} },
        claudeMd: '# CLAUDE.md',
        filesWritten: ['.mcp.json', 'CLAUDE.md'],
      };

      (ConfigManager.loadProjectConfig as jest.Mock).mockResolvedValue(projectConfig);
      (ConfigManager.loadGlobalConfig as jest.Mock).mockResolvedValue(null);
      (ConfigManager.mergeConfigs as jest.Mock).mockReturnValue(projectConfig);
      (PluginInstaller.installPlugins as jest.Mock).mockResolvedValue(pluginResults);
      (Generator.generateFiles as jest.Mock).mockResolvedValue(generatorResult);

      // Act
      await command.parseAsync(['node', 'overture']);

      // Assert
      expect(PluginInstaller.installPlugins).toHaveBeenCalledWith([
        { name: 'python-development', marketplace: 'claude-code-workflows' },
        { name: 'typescript-development', marketplace: 'claude-code-workflows' },
        { name: 'kubernetes-ops', marketplace: 'claude-code-workflows' },
      ]);
      expect(Logger.info).toHaveBeenCalledWith('Installing 3 plugin(s)...');
    });

    it('should skip disabled plugins', async () => {
      // Arrange
      const projectConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {
          'enabled-plugin': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            mcps: [],
          },
          'disabled-plugin': {
            marketplace: 'claude-code-workflows',
            enabled: false,
            mcps: [],
          },
        },
        mcp: {},
      };

      const pluginResults: PluginInstallResult[] = [
        { pluginName: 'enabled-plugin', success: true, message: 'Installed' },
      ];

      const generatorResult: GeneratorResult = {
        mcpJson: { mcpServers: {} },
        claudeMd: '# CLAUDE.md',
        filesWritten: ['.mcp.json', 'CLAUDE.md'],
      };

      (ConfigManager.loadProjectConfig as jest.Mock).mockResolvedValue(projectConfig);
      (ConfigManager.loadGlobalConfig as jest.Mock).mockResolvedValue(null);
      (ConfigManager.mergeConfigs as jest.Mock).mockReturnValue(projectConfig);
      (PluginInstaller.installPlugins as jest.Mock).mockResolvedValue(pluginResults);
      (Generator.generateFiles as jest.Mock).mockResolvedValue(generatorResult);

      // Act
      await command.parseAsync(['node', 'overture']);

      // Assert
      expect(PluginInstaller.installPlugins).toHaveBeenCalledWith([
        { name: 'enabled-plugin', marketplace: 'claude-code-workflows' },
      ]);
      expect(Logger.info).toHaveBeenCalledWith('Installing 1 plugin(s)...');
    });

    it('should display files written after sync', async () => {
      // Arrange
      const projectConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {},
        mcp: {},
      };

      const generatorResult: GeneratorResult = {
        mcpJson: { mcpServers: {} },
        claudeMd: '# CLAUDE.md',
        filesWritten: ['/project/.mcp.json', '/project/CLAUDE.md'],
      };

      (ConfigManager.loadProjectConfig as jest.Mock).mockResolvedValue(projectConfig);
      (ConfigManager.loadGlobalConfig as jest.Mock).mockResolvedValue(null);
      (ConfigManager.mergeConfigs as jest.Mock).mockReturnValue(projectConfig);
      (Generator.generateFiles as jest.Mock).mockResolvedValue(generatorResult);

      // Act
      await command.parseAsync(['node', 'overture', '--skip-plugins']);

      // Assert
      expect(Logger.success).toHaveBeenCalledWith('Sync complete!');
      expect(Logger.info).toHaveBeenCalledWith('Files generated:');
      expect(Logger.info).toHaveBeenCalledWith('  - /project/.mcp.json');
      expect(Logger.info).toHaveBeenCalledWith('  - /project/CLAUDE.md');
    });

    it('should log blank line before success message', async () => {
      // Arrange
      const projectConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {},
        mcp: {},
      };

      const generatorResult: GeneratorResult = {
        mcpJson: { mcpServers: {} },
        claudeMd: '# CLAUDE.md',
        filesWritten: ['.mcp.json', 'CLAUDE.md'],
      };

      (ConfigManager.loadProjectConfig as jest.Mock).mockResolvedValue(projectConfig);
      (ConfigManager.loadGlobalConfig as jest.Mock).mockResolvedValue(null);
      (ConfigManager.mergeConfigs as jest.Mock).mockReturnValue(projectConfig);
      (Generator.generateFiles as jest.Mock).mockResolvedValue(generatorResult);

      // Act
      await command.parseAsync(['node', 'overture', '--skip-plugins']);

      // Assert
      expect(Logger.nl).toHaveBeenCalled();
      expect(Logger.success).toHaveBeenCalledWith('Sync complete!');
    });

    it('should merge global and project configs', async () => {
      // Arrange
      const globalConfig: OvertureConfig = {
        version: '1.0',
        plugins: {
          'global-plugin': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            mcps: [],
          },
        },
        mcp: {
          'global-mcp': { scope: 'global', enabled: true },
        },
      };

      const projectConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {
          'project-plugin': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            mcps: [],
          },
        },
        mcp: {},
      };

      const mergedConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {
          'global-plugin': globalConfig.plugins['global-plugin'],
          'project-plugin': projectConfig.plugins['project-plugin'],
        },
        mcp: globalConfig.mcp,
      };

      const generatorResult: GeneratorResult = {
        mcpJson: { mcpServers: {} },
        claudeMd: '# CLAUDE.md',
        filesWritten: ['.mcp.json', 'CLAUDE.md'],
      };

      (ConfigManager.loadProjectConfig as jest.Mock).mockResolvedValue(projectConfig);
      (ConfigManager.loadGlobalConfig as jest.Mock).mockResolvedValue(globalConfig);
      (ConfigManager.mergeConfigs as jest.Mock).mockReturnValue(mergedConfig);
      (PluginInstaller.installPlugins as jest.Mock).mockResolvedValue([]);
      (Generator.generateFiles as jest.Mock).mockResolvedValue(generatorResult);

      // Act
      await command.parseAsync(['node', 'overture', '--skip-plugins']);

      // Assert
      expect(ConfigManager.loadGlobalConfig).toHaveBeenCalled();
      expect(ConfigManager.loadProjectConfig).toHaveBeenCalled();
      expect(ConfigManager.mergeConfigs).toHaveBeenCalledWith(globalConfig, projectConfig);
      expect(Generator.generateFiles).toHaveBeenCalledWith(mergedConfig);
    });
  });

  // ============================================================================
  // Plugin Installation Error Handling
  // ============================================================================
  describe('Plugin installation error handling', () => {
    it('should report failed plugin installations', async () => {
      // Arrange
      const projectConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {
          'plugin1': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            mcps: [],
          },
          'plugin2': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            mcps: [],
          },
        },
        mcp: {},
      };

      const pluginResults: PluginInstallResult[] = [
        { pluginName: 'plugin1', success: true, message: 'Installed' },
        { pluginName: 'plugin2', success: false, message: 'Plugin not found' },
      ];

      const generatorResult: GeneratorResult = {
        mcpJson: { mcpServers: {} },
        claudeMd: '# CLAUDE.md',
        filesWritten: ['.mcp.json', 'CLAUDE.md'],
      };

      (ConfigManager.loadProjectConfig as jest.Mock).mockResolvedValue(projectConfig);
      (ConfigManager.loadGlobalConfig as jest.Mock).mockResolvedValue(null);
      (ConfigManager.mergeConfigs as jest.Mock).mockReturnValue(projectConfig);
      (PluginInstaller.installPlugins as jest.Mock).mockResolvedValue(pluginResults);
      (Generator.generateFiles as jest.Mock).mockResolvedValue(generatorResult);

      // Act
      await command.parseAsync(['node', 'overture']);

      // Assert
      expect(Logger.warn).toHaveBeenCalledWith('1 plugin(s) failed to install');
      expect(Logger.error).toHaveBeenCalledWith('  plugin2: Plugin not found');
    });

    it('should continue with file generation even if plugins fail', async () => {
      // Arrange
      const projectConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {
          'failing-plugin': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            mcps: [],
          },
        },
        mcp: {},
      };

      const pluginResults: PluginInstallResult[] = [
        { pluginName: 'failing-plugin', success: false, message: 'Installation failed' },
      ];

      const generatorResult: GeneratorResult = {
        mcpJson: { mcpServers: {} },
        claudeMd: '# CLAUDE.md',
        filesWritten: ['.mcp.json', 'CLAUDE.md'],
      };

      (ConfigManager.loadProjectConfig as jest.Mock).mockResolvedValue(projectConfig);
      (ConfigManager.loadGlobalConfig as jest.Mock).mockResolvedValue(null);
      (ConfigManager.mergeConfigs as jest.Mock).mockReturnValue(projectConfig);
      (PluginInstaller.installPlugins as jest.Mock).mockResolvedValue(pluginResults);
      (Generator.generateFiles as jest.Mock).mockResolvedValue(generatorResult);

      // Act
      await command.parseAsync(['node', 'overture']);

      // Assert
      expect(Logger.warn).toHaveBeenCalled();
      expect(Generator.generateFiles).toHaveBeenCalled();
      expect(Logger.success).toHaveBeenCalledWith('Sync complete!');
    });

    it('should report multiple failed plugin installations', async () => {
      // Arrange
      const projectConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {
          'plugin1': { marketplace: 'market', enabled: true, mcps: [] },
          'plugin2': { marketplace: 'market', enabled: true, mcps: [] },
          'plugin3': { marketplace: 'market', enabled: true, mcps: [] },
        },
        mcp: {},
      };

      const pluginResults: PluginInstallResult[] = [
        { pluginName: 'plugin1', success: false, message: 'Error 1' },
        { pluginName: 'plugin2', success: false, message: 'Error 2' },
        { pluginName: 'plugin3', success: true, message: 'Installed' },
      ];

      const generatorResult: GeneratorResult = {
        mcpJson: { mcpServers: {} },
        claudeMd: '# CLAUDE.md',
        filesWritten: ['.mcp.json', 'CLAUDE.md'],
      };

      (ConfigManager.loadProjectConfig as jest.Mock).mockResolvedValue(projectConfig);
      (ConfigManager.loadGlobalConfig as jest.Mock).mockResolvedValue(null);
      (ConfigManager.mergeConfigs as jest.Mock).mockReturnValue(projectConfig);
      (PluginInstaller.installPlugins as jest.Mock).mockResolvedValue(pluginResults);
      (Generator.generateFiles as jest.Mock).mockResolvedValue(generatorResult);

      // Act
      await command.parseAsync(['node', 'overture']);

      // Assert
      expect(Logger.warn).toHaveBeenCalledWith('2 plugin(s) failed to install');
      expect(Logger.error).toHaveBeenCalledWith('  plugin1: Error 1');
      expect(Logger.error).toHaveBeenCalledWith('  plugin2: Error 2');
    });

    it('should not show warning when all plugins succeed', async () => {
      // Arrange
      const projectConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {
          'plugin1': { marketplace: 'market', enabled: true, mcps: [] },
        },
        mcp: {},
      };

      const pluginResults: PluginInstallResult[] = [
        { pluginName: 'plugin1', success: true, message: 'Installed' },
      ];

      const generatorResult: GeneratorResult = {
        mcpJson: { mcpServers: {} },
        claudeMd: '# CLAUDE.md',
        filesWritten: ['.mcp.json', 'CLAUDE.md'],
      };

      (ConfigManager.loadProjectConfig as jest.Mock).mockResolvedValue(projectConfig);
      (ConfigManager.loadGlobalConfig as jest.Mock).mockResolvedValue(null);
      (ConfigManager.mergeConfigs as jest.Mock).mockReturnValue(projectConfig);
      (PluginInstaller.installPlugins as jest.Mock).mockResolvedValue(pluginResults);
      (Generator.generateFiles as jest.Mock).mockResolvedValue(generatorResult);

      // Act
      await command.parseAsync(['node', 'overture']);

      // Assert
      expect(Logger.warn).not.toHaveBeenCalled();
      expect(Logger.success).toHaveBeenCalledWith('Sync complete!');
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================
  describe('Error handling', () => {
    it('should exit with error when config loading fails', async () => {
      // Arrange
      (ConfigManager.loadProjectConfig as jest.Mock).mockRejectedValue(
        new Error('Failed to load config')
      );

      // Act & Assert
      await expect(
        command.parseAsync(['node', 'overture'])
      ).rejects.toThrow('process.exit: 1');

      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Sync failed: Failed to load config')
      );
    });

    it('should exit with error when no config found', async () => {
      // Arrange
      (ConfigManager.loadProjectConfig as jest.Mock).mockResolvedValue(null);
      (ConfigManager.loadGlobalConfig as jest.Mock).mockResolvedValue(null);
      (ConfigManager.mergeConfigs as jest.Mock).mockImplementation(() => {
        throw new Error('No configuration found');
      });

      // Act & Assert
      await expect(
        command.parseAsync(['node', 'overture'])
      ).rejects.toThrow('process.exit: 1');

      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('No configuration found')
      );
    });

    it('should exit with error when file generation fails', async () => {
      // Arrange
      const projectConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {},
        mcp: {},
      };

      (ConfigManager.loadProjectConfig as jest.Mock).mockResolvedValue(projectConfig);
      (ConfigManager.loadGlobalConfig as jest.Mock).mockResolvedValue(null);
      (ConfigManager.mergeConfigs as jest.Mock).mockReturnValue(projectConfig);
      (Generator.generateFiles as jest.Mock).mockRejectedValue(
        new Error('Failed to write files')
      );

      // Act & Assert
      await expect(
        command.parseAsync(['node', 'overture', '--skip-plugins'])
      ).rejects.toThrow('process.exit: 1');

      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Sync failed: Failed to write files')
      );
    });

    it('should handle errors with exitCode property', async () => {
      // Arrange
      const errorWithExitCode = new Error('Custom error') as Error & { exitCode: number };
      errorWithExitCode.exitCode = 3;

      (ConfigManager.loadProjectConfig as jest.Mock).mockRejectedValue(errorWithExitCode);

      // Act & Assert
      await expect(
        command.parseAsync(['node', 'overture'])
      ).rejects.toThrow('process.exit: 3');

      expect(Logger.error).toHaveBeenCalled();
    });

    it('should default to exit code 1 when error has no exitCode', async () => {
      // Arrange
      (ConfigManager.loadProjectConfig as jest.Mock).mockRejectedValue(
        new Error('Generic error')
      );

      // Act & Assert
      await expect(
        command.parseAsync(['node', 'overture'])
      ).rejects.toThrow('process.exit: 1');
    });
  });

  // ============================================================================
  // Command Configuration Tests
  // ============================================================================
  describe('Command configuration', () => {
    it('should have correct command description', () => {
      expect(command.description()).toBe(
        'Install plugins and generate .mcp.json and CLAUDE.md'
      );
    });

    it('should register --skip-plugins option', () => {
      const skipOption = command.options.find(opt => opt.long === '--skip-plugins');
      expect(skipOption).toBeDefined();
      expect(skipOption?.description).toContain('Skip plugin installation');
    });

    it('should have command name "sync"', () => {
      expect(command.name()).toBe('sync');
    });
  });

  // ============================================================================
  // Integration Scenarios
  // ============================================================================
  describe('Integration scenarios', () => {
    it('should handle complete sync workflow with no plugins', async () => {
      // Arrange
      const projectConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {},
        mcp: {
          'standalone-mcp': {
            command: 'mcp-server',
            scope: 'project',
            enabled: true,
          },
        },
      };

      const generatorResult: GeneratorResult = {
        mcpJson: { mcpServers: { 'standalone-mcp': { command: 'mcp-server' } } },
        claudeMd: '# CLAUDE.md',
        filesWritten: ['.mcp.json', 'CLAUDE.md'],
      };

      (ConfigManager.loadProjectConfig as jest.Mock).mockResolvedValue(projectConfig);
      (ConfigManager.loadGlobalConfig as jest.Mock).mockResolvedValue(null);
      (ConfigManager.mergeConfigs as jest.Mock).mockReturnValue(projectConfig);
      (Generator.generateFiles as jest.Mock).mockResolvedValue(generatorResult);

      // Act
      await command.parseAsync(['node', 'overture']);

      // Assert
      expect(Logger.info).toHaveBeenCalledWith('Loading configuration...');
      expect(Logger.info).toHaveBeenCalledWith('Generating configuration files...');
      expect(PluginInstaller.installPlugins).not.toHaveBeenCalled();
      expect(Generator.generateFiles).toHaveBeenCalled();
      expect(Logger.success).toHaveBeenCalledWith('Sync complete!');
    });

    it('should log loading message at start', async () => {
      // Arrange
      const projectConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {},
        mcp: {},
      };

      const generatorResult: GeneratorResult = {
        mcpJson: { mcpServers: {} },
        claudeMd: '# CLAUDE.md',
        filesWritten: ['.mcp.json', 'CLAUDE.md'],
      };

      (ConfigManager.loadProjectConfig as jest.Mock).mockResolvedValue(projectConfig);
      (ConfigManager.loadGlobalConfig as jest.Mock).mockResolvedValue(null);
      (ConfigManager.mergeConfigs as jest.Mock).mockReturnValue(projectConfig);
      (Generator.generateFiles as jest.Mock).mockResolvedValue(generatorResult);

      // Act
      await command.parseAsync(['node', 'overture', '--skip-plugins']);

      // Assert
      const loggerCalls = (Logger.info as jest.Mock).mock.calls;
      expect(loggerCalls[0][0]).toBe('Loading configuration...');
    });

    it('should log generation message before generating files', async () => {
      // Arrange
      const projectConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {},
        mcp: {},
      };

      const generatorResult: GeneratorResult = {
        mcpJson: { mcpServers: {} },
        claudeMd: '# CLAUDE.md',
        filesWritten: ['.mcp.json', 'CLAUDE.md'],
      };

      (ConfigManager.loadProjectConfig as jest.Mock).mockResolvedValue(projectConfig);
      (ConfigManager.loadGlobalConfig as jest.Mock).mockResolvedValue(null);
      (ConfigManager.mergeConfigs as jest.Mock).mockReturnValue(projectConfig);
      (Generator.generateFiles as jest.Mock).mockResolvedValue(generatorResult);

      // Act
      await command.parseAsync(['node', 'overture', '--skip-plugins']);

      // Assert
      expect(Logger.info).toHaveBeenCalledWith('Generating configuration files...');
    });
  });
});
