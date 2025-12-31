/**
 * Doctor Command Tests
 *
 * Comprehensive tests for the `overture doctor` command.
 *
 * Test Coverage:
 * - Client detection and version reporting
 * - Platform information (OS, WSL2 detection)
 * - MCP server availability checks
 * - Output modes (default, JSON, verbose)
 * - Error handling for discovery failures
 * - Edge cases (no clients, invalid formats)
 *
 * @see apps/cli/src/cli/commands/doctor.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SpyInstance } from 'vitest';
import { createDoctorCommand } from './doctor';
import type { AppDependencies } from '../../composition-root';
import { createMockAppDependencies } from '../../test-utils/app-dependencies.mock';
import {
  createMockDiscoveryReport,
  createFoundClient,
  createNotFoundClient,
  createSkippedClient,
  createWSL2Report,
} from '../../test-utils/test-fixtures';

describe('doctor command', () => {
  let deps: AppDependencies;
  let consoleLogSpy: SpyInstance;

  beforeEach(() => {
    deps = createMockAppDependencies();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic command structure', () => {
    it('should create a command named "doctor"', () => {
      const command = createDoctorCommand(deps);
      expect(command.name()).toBe('doctor');
    });

    it('should have a description', () => {
      const command = createDoctorCommand(deps);
      expect(command.description()).toBe(
        'Check system for installed clients and MCP servers',
      );
    });

    it('should support --json option', () => {
      const command = createDoctorCommand(deps);
      const options = command.options;

      const jsonOption = options.find((opt) => opt.long === '--json');
      expect(jsonOption).toBeDefined();
      expect(jsonOption?.description).toBe('Output results as JSON');
    });

    it('should support --verbose option', () => {
      const command = createDoctorCommand(deps);
      const options = command.options;

      const verboseOption = options.find((opt) => opt.long === '--verbose');
      expect(verboseOption).toBeDefined();
      expect(verboseOption?.description).toBe('Show detailed output');
    });

    it('should support --wsl2 and --no-wsl2 options', () => {
      const command = createDoctorCommand(deps);
      const options = command.options;

      const wsl2Option = options.find((opt) => opt.long === '--wsl2');
      expect(wsl2Option).toBeDefined();
      expect(wsl2Option?.description).toBe('Force WSL2 detection mode');

      const noWsl2Option = options.find((opt) => opt.long === '--no-wsl2');
      expect(noWsl2Option).toBeDefined();
      expect(noWsl2Option?.description).toBe('Disable WSL2 detection');
    });
  });

  describe('client detection', () => {
    it('should call discoveryService.discoverAll() to detect clients', async () => {
      // Arrange
      const mockDiscoveryReport = createMockDiscoveryReport();

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.discoveryService.discoverAll).toHaveBeenCalled();
    });

    it('should display found clients with versions', async () => {
      // Arrange
      const mockDiscoveryReport = createMockDiscoveryReport({
        clients: [
          createFoundClient('claude-code', {
            detection: {
              status: 'found',
              binaryPath: '/usr/local/bin/claude',
              version: '1.0.0',
              warnings: [],
            },
          }),
        ],
      });

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(null);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.output.success).toHaveBeenCalledWith(
        expect.stringContaining('✓ claude-code (1.0.0)'),
      );
    });

    it('should display not-found clients with recommendations', async () => {
      // Arrange
      const mockDiscoveryReport = createMockDiscoveryReport({
        clients: [createNotFoundClient('copilot-cli')],
      });

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining('✗ copilot-cli - not installed'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('npm install -g @github/copilot'),
      );
    });

    it('should display skipped clients', async () => {
      // Arrange
      const mockDiscoveryReport = createMockDiscoveryReport({
        clients: [createSkippedClient('opencode')],
      });

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('○ opencode - skipped'),
      );
    });
  });

  describe('platform information', () => {
    it('should display WSL2 environment information when detected', async () => {
      // Arrange
      const mockDiscoveryReport = createWSL2Report(
        'Ubuntu-22.04',
        '/mnt/c/Users/TestUser',
      );

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('WSL2'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Ubuntu-22.04'),
      );
    });

    it('should show WSL2 Windows client detections', async () => {
      // Arrange
      const mockDiscoveryReport = {
        environment: {
          platform: 'linux' as const,
          isWSL2: true,
          wsl2Info: {
            distroName: 'Ubuntu',
          },
        },
        clients: [
          {
            client: 'vscode' as const,
            detection: {
              status: 'found' as const,
              binaryPath: '/mnt/c/Program Files/VSCode/code.exe',
              version: '1.85.0',
              warnings: [],
            },
            source: 'wsl2-fallback' as const,
            environment: 'windows' as const,
            windowsPath: 'C:\\Program Files\\VSCode\\code.exe',
          },
        ],
      };

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(null);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.output.success).toHaveBeenCalledWith(
        expect.stringContaining('[WSL2: Windows]'),
      );
    });
  });

  describe('MCP server availability', () => {
    it('should check MCP server command availability from user config', async () => {
      // Arrange
      const mockDiscoveryReport = {
        environment: {
          platform: 'linux' as const,
          isWSL2: false,
        },
        clients: [],
      };

      const mockUserConfig = {
        version: '1.0' as const,
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
          },
        },
      };

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(
        mockUserConfig,
      );
      vi.mocked(deps.configLoader.mergeConfigs).mockReturnValue(mockUserConfig);
      vi.mocked(deps.configLoader.getMcpSources).mockReturnValue({
        filesystem: 'global',
      });
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);
      vi.mocked(deps.process.commandExists).mockResolvedValue(true);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.process.commandExists).toHaveBeenCalledWith('npx');
      expect(deps.output.success).toHaveBeenCalledWith(
        expect.stringContaining('✓ filesystem - npx (found)'),
      );
    });

    it('should check MCP server command availability from project config', async () => {
      // Arrange
      const mockDiscoveryReport = {
        environment: {
          platform: 'linux' as const,
          isWSL2: false,
        },
        clients: [],
      };

      const mockProjectConfig = {
        version: '1.0' as const,
        mcp: {
          'python-repl': {
            command: 'uvx',
            args: ['mcp-server-python-repl'],
          },
        },
      };

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(
        '/test/project',
      );
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue(
        mockProjectConfig,
      );
      vi.mocked(deps.configLoader.mergeConfigs).mockReturnValue(
        mockProjectConfig,
      );
      vi.mocked(deps.configLoader.getMcpSources).mockReturnValue({
        'python-repl': 'project',
      });
      vi.mocked(deps.process.commandExists).mockResolvedValue(false);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.process.commandExists).toHaveBeenCalledWith('uvx');
      expect(deps.output.warn).toHaveBeenCalledWith(
        expect.stringContaining('⚠ python-repl - uvx (not found)'),
      );
    });

    it('should display MCP installation recommendations for missing commands', async () => {
      // Arrange
      const mockDiscoveryReport = {
        environment: {
          platform: 'linux' as const,
          isWSL2: false,
        },
        clients: [],
      };

      const mockUserConfig = {
        version: '1.0' as const,
        mcp: {
          filesystem: {
            command: 'uvx',
            args: ['mcp-server-filesystem'],
          },
        },
      };

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(
        mockUserConfig,
      );
      vi.mocked(deps.configLoader.mergeConfigs).mockReturnValue(mockUserConfig);
      vi.mocked(deps.configLoader.getMcpSources).mockReturnValue({
        filesystem: 'global',
      });
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);
      vi.mocked(deps.process.commandExists).mockResolvedValue(false);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://docs.astral.sh/uv/'),
      );
    });
  });

  describe('JSON output mode', () => {
    it('should output results as JSON when --json flag is provided', async () => {
      // Arrange
      const mockDiscoveryReport = {
        environment: {
          platform: 'linux' as const,
          isWSL2: false,
        },
        clients: [
          {
            client: 'claude-code' as const,
            detection: {
              status: 'found' as const,
              binaryPath: '/usr/bin/claude',
              version: '1.0.0',
              warnings: [],
            },
            source: 'linux-native' as const,
            environment: 'linux' as const,
          },
        ],
      };

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(null);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor', '--json']);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"environment"'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"clients"'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"summary"'),
      );
      // Should not call output methods in JSON mode
      expect(deps.output.info).not.toHaveBeenCalled();
    });

    it('should include summary metrics in JSON output', async () => {
      // Arrange
      const mockDiscoveryReport = {
        environment: {
          platform: 'linux' as const,
          isWSL2: false,
        },
        clients: [
          {
            client: 'claude-code' as const,
            detection: {
              status: 'found' as const,
              binaryPath: '/usr/bin/claude',
              warnings: [],
            },
            source: 'linux-native' as const,
            environment: 'linux' as const,
          },
          {
            client: 'vscode' as const,
            detection: {
              status: 'not-found' as const,
              warnings: [],
            },
            source: 'linux-native' as const,
            environment: 'linux' as const,
          },
        ],
      };

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(null);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor', '--json']);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"clientsDetected"'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"clientsMissing"'),
      );
    });
  });

  describe('verbose mode', () => {
    it('should show Windows paths in verbose mode for WSL2 detections', async () => {
      // Arrange
      const mockDiscoveryReport = {
        environment: {
          platform: 'linux' as const,
          isWSL2: true,
          wsl2Info: {
            distroName: 'Ubuntu',
          },
        },
        clients: [
          {
            client: 'vscode' as const,
            detection: {
              status: 'found' as const,
              binaryPath: '/mnt/c/Program Files/VSCode/code.exe',
              warnings: [],
            },
            source: 'wsl2-fallback' as const,
            environment: 'windows' as const,
            windowsPath: 'C:\\Program Files\\VSCode\\code.exe',
          },
        ],
      };

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(null);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor', '--verbose']);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Windows path:'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('C:\\Program Files\\VSCode\\code.exe'),
      );
    });

    it('should show client warnings in verbose mode', async () => {
      // Arrange
      const mockDiscoveryReport = {
        environment: {
          platform: 'linux' as const,
          isWSL2: false,
        },
        clients: [
          {
            client: 'claude-code' as const,
            detection: {
              status: 'found' as const,
              binaryPath: '/usr/bin/claude',
              warnings: [
                'Version could not be determined',
                'Config file not found',
              ],
            },
            source: 'linux-native' as const,
            environment: 'linux' as const,
          },
        ],
      };

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(null);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor', '--verbose']);

      // Assert
      expect(deps.output.warn).toHaveBeenCalledWith(
        expect.stringContaining('Version could not be determined'),
      );
      expect(deps.output.warn).toHaveBeenCalledWith(
        expect.stringContaining('Config file not found'),
      );
    });

    it('should not show client detection warnings in non-verbose mode', async () => {
      // Arrange
      const mockDiscoveryReport = {
        environment: {
          platform: 'linux' as const,
          isWSL2: false,
        },
        clients: [
          {
            client: 'claude-code' as const,
            detection: {
              status: 'found' as const,
              binaryPath: '/usr/bin/claude',
              warnings: ['Test warning'],
            },
            source: 'linux-native' as const,
            environment: 'linux' as const,
          },
        ],
      };

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockResolvedValue(null);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(null);
      vi.mocked(deps.environment.homedir).mockReturnValue('/home/user');
      // Config repo exists, but agents/models.yaml don't
      vi.mocked(deps.filesystem.exists).mockImplementation(async (path) => {
        if (path === '/home/user/.config/overture') return true;
        if (path === '/home/user/.config/overture/.git') return true;
        if (path === '/home/user/.config/overture/skills') return false;
        if (path === '/home/user/.config/overture/agents') return false;
        if (path === '/home/user/.config/overture/models.yaml') return false;
        return false;
      });
      vi.mocked(deps.filesystem.readdir).mockResolvedValue([]);
      vi.mocked(deps.process.exec).mockResolvedValue({
        stdout: 'https://github.com/user/repo.git',
        stderr: '',
        exitCode: 0,
      }); // Git remote configured

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert - client detection warnings should not be shown, but infra warnings (skills, agents, models) should be shown
      expect(deps.output.warn).toHaveBeenCalled();
      expect(deps.output.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Test warning'),
      );
    });
  });

  describe('error handling', () => {
    it('should handle discoveryService.discoverAll() errors', async () => {
      // Arrange
      vi.mocked(deps.discoveryService.discoverAll).mockRejectedValue(
        new Error('Discovery failed'),
      );

      const command = createDoctorCommand(deps);

      // Act & Assert
      await expect(command.parseAsync(['node', 'doctor'])).rejects.toThrow(
        'Discovery failed',
      );
    });

    it('should handle config loading errors', async () => {
      // Arrange
      const mockDiscoveryReport = {
        environment: {
          platform: 'linux' as const,
          isWSL2: false,
        },
        clients: [],
      };

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockRejectedValue(
        new Error('Config load failed'),
      );
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);

      const command = createDoctorCommand(deps);

      // Act & Assert
      await expect(command.parseAsync(['node', 'doctor'])).rejects.toThrow(
        'Config load failed',
      );
    });

    it('should handle MCP command check errors', async () => {
      // Arrange
      const mockDiscoveryReport = {
        environment: {
          platform: 'linux' as const,
          isWSL2: false,
        },
        clients: [],
      };

      const mockUserConfig = {
        version: '1.0' as const,
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
          },
        },
      };

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(
        mockUserConfig,
      );
      vi.mocked(deps.configLoader.mergeConfigs).mockReturnValue(mockUserConfig);
      vi.mocked(deps.configLoader.getMcpSources).mockReturnValue({
        filesystem: 'global',
      });
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);
      vi.mocked(deps.process.commandExists).mockRejectedValue(
        new Error('Command check failed'),
      );

      const command = createDoctorCommand(deps);

      // Act & Assert
      await expect(command.parseAsync(['node', 'doctor'])).rejects.toThrow(
        'Command check failed',
      );
    });
  });

  describe('config repo check', () => {
    it('should check if config repo exists', async () => {
      // Arrange
      const mockDiscoveryReport = createMockDiscoveryReport();
      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockResolvedValue(null);
      vi.mocked(deps.environment.homedir).mockReturnValue('/home/user');
      vi.mocked(deps.filesystem.exists).mockImplementation(async (path) => {
        if (path === '/home/user/.config/overture') return true;
        if (path === '/home/user/.config/overture/skills') return true;
        return false;
      });

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.filesystem.exists).toHaveBeenCalledWith(
        '/home/user/.config/overture',
      );
      expect(deps.filesystem.exists).toHaveBeenCalledWith(
        '/home/user/.config/overture/skills',
      );
    });

    it('should display config repo found message when repo exists', async () => {
      // Arrange
      const mockDiscoveryReport = createMockDiscoveryReport();
      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockResolvedValue(null);
      vi.mocked(deps.environment.homedir).mockReturnValue('/home/user');
      vi.mocked(deps.filesystem.exists).mockImplementation(async (path) => {
        if (path === '/home/user/.config/overture') return true;
        if (path === '/home/user/.config/overture/skills') return true;
        return false;
      });

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.output.success).toHaveBeenCalledWith(
        expect.stringContaining('Config repo'),
      );
    });

    it('should display warning when config repo does not exist', async () => {
      // Arrange
      const mockDiscoveryReport = createMockDiscoveryReport();
      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockResolvedValue(null);
      vi.mocked(deps.environment.homedir).mockReturnValue('/home/user');
      vi.mocked(deps.filesystem.exists).mockResolvedValue(false);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.output.warn).toHaveBeenCalledWith(
        expect.stringContaining('Config repo not found'),
      );
    });

    it('should display warning when skills directory does not exist', async () => {
      // Arrange
      const mockDiscoveryReport = createMockDiscoveryReport();
      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockResolvedValue(null);
      vi.mocked(deps.environment.homedir).mockReturnValue('/home/user');
      vi.mocked(deps.filesystem.exists).mockImplementation(async (path) => {
        if (path === '/home/user/.config/overture') return true;
        if (path === '/home/user/.config/overture/skills') return false;
        return false;
      });

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.output.warn).toHaveBeenCalledWith(
        expect.stringContaining('Skills directory not found'),
      );
    });

    it('should include config repo status in JSON output', async () => {
      // Arrange
      const mockDiscoveryReport = createMockDiscoveryReport();
      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockResolvedValue(null);
      vi.mocked(deps.environment.homedir).mockReturnValue('/home/user');
      vi.mocked(deps.filesystem.exists).mockImplementation(async (path) => {
        if (path === '/home/user/.config/overture') return true;
        if (path === '/home/user/.config/overture/skills') return true;
        return false;
      });

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor', '--json']);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"configRepo"'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"exists"'),
      );
    });

    it('should show config repo status in summary', async () => {
      // Arrange
      const mockDiscoveryReport = createMockDiscoveryReport();
      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockResolvedValue(null);
      vi.mocked(deps.environment.homedir).mockReturnValue('/home/user');
      vi.mocked(deps.filesystem.exists).mockImplementation(async (path) => {
        if (path === '/home/user/.config/overture') return true;
        if (path === '/home/user/.config/overture/skills') return true;
        return false;
      });

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Config repo:'),
      );
    });

    it('should check if config repo is a git repository', async () => {
      // Arrange
      const mockDiscoveryReport = createMockDiscoveryReport();
      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockResolvedValue(null);
      vi.mocked(deps.environment.homedir).mockReturnValue('/home/user');
      vi.mocked(deps.filesystem.exists).mockImplementation(async (path) => {
        if (path === '/home/user/.config/overture') return true;
        if (path === '/home/user/.config/overture/.git') return true;
        if (path === '/home/user/.config/overture/skills') return true;
        return false;
      });

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.filesystem.exists).toHaveBeenCalledWith(
        '/home/user/.config/overture/.git',
      );
    });

    it('should display git repository status when it is a git repo', async () => {
      // Arrange
      const mockDiscoveryReport = createMockDiscoveryReport();
      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockResolvedValue(null);
      vi.mocked(deps.environment.homedir).mockReturnValue('/home/user');
      vi.mocked(deps.filesystem.exists).mockImplementation(async (path) => {
        if (path === '/home/user/.config/overture') return true;
        if (path === '/home/user/.config/overture/.git') return true;
        if (path === '/home/user/.config/overture/skills') return true;
        return false;
      });
      vi.mocked(deps.process.exec).mockResolvedValue({
        stdout: 'https://github.com/user/overture-config.git',
        stderr: '',
        exitCode: 0,
      });

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.output.success).toHaveBeenCalledWith(
        expect.stringContaining('Git repository'),
      );
    });

    it('should display warning when config repo is not a git repository', async () => {
      // Arrange
      const mockDiscoveryReport = createMockDiscoveryReport();
      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockResolvedValue(null);
      vi.mocked(deps.environment.homedir).mockReturnValue('/home/user');
      vi.mocked(deps.filesystem.exists).mockImplementation(async (path) => {
        if (path === '/home/user/.config/overture') return true;
        if (path === '/home/user/.config/overture/.git') return false;
        if (path === '/home/user/.config/overture/skills') return true;
        return false;
      });

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.output.warn).toHaveBeenCalledWith(
        expect.stringContaining('Not a git repository'),
      );
    });

    it('should check for git remote when config repo is a git repository', async () => {
      // Arrange
      const mockDiscoveryReport = createMockDiscoveryReport();
      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockResolvedValue(null);
      vi.mocked(deps.environment.homedir).mockReturnValue('/home/user');
      vi.mocked(deps.filesystem.exists).mockImplementation(async (path) => {
        if (path === '/home/user/.config/overture') return true;
        if (path === '/home/user/.config/overture/.git') return true;
        if (path === '/home/user/.config/overture/skills') return true;
        return false;
      });
      vi.mocked(deps.process.exec).mockResolvedValue({
        stdout: 'https://github.com/user/overture-config.git',
        stderr: '',
        exitCode: 0,
      });

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.process.exec).toHaveBeenCalledWith('git', [
        '-C',
        '/home/user/.config/overture',
        'remote',
        'get-url',
        'origin',
      ]);
    });

    it('should display git remote when configured', async () => {
      // Arrange
      const mockDiscoveryReport = createMockDiscoveryReport();
      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockResolvedValue(null);
      vi.mocked(deps.environment.homedir).mockReturnValue('/home/user');
      vi.mocked(deps.filesystem.exists).mockImplementation(async (path) => {
        if (path === '/home/user/.config/overture') return true;
        if (path === '/home/user/.config/overture/.git') return true;
        if (path === '/home/user/.config/overture/skills') return true;
        return false;
      });
      vi.mocked(deps.process.exec).mockResolvedValue({
        stdout: 'https://github.com/user/overture-config.git\n',
        stderr: '',
        exitCode: 0,
      });

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.output.success).toHaveBeenCalledWith(
        expect.stringContaining('Remote configured'),
      );
      expect(deps.output.success).toHaveBeenCalledWith(
        expect.stringContaining('https://github.com/user/overture-config.git'),
      );
    });

    it('should display warning when git remote is not configured', async () => {
      // Arrange
      const mockDiscoveryReport = createMockDiscoveryReport();
      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockResolvedValue(null);
      vi.mocked(deps.environment.homedir).mockReturnValue('/home/user');
      vi.mocked(deps.filesystem.exists).mockImplementation(async (path) => {
        if (path === '/home/user/.config/overture') return true;
        if (path === '/home/user/.config/overture/.git') return true;
        if (path === '/home/user/.config/overture/skills') return true;
        return false;
      });
      vi.mocked(deps.process.exec).mockResolvedValue({
        stdout: '',
        stderr: 'fatal: No such remote',
        exitCode: 128,
      });

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.output.warn).toHaveBeenCalledWith(
        expect.stringContaining('No git remote configured'),
      );
    });

    it('should include git status in JSON output', async () => {
      // Arrange
      const mockDiscoveryReport = createMockDiscoveryReport();
      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockResolvedValue(null);
      vi.mocked(deps.environment.homedir).mockReturnValue('/home/user');
      vi.mocked(deps.filesystem.exists).mockImplementation(async (path) => {
        if (path === '/home/user/.config/overture') return true;
        if (path === '/home/user/.config/overture/.git') return true;
        if (path === '/home/user/.config/overture/skills') return true;
        return false;
      });
      vi.mocked(deps.process.exec).mockResolvedValue({
        stdout: 'https://github.com/user/overture-config.git',
        stderr: '',
        exitCode: 0,
      });

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor', '--json']);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"isGitRepo"'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"gitRemote"'),
      );
    });

    it('should get local git hash', async () => {
      // Arrange
      const mockDiscoveryReport = createMockDiscoveryReport();
      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockResolvedValue(null);
      vi.mocked(deps.environment.homedir).mockReturnValue('/home/user');
      vi.mocked(deps.filesystem.exists).mockImplementation(async (path) => {
        if (path === '/home/user/.config/overture') return true;
        if (path === '/home/user/.config/overture/.git') return true;
        return false;
      });
      vi.mocked(deps.process.exec).mockImplementation(
        async (cmd: string, args: string[]) => {
          if (args.includes('rev-parse') && args.includes('HEAD')) {
            return {
              stdout: 'abc123def456\n',
              stderr: '',
              exitCode: 0,
            };
          }
          return { stdout: '', stderr: '', exitCode: 0 };
        },
      );

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.process.exec).toHaveBeenCalledWith('git', [
        '-C',
        '/home/user/.config/overture',
        'rev-parse',
        'HEAD',
      ]);
    });

    it('should get remote git hash and compare with local', async () => {
      // Arrange
      const mockDiscoveryReport = createMockDiscoveryReport();
      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockResolvedValue(null);
      vi.mocked(deps.environment.homedir).mockReturnValue('/home/user');
      vi.mocked(deps.filesystem.exists).mockImplementation(async (path) => {
        if (path === '/home/user/.config/overture') return true;
        if (path === '/home/user/.config/overture/.git') return true;
        return false;
      });
      vi.mocked(deps.process.exec).mockImplementation(
        async (cmd: string, args: string[]) => {
          if (args.includes('remote') && args.includes('get-url')) {
            return {
              stdout: 'https://github.com/user/repo.git\n',
              stderr: '',
              exitCode: 0,
            };
          }
          if (args.includes('rev-parse') && args.includes('HEAD')) {
            return { stdout: 'abc123def456\n', stderr: '', exitCode: 0 };
          }
          if (args.includes('ls-remote')) {
            return {
              stdout: 'abc123def456\tHEAD\n',
              stderr: '',
              exitCode: 0,
            };
          }
          return { stdout: '', stderr: '', exitCode: 0 };
        },
      );

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.process.exec).toHaveBeenCalledWith('git', [
        '-C',
        '/home/user/.config/overture',
        'ls-remote',
        'origin',
        'HEAD',
      ]);
    });

    it('should display in sync status when hashes match', async () => {
      // Arrange
      const mockDiscoveryReport = createMockDiscoveryReport();
      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockResolvedValue(null);
      vi.mocked(deps.environment.homedir).mockReturnValue('/home/user');
      vi.mocked(deps.filesystem.exists).mockImplementation(async (path) => {
        if (path === '/home/user/.config/overture') return true;
        if (path === '/home/user/.config/overture/.git') return true;
        return false;
      });
      vi.mocked(deps.process.exec).mockImplementation(
        async (cmd: string, args: string[]) => {
          if (args.includes('remote') && args.includes('get-url')) {
            return {
              stdout: 'https://github.com/user/repo.git\n',
              stderr: '',
              exitCode: 0,
            };
          }
          if (args.includes('rev-parse') && args.includes('HEAD')) {
            return { stdout: 'abc123def456\n', stderr: '', exitCode: 0 };
          }
          if (args.includes('ls-remote')) {
            return {
              stdout: 'abc123def456\tHEAD\n',
              stderr: '',
              exitCode: 0,
            };
          }
          return { stdout: '', stderr: '', exitCode: 0 };
        },
      );

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.output.success).toHaveBeenCalledWith(
        expect.stringContaining('In sync with remote'),
      );
    });

    it('should display out of sync warning when hashes differ', async () => {
      // Arrange
      const mockDiscoveryReport = createMockDiscoveryReport();
      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockResolvedValue(null);
      vi.mocked(deps.environment.homedir).mockReturnValue('/home/user');
      vi.mocked(deps.filesystem.exists).mockImplementation(async (path) => {
        if (path === '/home/user/.config/overture') return true;
        if (path === '/home/user/.config/overture/.git') return true;
        return false;
      });
      vi.mocked(deps.process.exec).mockImplementation(
        async (cmd: string, args: string[]) => {
          if (args.includes('remote') && args.includes('get-url')) {
            return {
              stdout: 'https://github.com/user/repo.git\n',
              stderr: '',
              exitCode: 0,
            };
          }
          if (args.includes('rev-parse') && args.includes('HEAD')) {
            return { stdout: 'abc123def456\n', stderr: '', exitCode: 0 };
          }
          if (args.includes('ls-remote')) {
            return {
              stdout: 'different789hash\tHEAD\n',
              stderr: '',
              exitCode: 0,
            };
          }
          return { stdout: '', stderr: '', exitCode: 0 };
        },
      );

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.output.warn).toHaveBeenCalledWith(
        expect.stringContaining('Out of sync with remote'),
      );
    });

    it('should count skills in skills directory', async () => {
      // Arrange
      const mockDiscoveryReport = createMockDiscoveryReport();
      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockResolvedValue(null);
      vi.mocked(deps.environment.homedir).mockReturnValue('/home/user');
      vi.mocked(deps.filesystem.exists).mockImplementation(async (path) => {
        if (path === '/home/user/.config/overture') return true;
        if (path === '/home/user/.config/overture/skills') return true;
        if (path === '/home/user/.config/overture/skills/skill1/SKILL.md')
          return true;
        if (path === '/home/user/.config/overture/skills/skill2/SKILL.md')
          return true;
        return false;
      });
      vi.mocked(deps.filesystem.readdir).mockResolvedValue([
        'skill1',
        'skill2',
        'not-a-skill',
      ]);
      vi.mocked(deps.filesystem.stat).mockImplementation(async (path) => ({
        isFile: () => false,
        isDirectory: () =>
          path.includes('skill1') ||
          path.includes('skill2') ||
          path.includes('not-a-skill'),
        size: 0,
        mtime: new Date(),
      }));

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.filesystem.readdir).toHaveBeenCalledWith(
        '/home/user/.config/overture/skills',
      );
    });

    it('should display skill count when skills exist', async () => {
      // Arrange
      const mockDiscoveryReport = createMockDiscoveryReport();
      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(
        mockDiscoveryReport,
      );
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockResolvedValue(null);
      vi.mocked(deps.environment.homedir).mockReturnValue('/home/user');
      vi.mocked(deps.filesystem.exists).mockImplementation(async (path) => {
        if (path === '/home/user/.config/overture') return true;
        if (path === '/home/user/.config/overture/skills') return true;
        if (path === '/home/user/.config/overture/skills/skill1/SKILL.md')
          return true;
        if (path === '/home/user/.config/overture/skills/skill2/SKILL.md')
          return true;
        return false;
      });
      vi.mocked(deps.filesystem.readdir).mockResolvedValue([
        'skill1',
        'skill2',
      ]);
      vi.mocked(deps.filesystem.stat).mockImplementation(async () => ({
        isFile: () => false,
        isDirectory: () => true,
        size: 0,
        mtime: new Date(),
      }));

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.output.success).toHaveBeenCalledWith(
        expect.stringContaining('2 skills'),
      );
    });
  });

  describe('negative test cases', () => {
    it('should handle discovery service returning no clients', async () => {
      // Arrange
      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue({
        environment: {
          platform: 'linux' as const,
          isWSL2: false,
        },
        clients: [],
      });

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert - should complete successfully even with no clients
      expect(deps.discoveryService.discoverAll).toHaveBeenCalled();
      // Command completes without throwing error
    });

    it('should handle invalid JSON format output errors', async () => {
      // Arrange - mock an error in JSON formatting
      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue({
        environment: {
          platform: 'linux' as const,
          isWSL2: false,
        },
        clients: [],
      });

      const command = createDoctorCommand(deps);

      // Act - with invalid format option
      await expect(
        command.parseAsync(['node', 'doctor', '--format', 'invalid']),
      ).rejects.toThrow();
    });
  });
});
