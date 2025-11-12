// Mock chalk using the manual mock file
jest.mock('chalk');

// Mock inquirer
jest.mock('inquirer', () => ({
  prompt: jest.fn(),
}));

// Now safe to import
import { Command } from 'commander';
import { createMcpCommand } from './mcp';
import { Logger } from '../../utils/logger';
import { loadUserConfig, loadProjectConfig } from '../../core/config-loader';
import { adapterRegistry } from '../../adapters/adapter-registry';
import { getPlatform } from '../../core/path-resolver';
import { shouldIncludeMcp } from '../../core/exclusion-filter';
import type { OvertureConfigV2 } from '../../domain/config-v2.types';

// Mock all dependencies
jest.mock('../../utils/logger');
jest.mock('../../utils/prompts');
jest.mock('../../core/config-loader');
jest.mock('../../core/path-resolver');
jest.mock('../../core/exclusion-filter');
jest.mock('../../core/config-manager');

// Mock adapter imports
jest.mock('../../adapters/claude-code-adapter', () => ({
  ClaudeCodeAdapter: jest.fn().mockImplementation(() => ({
    name: 'claude-code',
    schemaRootKey: 'mcpServers',
  })),
}));
jest.mock('../../adapters/claude-desktop-adapter', () => ({
  ClaudeDesktopAdapter: jest.fn().mockImplementation(() => ({
    name: 'claude-desktop',
    schemaRootKey: 'mcpServers',
  })),
}));
jest.mock('../../adapters/vscode-adapter', () => ({
  VSCodeAdapter: jest.fn().mockImplementation(() => ({
    name: 'vscode',
    schemaRootKey: 'servers',
  })),
}));
jest.mock('../../adapters/cursor-adapter', () => ({
  CursorAdapter: jest.fn().mockImplementation(() => ({
    name: 'cursor',
    schemaRootKey: 'mcpServers',
  })),
}));
jest.mock('../../adapters/windsurf-adapter', () => ({
  WindsurfAdapter: jest.fn().mockImplementation(() => ({
    name: 'windsurf',
    schemaRootKey: 'mcpServers',
  })),
}));
jest.mock('../../adapters/copilot-cli-adapter', () => ({
  CopilotCliAdapter: jest.fn().mockImplementation(() => ({
    name: 'copilot-cli',
    schemaRootKey: 'mcpServers',
  })),
}));
jest.mock('../../adapters/jetbrains-copilot-adapter', () => ({
  JetBrainsCopilotAdapter: jest.fn().mockImplementation(() => ({
    name: 'jetbrains-copilot',
    schemaRootKey: 'mcpServers',
  })),
}));

describe('CLI Command: mcp', () => {
  let command: Command;
  let mockExit: jest.SpyInstance;

  // Mock configs
  const mockUserConfig: OvertureConfigV2 = {
    version: '2.0',
    mcp: {
      filesystem: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
        env: {},
        transport: 'stdio',
        scope: 'global',
      },
      github: {
        command: 'mcp-server-github',
        args: [],
        env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
        transport: 'stdio',
        scope: 'global',
        clients: {
          exclude: ['copilot-cli'],
        },
      },
    },
  };

  const mockProjectConfig: OvertureConfigV2 = {
    version: '2.0',
    mcp: {
      'python-repl': {
        command: 'uvx',
        args: ['mcp-server-python-repl'],
        env: {},
        transport: 'stdio',
        scope: 'project',
      },
      filesystem: {
        // Override from user config
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/custom/path'],
        env: {},
        transport: 'stdio',
        scope: 'project',
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Clear adapter registry
    adapterRegistry.clear();

    // Mock getPlatform
    (getPlatform as jest.Mock).mockReturnValue('linux');

    // Mock shouldIncludeMcp to return included by default
    (shouldIncludeMcp as jest.Mock).mockReturnValue({ included: true });

    // Mock process.exit to prevent test termination
    mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit: ${code}`);
    });

    // Create command (this will trigger adapter registration)
    command = createMcpCommand();
  });

  afterEach(() => {
    mockExit.mockRestore();
  });

  // ============================================================================
  // mcp list - Basic Functionality
  // ============================================================================
  describe('mcp list - Basic functionality', () => {
    it('should list MCPs from user config only', async () => {
      // Arrange
      (loadUserConfig as jest.Mock).mockReturnValue(mockUserConfig);
      (loadProjectConfig as jest.Mock).mockReturnValue(null);

      // Act
      await command.parseAsync(['node', 'overture', 'list']);

      // Assert
      expect(loadUserConfig).toHaveBeenCalled();
      expect(loadProjectConfig).toHaveBeenCalled();
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('Configured MCP servers'));
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('filesystem'));
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('github'));
    });

    it('should list MCPs from project config only', async () => {
      // Arrange
      (loadUserConfig as jest.Mock).mockImplementation(() => {
        throw new Error('User config not found');
      });
      (loadProjectConfig as jest.Mock).mockReturnValue(mockProjectConfig);

      // Act
      await command.parseAsync(['node', 'overture', 'list']);

      // Assert
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('python-repl'));
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('filesystem'));
    });

    it('should merge and display MCPs from both configs', async () => {
      // Arrange
      (loadUserConfig as jest.Mock).mockReturnValue(mockUserConfig);
      (loadProjectConfig as jest.Mock).mockReturnValue(mockProjectConfig);

      // Act
      await command.parseAsync(['node', 'overture', 'list']);

      // Assert
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('filesystem'));
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('github'));
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('python-repl'));
    });

    it('should show "both" scope for MCPs in both configs', async () => {
      // Arrange
      (loadUserConfig as jest.Mock).mockReturnValue(mockUserConfig);
      (loadProjectConfig as jest.Mock).mockReturnValue(mockProjectConfig);

      // Get captured output
      const logCalls: string[] = [];
      (Logger.info as jest.Mock).mockImplementation((msg: string) => {
        logCalls.push(msg);
      });

      // Act
      await command.parseAsync(['node', 'overture', 'list']);

      // Assert
      const filesystemLine = logCalls.find((line) => line.includes('filesystem'));
      expect(filesystemLine).toBeDefined();
      // Should show 'both' scope since filesystem is in both configs
    });

    it('should display transport type for each MCP', async () => {
      // Arrange
      (loadUserConfig as jest.Mock).mockReturnValue(mockUserConfig);
      (loadProjectConfig as jest.Mock).mockReturnValue(null);

      const logCalls: string[] = [];
      (Logger.info as jest.Mock).mockImplementation((msg: string) => {
        logCalls.push(msg);
      });

      // Act
      await command.parseAsync(['node', 'overture', 'list']);

      // Assert
      const filesystemLine = logCalls.find((line) => line.includes('filesystem'));
      expect(filesystemLine).toContain('stdio');
    });
  });

  // ============================================================================
  // mcp list - Client Filtering
  // ============================================================================
  describe('mcp list - Client filtering', () => {
    beforeEach(() => {
      // Mock shouldIncludeMcp with specific behavior
      (shouldIncludeMcp as jest.Mock).mockImplementation((config, adapter) => {
        // Exclude github from copilot-cli
        if (config.clients?.exclude?.includes(adapter.name)) {
          return { included: false, reason: `Client ${adapter.name} is excluded` };
        }
        return { included: true };
      });
    });

    it('should show which clients each MCP syncs to', async () => {
      // Arrange
      (loadUserConfig as jest.Mock).mockReturnValue(mockUserConfig);
      (loadProjectConfig as jest.Mock).mockReturnValue(null);

      const logCalls: string[] = [];
      (Logger.info as jest.Mock).mockImplementation((msg: string) => {
        logCalls.push(msg);
      });

      // Act
      await command.parseAsync(['node', 'overture', 'list']);

      // Assert
      const filesystemLine = logCalls.find((line) => line.includes('filesystem'));
      expect(filesystemLine).toBeDefined();
      // Should list client names
    });

    it('should filter MCPs by client with --client option', async () => {
      // Arrange
      (loadUserConfig as jest.Mock).mockReturnValue(mockUserConfig);
      (loadProjectConfig as jest.Mock).mockReturnValue(null);

      // Mock shouldIncludeMcp to only include filesystem for claude-code
      (shouldIncludeMcp as jest.Mock).mockImplementation((config, adapter) => {
        if (adapter.name === 'claude-code') {
          return { included: true };
        }
        return { included: false, reason: 'Excluded' };
      });

      const logCalls: string[] = [];
      (Logger.info as jest.Mock).mockImplementation((msg: string) => {
        logCalls.push(msg);
      });

      // Act
      await command.parseAsync(['node', 'overture', 'list', '--client', 'claude-code']);

      // Assert
      // Should only show MCPs that sync to claude-code
      const lines = logCalls.filter((line) => line.includes('filesystem') || line.includes('github'));
      expect(lines.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // mcp list - Scope Filtering
  // ============================================================================
  describe('mcp list - Scope filtering', () => {
    it('should filter by --scope global', async () => {
      // Arrange
      (loadUserConfig as jest.Mock).mockReturnValue(mockUserConfig);
      (loadProjectConfig as jest.Mock).mockReturnValue(mockProjectConfig);

      const logCalls: string[] = [];
      (Logger.info as jest.Mock).mockImplementation((msg: string) => {
        logCalls.push(msg);
      });

      // Act
      await command.parseAsync(['node', 'overture', 'list', '--scope', 'global']);

      // Assert
      // Should show github (global only) and filesystem (both)
      expect(logCalls.some((line) => line.includes('github'))).toBe(true);
      expect(logCalls.some((line) => line.includes('filesystem'))).toBe(true);
      // Should NOT show python-repl (project only)
      expect(logCalls.some((line) => line.includes('python-repl'))).toBe(false);
    });

    it('should filter by --scope project', async () => {
      // Arrange
      (loadUserConfig as jest.Mock).mockReturnValue(mockUserConfig);
      (loadProjectConfig as jest.Mock).mockReturnValue(mockProjectConfig);

      const logCalls: string[] = [];
      (Logger.info as jest.Mock).mockImplementation((msg: string) => {
        logCalls.push(msg);
      });

      // Act
      await command.parseAsync(['node', 'overture', 'list', '--scope', 'project']);

      // Assert
      // Should show python-repl (project only) and filesystem (both)
      expect(logCalls.some((line) => line.includes('python-repl'))).toBe(true);
      expect(logCalls.some((line) => line.includes('filesystem'))).toBe(true);
      // Should NOT show github (global only)
      expect(logCalls.some((line) => line.includes('github'))).toBe(false);
    });
  });

  // ============================================================================
  // mcp list - Error Handling
  // ============================================================================
  describe('mcp list - Error handling', () => {
    it('should error when no config exists', async () => {
      // Arrange
      (loadUserConfig as jest.Mock).mockImplementation(() => {
        throw new Error('User config not found');
      });
      (loadProjectConfig as jest.Mock).mockImplementation(() => {
        throw new Error('Project config not found');
      });

      // Act & Assert
      await expect(command.parseAsync(['node', 'overture', 'list'])).rejects.toThrow('process.exit: 2');
      expect(Logger.error).toHaveBeenCalledWith('No configuration found');
    });

    it('should warn when no MCPs configured', async () => {
      // Arrange
      const emptyConfig: OvertureConfigV2 = {
        version: '2.0',
        mcp: {},
      };
      (loadUserConfig as jest.Mock).mockReturnValue(emptyConfig);
      (loadProjectConfig as jest.Mock).mockReturnValue(null);

      // Act
      await command.parseAsync(['node', 'overture', 'list']);

      // Assert
      expect(Logger.warn).toHaveBeenCalledWith('No MCP servers configured');
    });

    it('should warn when no MCPs match filters', async () => {
      // Arrange
      (loadUserConfig as jest.Mock).mockReturnValue(mockUserConfig);
      (loadProjectConfig as jest.Mock).mockReturnValue(null);

      // Mock shouldIncludeMcp to exclude all
      (shouldIncludeMcp as jest.Mock).mockReturnValue({ included: false, reason: 'Excluded' });

      // Act
      await command.parseAsync(['node', 'overture', 'list', '--client', 'nonexistent']);

      // Assert
      expect(Logger.warn).toHaveBeenCalledWith('No MCP servers match the specified filters');
    });
  });

  // ============================================================================
  // mcp list - Display Format
  // ============================================================================
  describe('mcp list - Display format', () => {
    it('should display table header', async () => {
      // Arrange
      (loadUserConfig as jest.Mock).mockReturnValue(mockUserConfig);
      (loadProjectConfig as jest.Mock).mockReturnValue(null);

      const logCalls: string[] = [];
      (Logger.info as jest.Mock).mockImplementation((msg: string) => {
        logCalls.push(msg);
      });

      // Act
      await command.parseAsync(['node', 'overture', 'list']);

      // Assert
      expect(logCalls.some((line) => line.includes('NAME'))).toBe(true);
      expect(logCalls.some((line) => line.includes('SCOPE'))).toBe(true);
      expect(logCalls.some((line) => line.includes('TRANSPORT'))).toBe(true);
      expect(logCalls.some((line) => line.includes('SYNCS TO'))).toBe(true);
    });

    it('should display summary with total count', async () => {
      // Arrange
      (loadUserConfig as jest.Mock).mockReturnValue(mockUserConfig);
      (loadProjectConfig as jest.Mock).mockReturnValue(mockProjectConfig);

      const logCalls: string[] = [];
      (Logger.info as jest.Mock).mockImplementation((msg: string) => {
        logCalls.push(msg);
      });

      // Act
      await command.parseAsync(['node', 'overture', 'list']);

      // Assert
      const summaryLine = logCalls.find((line) => line.includes('Total:'));
      expect(summaryLine).toBeDefined();
    });

    it('should sort MCPs alphabetically by name', async () => {
      // Arrange
      const unsortedConfig: OvertureConfigV2 = {
        version: '2.0',
        mcp: {
          zebra: {
            command: 'zebra',
            args: [],
            env: {},
            transport: 'stdio',
            scope: 'global',
          },
          apple: {
            command: 'apple',
            args: [],
            env: {},
            transport: 'stdio',
            scope: 'global',
          },
          monkey: {
            command: 'monkey',
            args: [],
            env: {},
            transport: 'stdio',
            scope: 'global',
          },
        },
      };
      (loadUserConfig as jest.Mock).mockReturnValue(unsortedConfig);
      (loadProjectConfig as jest.Mock).mockReturnValue(null);

      const logCalls: string[] = [];
      (Logger.info as jest.Mock).mockImplementation((msg: string) => {
        logCalls.push(msg);
      });

      // Act
      await command.parseAsync(['node', 'overture', 'list']);

      // Assert
      const mcpLines = logCalls.filter(
        (line) => line.includes('apple') || line.includes('monkey') || line.includes('zebra')
      );
      expect(mcpLines.length).toBe(3);
      // apple should come before monkey, monkey before zebra
      const appleIndex = logCalls.findIndex((line) => line.includes('apple'));
      const monkeyIndex = logCalls.findIndex((line) => line.includes('monkey'));
      const zebraIndex = logCalls.findIndex((line) => line.includes('zebra'));
      expect(appleIndex).toBeLessThan(monkeyIndex);
      expect(monkeyIndex).toBeLessThan(zebraIndex);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================
  describe('Integration tests', () => {
    it('should handle combined scope and client filters', async () => {
      // Arrange
      (loadUserConfig as jest.Mock).mockReturnValue(mockUserConfig);
      (loadProjectConfig as jest.Mock).mockReturnValue(mockProjectConfig);

      (shouldIncludeMcp as jest.Mock).mockImplementation((config, adapter) => {
        // Only include filesystem for claude-code
        if (adapter.name === 'claude-code' && config.command.includes('filesystem')) {
          return { included: true };
        }
        return { included: false, reason: 'Excluded' };
      });

      const logCalls: string[] = [];
      (Logger.info as jest.Mock).mockImplementation((msg: string) => {
        logCalls.push(msg);
      });

      // Act
      await command.parseAsync(['node', 'overture', 'list', '--scope', 'global', '--client', 'claude-code']);

      // Assert
      // Should only show filesystem (which is in both global and project, syncs to claude-code)
      const filesystemLines = logCalls.filter((line) => line.includes('filesystem'));
      expect(filesystemLines.length).toBeGreaterThan(0);
    });

    it('should handle MCPs with no client matches', async () => {
      // Arrange
      const configWithExcluded: OvertureConfigV2 = {
        version: '2.0',
        mcp: {
          excluded: {
            command: 'excluded',
            args: [],
            env: {},
            transport: 'http', // Unsupported by some clients
            scope: 'global',
          },
        },
      };
      (loadUserConfig as jest.Mock).mockReturnValue(configWithExcluded);
      (loadProjectConfig as jest.Mock).mockReturnValue(null);

      // Mock all clients to not support this MCP
      (shouldIncludeMcp as jest.Mock).mockReturnValue({
        included: false,
        reason: 'Transport not supported',
      });

      const logCalls: string[] = [];
      (Logger.info as jest.Mock).mockImplementation((msg: string) => {
        logCalls.push(msg);
      });

      // Act
      await command.parseAsync(['node', 'overture', 'list']);

      // Assert
      const excludedLine = logCalls.find((line) => line.includes('excluded'));
      expect(excludedLine).toBeDefined();
      // Should show 'none' for clients
      expect(excludedLine).toContain('none');
    });
  });
});
