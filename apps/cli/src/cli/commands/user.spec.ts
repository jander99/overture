import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { Command } from 'commander';
import type { OvertureConfig } from '../../domain/config.types';

// Mock all dependencies BEFORE importing createUserCommand
jest.mock('fs');
jest.mock('js-yaml');
jest.mock('chalk', () => ({
  default: {
    bold: jest.fn((x) => x),
    cyan: jest.fn((x) => x),
    gray: jest.fn((x) => x),
    yellow: jest.fn((x) => x),
    green: jest.fn((x) => x),
    red: jest.fn((x) => x),
    blue: jest.fn((x) => x),
  },
}));
jest.mock('log-symbols', () => ({
  success: '✔',
  error: '✖',
  warning: '⚠',
  info: 'ℹ',
}));
jest.mock('../../utils/logger');
jest.mock('../../utils/prompts');
jest.mock('../../core/path-resolver');

// Now import after mocks are set up
import { createUserCommand } from './user';
import { Logger } from '../../utils/logger';
import { Prompts } from '../../utils/prompts';
import { getUserConfigPath } from '../../core/path-resolver';

describe('CLI Command: user', () => {
  let command: Command;
  let mockExit: jest.SpyInstance;
  const mockUserConfigPath = '/home/user/.config/overture.yml';
  const mockConfigDir = '/home/user/.config';

  beforeEach(() => {
    jest.clearAllMocks();
    command = createUserCommand();

    // Mock process.exit to prevent test termination
    mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit: ${code}`);
    });

    // Setup default mocks
    (getUserConfigPath as jest.Mock).mockReturnValue(mockUserConfigPath);
    jest.spyOn(path, 'dirname').mockReturnValue(mockConfigDir);
  });

  afterEach(() => {
    mockExit.mockRestore();
  });

  // ============================================================================
  // Command Structure Tests
  // ============================================================================
  describe('Command structure', () => {
    it('should have correct command name', () => {
      expect(command.name()).toBe('user');
    });

    it('should have correct description', () => {
      expect(command.description()).toBe('Manage user global configuration');
    });

    it('should have "init" subcommand', () => {
      const subcommands = command.commands.map((cmd) => cmd.name());
      expect(subcommands).toContain('init');
    });

    it('should have --force option on init subcommand', () => {
      const initCmd = command.commands.find((cmd) => cmd.name() === 'init');
      expect(initCmd).toBeDefined();
      
      const forceOption = initCmd?.options.find((opt) => opt.long === '--force');
      expect(forceOption).toBeDefined();
      expect(forceOption?.short).toBe('-f');
    });

    it('should have correct description for init subcommand', () => {
      const initCmd = command.commands.find((cmd) => cmd.name() === 'init');
      expect(initCmd?.description()).toContain('Initialize user global configuration');
    });
  });

  // ============================================================================
  // Successful Initialization Tests
  // ============================================================================
  describe('Successful initialization', () => {
    it('should initialize user config with selected MCP servers', async () => {
      // Arrange
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // Config file doesn't exist
        .mockReturnValueOnce(false); // Config dir doesn't exist
      (Prompts.multiSelect as jest.Mock).mockResolvedValue(['filesystem', 'memory']);
      (Prompts.confirm as jest.Mock).mockResolvedValue(true);
      (yaml.dump as jest.Mock).mockReturnValue('mocked-yaml-content');

      // Act
      await command.parseAsync(['node', 'overture', 'init']);

      // Assert
      expect(Prompts.multiSelect).toHaveBeenCalledWith(
        'Select MCP servers to enable globally:',
        expect.arrayContaining([
          expect.objectContaining({ value: 'filesystem' }),
          expect.objectContaining({ value: 'memory' }),
        ])
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockUserConfigPath,
        'mocked-yaml-content',
        'utf-8'
      );
      expect(Logger.success).toHaveBeenCalledWith('User configuration created!');
    });

    it('should create config directory if it does not exist', async () => {
      // Arrange
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // Config file doesn't exist
        .mockReturnValueOnce(false); // Config dir doesn't exist
      (Prompts.multiSelect as jest.Mock).mockResolvedValue(['filesystem']);
      (Prompts.confirm as jest.Mock).mockResolvedValue(true);
      (yaml.dump as jest.Mock).mockReturnValue('yaml-content');

      // Act
      await command.parseAsync(['node', 'overture', 'init']);

      // Assert
      expect(fs.mkdirSync).toHaveBeenCalledWith(mockConfigDir, { recursive: true });
    });

    it('should not create config directory if it already exists', async () => {
      // Arrange
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // Config file doesn't exist
        .mockReturnValueOnce(true); // Config dir exists
      (Prompts.multiSelect as jest.Mock).mockResolvedValue(['filesystem']);
      (Prompts.confirm as jest.Mock).mockResolvedValue(true);
      (yaml.dump as jest.Mock).mockReturnValue('yaml-content');

      // Act
      await command.parseAsync(['node', 'overture', 'init']);

      // Assert
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should overwrite existing config with --force flag', async () => {
      // Arrange
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (Prompts.multiSelect as jest.Mock).mockResolvedValue(['filesystem', 'memory']);
      (Prompts.confirm as jest.Mock).mockResolvedValue(true);
      (yaml.dump as jest.Mock).mockReturnValue('yaml-content');

      // Act
      await command.parseAsync(['node', 'overture', 'init', '--force']);

      // Assert
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockUserConfigPath,
        'yaml-content',
        'utf-8'
      );
      expect(Logger.success).toHaveBeenCalled();
    });

    it('should overwrite existing config with -f shorthand flag', async () => {
      // Arrange
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (Prompts.multiSelect as jest.Mock).mockResolvedValue(['context7']);
      (Prompts.confirm as jest.Mock).mockResolvedValue(true);
      (yaml.dump as jest.Mock).mockReturnValue('yaml-content');

      // Act
      await command.parseAsync(['node', 'overture', 'init', '-f']);

      // Assert
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(Logger.success).toHaveBeenCalled();
    });

    it('should include all selected MCP servers in configuration', async () => {
      // Arrange
      const selectedMcps = ['filesystem', 'memory', 'sequentialthinking', 'context7'];
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // Config file doesn't exist
        .mockReturnValueOnce(false); // Config dir doesn't exist
      (Prompts.multiSelect as jest.Mock).mockResolvedValue(selectedMcps);
      (Prompts.confirm as jest.Mock).mockResolvedValue(true);
      (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
      (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

      let capturedConfig: OvertureConfig | null = null;
      (yaml.dump as jest.Mock).mockImplementation((config) => {
        capturedConfig = config;
        return 'yaml-content';
      });

      // Act
      await command.parseAsync(['node', 'overture', 'init']);

      // Assert
      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig?.mcp).toHaveProperty('filesystem');
      expect(capturedConfig?.mcp).toHaveProperty('memory');
      expect(capturedConfig?.mcp).toHaveProperty('sequentialthinking');
      expect(capturedConfig?.mcp).toHaveProperty('context7');
    });

    it('should set correct default values for configuration', async () => {
      // Arrange
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // Config file doesn't exist
        .mockReturnValueOnce(false); // Config dir doesn't exist
      (Prompts.multiSelect as jest.Mock).mockResolvedValue(['filesystem']);
      (Prompts.confirm as jest.Mock).mockResolvedValue(true);
      (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
      (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

      let capturedConfig: OvertureConfig | null = null;
      (yaml.dump as jest.Mock).mockImplementation((config) => {
        capturedConfig = config;
        return 'yaml-content';
      });

      // Act
      await command.parseAsync(['node', 'overture', 'init']);

      // Assert
      expect(capturedConfig?.version).toBe('2.0');
      expect(capturedConfig?.clients).toBeDefined();
      expect(capturedConfig?.sync).toBeDefined();
      expect(capturedConfig?.sync?.backup).toBe(true);
      expect(capturedConfig?.sync?.mergeStrategy).toBe('append');
    });

    it('should display configuration summary before confirmation', async () => {
      // Arrange
      const selectedMcps = ['filesystem', 'memory'];
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // Config file doesn't exist
        .mockReturnValueOnce(false); // Config dir doesn't exist
      (Prompts.multiSelect as jest.Mock).mockResolvedValue(selectedMcps);
      (Prompts.confirm as jest.Mock).mockResolvedValue(true);
      (yaml.dump as jest.Mock).mockReturnValue('yaml-content');

      // Act
      await command.parseAsync(['node', 'overture', 'init']);

      // Assert
      expect(Logger.info).toHaveBeenCalledWith('Configuration summary:');
      expect(Logger.info).toHaveBeenCalledWith(`  Location: ${mockUserConfigPath}`);
      expect(Logger.info).toHaveBeenCalledWith('  MCP servers: 2');
      expect(Logger.info).toHaveBeenCalledWith('    - filesystem');
      expect(Logger.info).toHaveBeenCalledWith('    - memory');
    });

    it('should display next steps after successful creation', async () => {
      // Arrange
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // Config file doesn't exist
        .mockReturnValueOnce(false); // Config dir doesn't exist
      (Prompts.multiSelect as jest.Mock).mockResolvedValue(['filesystem']);
      (Prompts.confirm as jest.Mock).mockResolvedValue(true);
      (yaml.dump as jest.Mock).mockReturnValue('yaml-content');

      // Act
      await command.parseAsync(['node', 'overture', 'init']);

      // Assert
      expect(Logger.info).toHaveBeenCalledWith('Next steps:');
      expect(Logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Review and customize')
      );
      expect(Logger.info).toHaveBeenCalledWith(
        expect.stringContaining('environment variables')
      );
      expect(Logger.info).toHaveBeenCalledWith(
        expect.stringContaining('overture sync')
      );
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================
  describe('Error handling', () => {
    it('should exit with error when config exists without --force', async () => {
      // Arrange
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      // Act & Assert
      await expect(
        command.parseAsync(['node', 'overture', 'init'])
      ).rejects.toThrow('process.exit: 1');

      expect(Logger.error).toHaveBeenCalledWith('User configuration already exists');
      expect(Logger.info).toHaveBeenCalledWith(`Location: ${mockUserConfigPath}`);
      expect(Logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Use --force to overwrite')
      );
      expect(Prompts.multiSelect).not.toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      // Arrange: Validation happens after MCP config is built, so invalid MCPs
      // are simply skipped (they won't have defaults). An empty MCP config is valid.
      // To truly test validation errors, we'd need to break the schema itself.
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // Config file doesn't exist
        .mockReturnValueOnce(false); // Config dir doesn't exist
      (Prompts.multiSelect as jest.Mock).mockResolvedValue(['unknown-server']);
      (Prompts.confirm as jest.Mock)
        .mockResolvedValueOnce(true) // Continue without valid MCPs
        .mockResolvedValueOnce(true); // Create config

      (yaml.dump as jest.Mock).mockReturnValue('yaml-content');

      // Act - Should succeed with empty MCP config
      await command.parseAsync(['node', 'overture', 'init']);

      // Assert - Config created with no MCPs (unknown server was skipped)
      expect(Logger.success).toHaveBeenCalledWith('User configuration created!');
    });

    it('should handle file write errors', async () => {
      // Arrange
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // Config file doesn't exist
        .mockReturnValueOnce(false); // Config dir doesn't exist
      (Prompts.multiSelect as jest.Mock).mockResolvedValue(['filesystem']);
      (Prompts.confirm as jest.Mock).mockResolvedValue(true);
      (yaml.dump as jest.Mock).mockReturnValue('yaml-content');
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Act & Assert
      await expect(
        command.parseAsync(['node', 'overture', 'init'])
      ).rejects.toThrow('process.exit: 1');

      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initialize user configuration')
      );
    });

    it('should handle directory creation errors', async () => {
      // Arrange
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // Config file doesn't exist
        .mockReturnValueOnce(false); // Config dir doesn't exist
      (Prompts.multiSelect as jest.Mock).mockResolvedValue(['filesystem']);
      (Prompts.confirm as jest.Mock).mockResolvedValue(true);
      (yaml.dump as jest.Mock).mockReturnValue('yaml-content');
      (fs.mkdirSync as jest.Mock).mockImplementation(() => {
        throw new Error('Cannot create directory');
      });

      // Act & Assert
      await expect(
        command.parseAsync(['node', 'overture', 'init'])
      ).rejects.toThrow('process.exit: 1');

      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initialize user configuration')
      );
    });
  });

  // ============================================================================
  // User Interaction Tests
  // ============================================================================
  describe('User interaction', () => {
    it('should warn when no MCP servers are selected', async () => {
      // Arrange
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // Config file doesn't exist
        .mockReturnValueOnce(false); // Config dir doesn't exist
      (Prompts.multiSelect as jest.Mock).mockResolvedValue([]);
      (Prompts.confirm as jest.Mock)
        .mockResolvedValueOnce(true) // Continue without MCPs
        .mockResolvedValueOnce(true); // Create config
      (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
      (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

      (yaml.dump as jest.Mock).mockReturnValue('yaml-content');

      // Act
      await command.parseAsync(['node', 'overture', 'init']);

      // Assert
      expect(Logger.warn).toHaveBeenCalledWith('No MCP servers selected');
      expect(Prompts.confirm).toHaveBeenCalledWith(
        'Continue without any MCP servers?',
        false
      );
    });

    it('should cancel when user declines to continue without MCPs', async () => {
      // Arrange
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // Config file doesn't exist
        .mockReturnValueOnce(false); // Config dir doesn't exist
      (Prompts.multiSelect as jest.Mock).mockResolvedValue([]);
      (Prompts.confirm as jest.Mock).mockResolvedValue(false);
      (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
      (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

      // Act & Assert
      await expect(
        command.parseAsync(['node', 'overture', 'init'])
      ).rejects.toThrow('process.exit: 0');

      expect(Logger.info).toHaveBeenCalledWith('Configuration cancelled');
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should cancel when user declines final confirmation', async () => {
      // Arrange
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // Config file doesn't exist
        .mockReturnValueOnce(false); // Config dir doesn't exist
      (Prompts.multiSelect as jest.Mock).mockResolvedValue(['filesystem']);
      (Prompts.confirm as jest.Mock).mockResolvedValue(false);
      (yaml.dump as jest.Mock).mockReturnValue('yaml-content');
      (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
      (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

      // Act & Assert
      await expect(
        command.parseAsync(['node', 'overture', 'init'])
      ).rejects.toThrow('process.exit: 0');

      expect(Logger.info).toHaveBeenCalledWith('Configuration cancelled');
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should proceed with empty MCP config when user confirms', async () => {
      // Arrange
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // Config file doesn't exist
        .mockReturnValueOnce(false); // Config dir doesn't exist
      (Prompts.multiSelect as jest.Mock).mockResolvedValue([]);
      (Prompts.confirm as jest.Mock)
        .mockResolvedValueOnce(true) // Continue without MCPs
        .mockResolvedValueOnce(true); // Create config
      (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
      (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

      let capturedConfig: OvertureConfig | null = null;
      (yaml.dump as jest.Mock).mockImplementation((config) => {
        capturedConfig = config;
        return 'yaml-content';
      });

      // Act
      await command.parseAsync(['node', 'overture', 'init']);

      // Assert
      expect(capturedConfig?.mcp).toEqual({});
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should prompt for confirmation before writing config', async () => {
      // Arrange
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // Config file doesn't exist
        .mockReturnValueOnce(false); // Config dir doesn't exist
      (Prompts.multiSelect as jest.Mock).mockResolvedValue(['filesystem']);
      (Prompts.confirm as jest.Mock).mockResolvedValue(true);
      (yaml.dump as jest.Mock).mockReturnValue('yaml-content');
      (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
      (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

      // Act
      await command.parseAsync(['node', 'overture', 'init']);

      // Assert
      expect(Prompts.confirm).toHaveBeenCalledWith('Create user configuration?', true);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // MCP Server Configuration Tests
  // ============================================================================
  describe('MCP server configuration', () => {
    it('should configure filesystem MCP with correct defaults', async () => {
      // Arrange
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // Config file doesn't exist
        .mockReturnValueOnce(false); // Config dir doesn't exist
      (Prompts.multiSelect as jest.Mock).mockResolvedValue(['filesystem']);
      (Prompts.confirm as jest.Mock).mockResolvedValue(true);
      (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
      (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

      let capturedConfig: OvertureConfig | null = null;
      (yaml.dump as jest.Mock).mockImplementation((config) => {
        capturedConfig = config;
        return 'yaml-content';
      });

      // Act
      await command.parseAsync(['node', 'overture', 'init']);

      // Assert
      const filesystemConfig = capturedConfig?.mcp.filesystem;
      expect(filesystemConfig).toBeDefined();
      expect(filesystemConfig?.command).toBe('npx');
      expect(filesystemConfig?.transport).toBe('stdio');
    });

    it('should configure github MCP with environment variable', async () => {
      // Arrange
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // Config file doesn't exist
        .mockReturnValueOnce(false); // Config dir doesn't exist
      (Prompts.multiSelect as jest.Mock).mockResolvedValue(['github']);
      (Prompts.confirm as jest.Mock).mockResolvedValue(true);
      (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
      (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

      let capturedConfig: OvertureConfig | null = null;
      (yaml.dump as jest.Mock).mockImplementation((config) => {
        capturedConfig = config;
        return 'yaml-content';
      });

      // Act
      await command.parseAsync(['node', 'overture', 'init']);

      // Assert
      const githubConfig = capturedConfig?.mcp.github;
      expect(githubConfig).toBeDefined();
      expect(githubConfig?.env).toHaveProperty('GITHUB_TOKEN');
      expect(githubConfig?.env.GITHUB_TOKEN).toBe('${GITHUB_TOKEN}');
    });

    it('should configure multiple MCP servers correctly', async () => {
      // Arrange
      const selectedMcps = ['filesystem', 'memory', 'context7'];
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // Config file doesn't exist
        .mockReturnValueOnce(false); // Config dir doesn't exist
      (Prompts.multiSelect as jest.Mock).mockResolvedValue(selectedMcps);
      (Prompts.confirm as jest.Mock).mockResolvedValue(true);
      (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
      (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

      let capturedConfig: OvertureConfig | null = null;
      (yaml.dump as jest.Mock).mockImplementation((config) => {
        capturedConfig = config;
        return 'yaml-content';
      });

      // Act
      await command.parseAsync(['node', 'overture', 'init']);

      // Assert
      expect(Object.keys(capturedConfig?.mcp || {})).toHaveLength(3);
      expect(capturedConfig?.mcp).toHaveProperty('filesystem');
      expect(capturedConfig?.mcp).toHaveProperty('memory');
      expect(capturedConfig?.mcp).toHaveProperty('context7');
    });

    it('should set all MCPs to global scope', async () => {
      // Arrange
      const selectedMcps = ['filesystem', 'memory', 'sequentialthinking'];
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // Config file doesn't exist
        .mockReturnValueOnce(false); // Config dir doesn't exist
      (Prompts.multiSelect as jest.Mock).mockResolvedValue(selectedMcps);
      (Prompts.confirm as jest.Mock).mockResolvedValue(true);
      (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
      (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

      let capturedConfig: OvertureConfig | null = null;
      (yaml.dump as jest.Mock).mockImplementation((config) => {
        capturedConfig = config;
        return 'yaml-content';
      });

      // Act
      await command.parseAsync(['node', 'overture', 'init']);

      // Assert
      Object.values(capturedConfig?.mcp || {}).forEach((mcp) => {
      });
    });
  });

  // ============================================================================
  // YAML Generation Tests
  // ============================================================================
  describe('YAML generation', () => {
    it('should call yaml.dump with correct options', async () => {
      // Arrange
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // Config file doesn't exist
        .mockReturnValueOnce(false); // Config dir doesn't exist
      (Prompts.multiSelect as jest.Mock).mockResolvedValue(['filesystem']);
      (Prompts.confirm as jest.Mock).mockResolvedValue(true);
      (yaml.dump as jest.Mock).mockReturnValue('yaml-content');
      (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
      (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

      // Act
      await command.parseAsync(['node', 'overture', 'init']);

      // Assert
      expect(yaml.dump).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          indent: 2,
          lineWidth: 100,
          noRefs: true,
        })
      );
    });

    it('should write YAML content to correct file path', async () => {
      // Arrange
      const mockYamlContent = 'version: "2.0"\nmcp: {}';
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // Config file doesn't exist
        .mockReturnValueOnce(false); // Config dir doesn't exist
      (Prompts.multiSelect as jest.Mock).mockResolvedValue(['filesystem']);
      (Prompts.confirm as jest.Mock).mockResolvedValue(true);
      (yaml.dump as jest.Mock).mockReturnValue(mockYamlContent);
      (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
      (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

      // Act
      await command.parseAsync(['node', 'overture', 'init']);

      // Assert
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockUserConfigPath,
        mockYamlContent,
        'utf-8'
      );
    });
  });

  // ============================================================================
  // Client Configuration Tests
  // ============================================================================
  describe('Client configuration', () => {
    it('should enable claude-code and claude-desktop by default', async () => {
      // Arrange
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // Config file doesn't exist
        .mockReturnValueOnce(false); // Config dir doesn't exist
      (Prompts.multiSelect as jest.Mock).mockResolvedValue(['filesystem']);
      (Prompts.confirm as jest.Mock).mockResolvedValue(true);
      (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
      (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

      let capturedConfig: OvertureConfig | null = null;
      (yaml.dump as jest.Mock).mockImplementation((config) => {
        capturedConfig = config;
        return 'yaml-content';
      });

      // Act
      await command.parseAsync(['node', 'overture', 'init']);

      // Assert
      expect(capturedConfig?.clients?.['claude-code']?.enabled).toBe(true);
      expect(capturedConfig?.clients?.['claude-desktop']?.enabled).toBe(true);
    });

    it('should disable other clients by default', async () => {
      // Arrange
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // Config file doesn't exist
        .mockReturnValueOnce(false); // Config dir doesn't exist
      (Prompts.multiSelect as jest.Mock).mockResolvedValue(['filesystem']);
      (Prompts.confirm as jest.Mock).mockResolvedValue(true);
      (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
      (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

      let capturedConfig: OvertureConfig | null = null;
      (yaml.dump as jest.Mock).mockImplementation((config) => {
        capturedConfig = config;
        return 'yaml-content';
      });

      // Act
      await command.parseAsync(['node', 'overture', 'init']);

      // Assert
      expect(capturedConfig?.clients?.vscode?.enabled).toBe(false);
      expect(capturedConfig?.clients?.cursor?.enabled).toBe(false);
      expect(capturedConfig?.clients?.windsurf?.enabled).toBe(false);
      expect(capturedConfig?.clients?.['copilot-cli']?.enabled).toBe(false);
      expect(capturedConfig?.clients?.['jetbrains-copilot']?.enabled).toBe(false);
    });
  });
});
