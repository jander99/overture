import * as path from 'path';
import { Command } from 'commander';
import { createInitCommand } from './init';
import { ConfigManager } from '../../core/config-manager';
import { Logger } from '../../utils/logger';
import { Prompts } from '../../utils/prompts';
import { FsUtils } from '../../infrastructure/fs-utils';
import { CONFIG_PATH, PROJECT_TYPES } from '../../domain/constants';
import type { OvertureConfig } from '../../domain/schemas';

// Mock all dependencies
jest.mock('../../core/config-manager');
jest.mock('../../utils/logger');
jest.mock('../../utils/prompts');
jest.mock('../../infrastructure/fs-utils');

describe('CLI Command: init', () => {
  let command: Command;
  let mockExit: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    command = createInitCommand();
    
    // Mock process.exit to prevent test termination
    mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit: ${code}`);
    });
  });

  afterEach(() => {
    mockExit.mockRestore();
  });

  // ============================================================================
  // Successful Initialization Tests
  // ============================================================================
  describe('Successful initialization', () => {
    it('should initialize config with --type flag', async () => {
      // Arrange
      const projectDir = process.cwd();
      const configPath = path.join(projectDir, CONFIG_PATH);
      const mockConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project', type: 'python-backend' },
        plugins: {},
        mcp: {},
      };

      (FsUtils.exists as jest.Mock).mockResolvedValue(false);
      (ConfigManager.initializeConfig as jest.Mock).mockResolvedValue(mockConfig);

      // Act
      await command.parseAsync(['node', 'overture', '--type', 'python-backend']);

      // Assert
      expect(ConfigManager.initializeConfig).toHaveBeenCalledWith(
        projectDir,
        'python-backend'
      );
      expect(Logger.success).toHaveBeenCalledWith('Configuration created!');
      expect(Logger.info).toHaveBeenCalledWith(
        expect.stringContaining('.overture/config.yaml')
      );
      expect(Logger.info).toHaveBeenCalledWith(
        expect.stringContaining('overture sync')
      );
    });

    it('should initialize config with -t shorthand flag', async () => {
      // Arrange
      const projectDir = process.cwd();
      const mockConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project', type: 'node-backend' },
        plugins: {},
        mcp: {},
      };

      (FsUtils.exists as jest.Mock).mockResolvedValue(false);
      (ConfigManager.initializeConfig as jest.Mock).mockResolvedValue(mockConfig);

      // Act
      await command.parseAsync(['node', 'overture', '-t', 'node-backend']);

      // Assert
      expect(ConfigManager.initializeConfig).toHaveBeenCalledWith(
        projectDir,
        'node-backend'
      );
      expect(Logger.success).toHaveBeenCalled();
    });

    it('should prompt for project type when --type not provided', async () => {
      // Arrange
      const projectDir = process.cwd();
      const mockConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project', type: 'typescript-frontend' },
        plugins: {},
        mcp: {},
      };

      (FsUtils.exists as jest.Mock).mockResolvedValue(false);
      (Prompts.select as jest.Mock).mockResolvedValue('typescript-frontend');
      (ConfigManager.initializeConfig as jest.Mock).mockResolvedValue(mockConfig);

      // Act
      await command.parseAsync(['node', 'overture']);

      // Assert
      expect(Prompts.select).toHaveBeenCalledWith(
        'Select project type:',
        expect.arrayContaining([
          expect.objectContaining({ name: 'python-backend', value: 'python-backend' }),
          expect.objectContaining({ name: 'typescript-frontend', value: 'typescript-frontend' }),
        ])
      );
      expect(ConfigManager.initializeConfig).toHaveBeenCalledWith(
        projectDir,
        'typescript-frontend'
      );
    });

    it('should overwrite existing config with --force flag', async () => {
      // Arrange
      const projectDir = process.cwd();
      const configPath = path.join(projectDir, CONFIG_PATH);
      const mockConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project', type: 'fullstack' },
        plugins: {},
        mcp: {},
      };

      (FsUtils.exists as jest.Mock).mockResolvedValue(true); // Config exists
      (ConfigManager.initializeConfig as jest.Mock).mockResolvedValue(mockConfig);

      // Act
      await command.parseAsync(['node', 'overture', '--type', 'fullstack', '--force']);

      // Assert
      expect(FsUtils.exists).toHaveBeenCalledWith(configPath);
      expect(ConfigManager.initializeConfig).toHaveBeenCalledWith(
        projectDir,
        'fullstack'
      );
      expect(Logger.success).toHaveBeenCalledWith('Configuration created!');
    });

    it('should overwrite existing config with -f shorthand flag', async () => {
      // Arrange
      const mockConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project', type: 'data-science' },
        plugins: {},
        mcp: {},
      };

      (FsUtils.exists as jest.Mock).mockResolvedValue(true);
      (ConfigManager.initializeConfig as jest.Mock).mockResolvedValue(mockConfig);

      // Act
      await command.parseAsync(['node', 'overture', '-t', 'data-science', '-f']);

      // Assert
      expect(ConfigManager.initializeConfig).toHaveBeenCalled();
      expect(Logger.success).toHaveBeenCalled();
    });

    it('should display success messages in correct order', async () => {
      // Arrange
      const mockConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project', type: 'kubernetes' },
        plugins: {},
        mcp: {},
      };

      (FsUtils.exists as jest.Mock).mockResolvedValue(false);
      (ConfigManager.initializeConfig as jest.Mock).mockResolvedValue(mockConfig);

      // Act
      await command.parseAsync(['node', 'overture', '--type', 'kubernetes']);

      // Assert
      const loggerCalls = (Logger.info as jest.Mock).mock.calls;
      expect(Logger.info).toHaveBeenCalledWith('Initializing Overture configuration...');
      expect(Logger.success).toHaveBeenCalledWith('Configuration created!');
      expect(Logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Edit .overture/config.yaml')
      );
      expect(Logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Run `overture sync`')
      );
    });

    it('should use process.cwd() as project directory', async () => {
      // Arrange
      const expectedDir = process.cwd();
      const mockConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project', type: 'python-backend' },
        plugins: {},
        mcp: {},
      };

      (FsUtils.exists as jest.Mock).mockResolvedValue(false);
      (ConfigManager.initializeConfig as jest.Mock).mockResolvedValue(mockConfig);

      // Act
      await command.parseAsync(['node', 'overture', '--type', 'python-backend']);

      // Assert
      expect(ConfigManager.initializeConfig).toHaveBeenCalledWith(
        expectedDir,
        'python-backend'
      );
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================
  describe('Error handling', () => {
    it('should exit with error when config exists without --force', async () => {
      // Arrange
      const projectDir = process.cwd();
      const configPath = path.join(projectDir, CONFIG_PATH);

      (FsUtils.exists as jest.Mock).mockResolvedValue(true);

      // Act & Assert
      await expect(
        command.parseAsync(['node', 'overture', '--type', 'python-backend'])
      ).rejects.toThrow('process.exit: 1');

      expect(FsUtils.exists).toHaveBeenCalledWith(configPath);
      expect(Logger.error).toHaveBeenCalledWith('Configuration already exists');
      expect(Logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Use --force to overwrite')
      );
      expect(ConfigManager.initializeConfig).not.toHaveBeenCalled();
    });

    it('should exit with error for invalid project type', async () => {
      // Arrange
      (FsUtils.exists as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(
        command.parseAsync(['node', 'overture', '--type', 'invalid-type'])
      ).rejects.toThrow('process.exit: 1');

      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid project type: invalid-type')
      );
      expect(Logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Valid types:')
      );
      expect(ConfigManager.initializeConfig).not.toHaveBeenCalled();
    });

    it('should display valid project types on invalid type error', async () => {
      // Arrange
      (FsUtils.exists as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(
        command.parseAsync(['node', 'overture', '--type', 'bad-type'])
      ).rejects.toThrow('process.exit: 1');

      expect(Logger.info).toHaveBeenCalledWith(
        expect.stringMatching(/Valid types:.*python-backend.*typescript-frontend/)
      );
    });

    it('should exit with error when ConfigManager.initializeConfig fails', async () => {
      // Arrange
      (FsUtils.exists as jest.Mock).mockResolvedValue(false);
      (ConfigManager.initializeConfig as jest.Mock).mockRejectedValue(
        new Error('Failed to write configuration file')
      );

      // Act & Assert
      await expect(
        command.parseAsync(['node', 'overture', '--type', 'python-backend'])
      ).rejects.toThrow('process.exit: 1');

      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initialize configuration')
      );
      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to write configuration file')
      );
    });

    it('should handle errors with exitCode property', async () => {
      // Arrange
      const errorWithExitCode = new Error('Custom error') as Error & { exitCode: number };
      errorWithExitCode.exitCode = 2;

      (FsUtils.exists as jest.Mock).mockResolvedValue(false);
      (ConfigManager.initializeConfig as jest.Mock).mockRejectedValue(errorWithExitCode);

      // Act & Assert
      await expect(
        command.parseAsync(['node', 'overture', '--type', 'python-backend'])
      ).rejects.toThrow('process.exit: 2');

      expect(Logger.error).toHaveBeenCalled();
    });

    it('should default to exit code 1 when error has no exitCode', async () => {
      // Arrange
      (FsUtils.exists as jest.Mock).mockResolvedValue(false);
      (ConfigManager.initializeConfig as jest.Mock).mockRejectedValue(
        new Error('Generic error')
      );

      // Act & Assert
      await expect(
        command.parseAsync(['node', 'overture', '--type', 'python-backend'])
      ).rejects.toThrow('process.exit: 1');
    });
  });

  // ============================================================================
  // Command Configuration Tests
  // ============================================================================
  describe('Command configuration', () => {
    it('should have correct command description', () => {
      expect(command.description()).toBe('Initialize .overture/config.yaml with defaults');
    });

    it('should register --type option', () => {
      const typeOption = command.options.find(opt => opt.long === '--type');
      expect(typeOption).toBeDefined();
      expect(typeOption?.short).toBe('-t');
      expect(typeOption?.description).toContain('Project type');
    });

    it('should register --force option', () => {
      const forceOption = command.options.find(opt => opt.long === '--force');
      expect(forceOption).toBeDefined();
      expect(forceOption?.short).toBe('-f');
      expect(forceOption?.description).toContain('Overwrite existing configuration');
    });

    it('should have command name "init"', () => {
      expect(command.name()).toBe('init');
    });
  });

  // ============================================================================
  // Integration Scenarios
  // ============================================================================
  describe('Integration scenarios', () => {
    it('should handle complete interactive flow', async () => {
      // Arrange
      const mockConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'interactive-project', type: 'fullstack' },
        plugins: {},
        mcp: {},
      };

      (FsUtils.exists as jest.Mock).mockResolvedValue(false);
      (Prompts.select as jest.Mock).mockResolvedValue('fullstack');
      (ConfigManager.initializeConfig as jest.Mock).mockResolvedValue(mockConfig);

      // Act
      await command.parseAsync(['node', 'overture']);

      // Assert
      expect(Prompts.select).toHaveBeenCalled();
      expect(Logger.info).toHaveBeenCalledWith('Initializing Overture configuration...');
      expect(ConfigManager.initializeConfig).toHaveBeenCalledWith(
        process.cwd(),
        'fullstack'
      );
      expect(Logger.success).toHaveBeenCalledWith('Configuration created!');
    });

    it('should validate project type from prompt result', async () => {
      // Arrange
      const mockConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project', type: 'python-backend' },
        plugins: {},
        mcp: {},
      };

      (FsUtils.exists as jest.Mock).mockResolvedValue(false);
      (Prompts.select as jest.Mock).mockResolvedValue('python-backend');
      (ConfigManager.initializeConfig as jest.Mock).mockResolvedValue(mockConfig);

      // Act
      await command.parseAsync(['node', 'overture']);

      // Assert
      // Should not throw validation error for valid type from prompt
      expect(ConfigManager.initializeConfig).toHaveBeenCalled();
      expect(Logger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Invalid project type')
      );
    });

    it('should check config existence before prompting', async () => {
      // Arrange
      const configPath = path.join(process.cwd(), CONFIG_PATH);
      (FsUtils.exists as jest.Mock).mockResolvedValue(true);

      // Act & Assert
      await expect(
        command.parseAsync(['node', 'overture'])
      ).rejects.toThrow('process.exit: 1');

      expect(FsUtils.exists).toHaveBeenCalledWith(configPath);
      expect(Prompts.select).not.toHaveBeenCalled();
      expect(Logger.error).toHaveBeenCalledWith('Configuration already exists');
    });

    it('should pass all PROJECT_TYPES as prompt choices', async () => {
      // Arrange
      const mockConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project', type: 'data-science' },
        plugins: {},
        mcp: {},
      };

      (FsUtils.exists as jest.Mock).mockResolvedValue(false);
      (Prompts.select as jest.Mock).mockResolvedValue('data-science');
      (ConfigManager.initializeConfig as jest.Mock).mockResolvedValue(mockConfig);

      // Act
      await command.parseAsync(['node', 'overture']);

      // Assert
      const promptCall = (Prompts.select as jest.Mock).mock.calls[0];
      const choices = promptCall[1];
      
      // Verify all PROJECT_TYPES are included
      PROJECT_TYPES.forEach(type => {
        expect(choices).toContainEqual({ name: type, value: type });
      });
    });
  });
});
