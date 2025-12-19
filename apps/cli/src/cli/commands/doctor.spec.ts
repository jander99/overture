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
      expect(command.description()).toBe('Check system for installed clients and MCP servers');
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

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(mockDiscoveryReport);
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.discoveryService.discoverAll).toHaveBeenCalled();
      expect(deps.process.exit).toHaveBeenCalledWith(0);
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

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(mockDiscoveryReport);
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(null);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.output.success).toHaveBeenCalledWith(
        expect.stringContaining('claude-code')
      );
      expect(deps.output.success).toHaveBeenCalledWith(
        expect.stringContaining('1.0.0')
      );
      expect(deps.process.exit).toHaveBeenCalledWith(0);
    });

    it('should display not-found clients with recommendations', async () => {
      // Arrange
      const mockDiscoveryReport = createMockDiscoveryReport({
        clients: [createNotFoundClient('vscode')],
      });

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(mockDiscoveryReport);
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining('vscode')
      );
      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining('not installed')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('code.visualstudio.com')
      );
      expect(deps.process.exit).toHaveBeenCalledWith(0);
    });

    it('should display skipped clients', async () => {
      // Arrange
      const mockDiscoveryReport = createMockDiscoveryReport({
        clients: [createSkippedClient('cursor')],
      });

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(mockDiscoveryReport);
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('cursor')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('skipped')
      );
      expect(deps.process.exit).toHaveBeenCalledWith(0);
    });
  });

  describe('platform information', () => {
    it('should display WSL2 environment information when detected', async () => {
      // Arrange
      const mockDiscoveryReport = createWSL2Report('Ubuntu-22.04', '/mnt/c/Users/TestUser');

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(mockDiscoveryReport);
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('WSL2')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Ubuntu-22.04')
      );
      expect(deps.process.exit).toHaveBeenCalledWith(0);
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

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(mockDiscoveryReport);
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(null);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.output.success).toHaveBeenCalledWith(
        expect.stringContaining('[WSL2: Windows]')
      );
      expect(deps.process.exit).toHaveBeenCalledWith(0);
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

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(mockDiscoveryReport);
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(mockUserConfig);
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);
      vi.mocked(deps.process.commandExists).mockResolvedValue(true);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.process.commandExists).toHaveBeenCalledWith('npx');
      expect(deps.output.success).toHaveBeenCalledWith(
        expect.stringContaining('filesystem')
      );
      expect(deps.output.success).toHaveBeenCalledWith(
        expect.stringContaining('(found)')
      );
      expect(deps.process.exit).toHaveBeenCalledWith(0);
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

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(mockDiscoveryReport);
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue('/test/project');
      vi.mocked(deps.configLoader.loadProjectConfig).mockResolvedValue(mockProjectConfig);
      vi.mocked(deps.process.commandExists).mockResolvedValue(false);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.process.commandExists).toHaveBeenCalledWith('uvx');
      expect(deps.output.warn).toHaveBeenCalledWith(
        expect.stringContaining('python-repl')
      );
      expect(deps.output.warn).toHaveBeenCalledWith(
        expect.stringContaining('(not found)')
      );
      expect(deps.process.exit).toHaveBeenCalledWith(0);
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

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(mockDiscoveryReport);
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(mockUserConfig);
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);
      vi.mocked(deps.process.commandExists).mockResolvedValue(false);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://docs.astral.sh/uv/')
      );
      expect(deps.process.exit).toHaveBeenCalledWith(0);
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

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(mockDiscoveryReport);
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(null);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor', '--json']);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"environment"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"clients"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"summary"')
      );
      // Should not call output methods in JSON mode
      expect(deps.output.info).not.toHaveBeenCalled();
      expect(deps.process.exit).toHaveBeenCalledWith(0);
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

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(mockDiscoveryReport);
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(null);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor', '--json']);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"clientsDetected"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"clientsMissing"')
      );
      expect(deps.process.exit).toHaveBeenCalledWith(0);
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

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(mockDiscoveryReport);
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(null);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor', '--verbose']);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Windows path:')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('C:\\Program Files\\VSCode\\code.exe')
      );
      expect(deps.process.exit).toHaveBeenCalledWith(0);
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
              warnings: ['Version could not be determined', 'Config file not found'],
            },
            source: 'linux-native' as const,
            environment: 'linux' as const,
          },
        ],
      };

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(mockDiscoveryReport);
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(null);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor', '--verbose']);

      // Assert
      expect(deps.output.warn).toHaveBeenCalledWith(
        expect.stringContaining('Version could not be determined')
      );
      expect(deps.output.warn).toHaveBeenCalledWith(
        expect.stringContaining('Config file not found')
      );
      expect(deps.process.exit).toHaveBeenCalledWith(0);
    });

    it('should not show warnings in non-verbose mode', async () => {
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

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(mockDiscoveryReport);
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(null);
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(null);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert - warn should not be called for client warnings (only MCP warnings)
      expect(deps.output.warn).not.toHaveBeenCalled();
      expect(deps.process.exit).toHaveBeenCalledWith(0);
    });
  });

  describe('error handling', () => {
    it('should handle discoveryService.discoverAll() errors', async () => {
      // Arrange
      vi.mocked(deps.discoveryService.discoverAll).mockRejectedValue(
        new Error('Discovery failed')
      );

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.process.exit).toHaveBeenCalledWith(1);
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

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(mockDiscoveryReport);
      vi.mocked(deps.configLoader.loadUserConfig).mockRejectedValue(
        new Error('Config load failed')
      );
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.process.exit).toHaveBeenCalledWith(1);
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

      vi.mocked(deps.discoveryService.discoverAll).mockResolvedValue(mockDiscoveryReport);
      vi.mocked(deps.configLoader.loadUserConfig).mockResolvedValue(mockUserConfig);
      vi.mocked(deps.pathResolver.findProjectRoot).mockReturnValue(null);
      vi.mocked(deps.process.commandExists).mockRejectedValue(
        new Error('Command check failed')
      );

      const command = createDoctorCommand(deps);

      // Act
      await command.parseAsync(['node', 'doctor']);

      // Assert
      expect(deps.process.exit).toHaveBeenCalledWith(1);
    });
  });
});
