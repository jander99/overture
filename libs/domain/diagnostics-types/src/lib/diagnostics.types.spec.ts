import { describe, it, expect } from 'vitest';
import type {
  DiagnosticsResult,
  EnvironmentCheckResult,
  ConfigRepoCheckResult,
  GitCheckResult,
  SkillsCheckResult,
  AgentsCheckResult,
  ClientCheckResult,
  ClientsCheckResult,
  McpServerCheckResult,
  McpCheckResult,
  DiagnosticsSummary,
  DiagnosticsOptions,
} from './diagnostics.types.js';

describe('diagnostics.types', () => {
  describe('EnvironmentCheckResult', () => {
    it('should compile with minimal fields', () => {
      const result: EnvironmentCheckResult = {
        platform: 'linux',
        isWSL2: false,
      };
      expect(result.platform).toBe('linux');
      expect(result.isWSL2).toBe(false);
    });

    it('should compile with WSL2 info', () => {
      const result: EnvironmentCheckResult = {
        platform: 'linux',
        isWSL2: true,
        wsl2Info: {
          distroName: 'Ubuntu',
          windowsUserProfile: 'C:\\Users\\test',
        },
      };
      expect(result.wsl2Info?.distroName).toBe('Ubuntu');
    });
  });

  describe('ConfigRepoCheckResult', () => {
    it('should compile with all required fields', () => {
      const result: ConfigRepoCheckResult = {
        configRepoPath: '/home/user/.config/overture',
        skillsPath: '/home/user/.config/overture/skills',
        configRepoExists: true,
        skillsDirExists: true,
      };
      expect(result.configRepoExists).toBe(true);
    });
  });

  describe('GitCheckResult', () => {
    it('should compile when git is not a repo', () => {
      const result: GitCheckResult = {
        isGitRepo: false,
        gitRemote: null,
        localHash: null,
        remoteHash: null,
        gitInSync: false,
      };
      expect(result.isGitRepo).toBe(false);
    });

    it('should compile when git is in sync', () => {
      const result: GitCheckResult = {
        isGitRepo: true,
        gitRemote: 'https://github.com/user/repo.git',
        localHash: 'abc123',
        remoteHash: 'abc123',
        gitInSync: true,
      };
      expect(result.gitInSync).toBe(true);
    });
  });

  describe('SkillsCheckResult', () => {
    it('should compile with skill count', () => {
      const result: SkillsCheckResult = {
        skillsPath: '/path/to/skills',
        skillsDirExists: true,
        skillCount: 5,
      };
      expect(result.skillCount).toBe(5);
    });
  });

  describe('AgentsCheckResult', () => {
    it('should compile with all fields', () => {
      const result: AgentsCheckResult = {
        globalAgentsPath: '/home/user/.config/overture/agents',
        globalAgentsDirExists: true,
        globalAgentCount: 3,
        globalAgentErrors: [],
        projectAgentsPath: '/project/.overture/agents',
        projectAgentsDirExists: true,
        projectAgentCount: 2,
        projectAgentErrors: ['Error in agent.yaml'],
        modelsConfigPath: '/home/user/.config/overture/models.yaml',
        modelsConfigExists: true,
        modelsConfigValid: true,
        modelsConfigError: null,
      };
      expect(result.globalAgentCount).toBe(3);
      expect(result.projectAgentErrors).toHaveLength(1);
    });

    it('should compile without project agents', () => {
      const result: AgentsCheckResult = {
        globalAgentsPath: '/home/user/.config/overture/agents',
        globalAgentsDirExists: false,
        globalAgentCount: 0,
        globalAgentErrors: [],
        projectAgentsPath: null,
        projectAgentsDirExists: false,
        projectAgentCount: 0,
        projectAgentErrors: [],
        modelsConfigPath: '/home/user/.config/overture/models.yaml',
        modelsConfigExists: false,
        modelsConfigValid: false,
        modelsConfigError: 'File not found',
      };
      expect(result.projectAgentsPath).toBeNull();
    });
  });

  describe('ClientCheckResult', () => {
    it('should compile with found status', () => {
      const result: ClientCheckResult = {
        client: 'claude-code',
        status: 'found',
        binaryPath: '/usr/local/bin/claude-code',
        version: '1.0.0',
        configPath: '/home/user/.config/claude-code/config.json',
        configValid: true,
      };
      expect(result.status).toBe('found');
    });

    it('should compile with not-found status', () => {
      const result: ClientCheckResult = {
        client: 'copilot-cli',
        status: 'not-found',
        configValid: false,
      };
      expect(result.status).toBe('not-found');
    });

    it('should compile with optional fields', () => {
      const result: ClientCheckResult = {
        client: 'opencode',
        status: 'found',
        binaryPath: '/usr/bin/opencode',
        warnings: ['Config file outdated'],
        source: 'linux-native',
        environment: 'WSL2',
        windowsPath: 'C:\\Program Files\\OpenCode',
        configValid: true,
      };
      expect(result.warnings).toHaveLength(1);
    });
  });

  describe('ClientsCheckResult', () => {
    it('should compile with clients array and summary', () => {
      const result: ClientsCheckResult = {
        clients: [
          {
            client: 'claude-code',
            status: 'found',
            configValid: true,
          },
        ],
        summary: {
          clientsDetected: 1,
          clientsMissing: 2,
          wsl2Detections: 0,
          configsValid: 1,
          configsInvalid: 0,
        },
      };
      expect(result.clients).toHaveLength(1);
      expect(result.summary.clientsDetected).toBe(1);
    });
  });

  describe('McpServerCheckResult', () => {
    it('should compile with all fields', () => {
      const result: McpServerCheckResult = {
        name: 'filesystem',
        command: 'npx',
        available: true,
        source: 'user',
      };
      expect(result.available).toBe(true);
    });
  });

  describe('McpCheckResult', () => {
    it('should compile with servers array and summary', () => {
      const result: McpCheckResult = {
        mcpServers: [
          {
            name: 'filesystem',
            command: 'npx',
            available: true,
            source: 'user',
          },
        ],
        summary: {
          mcpCommandsAvailable: 1,
          mcpCommandsMissing: 0,
        },
      };
      expect(result.mcpServers).toHaveLength(1);
      expect(result.summary.mcpCommandsAvailable).toBe(1);
    });
  });

  describe('DiagnosticsSummary', () => {
    it('should compile with all metrics', () => {
      const result: DiagnosticsSummary = {
        clientsDetected: 2,
        clientsMissing: 1,
        wsl2Detections: 0,
        configsValid: 2,
        configsInvalid: 0,
        mcpCommandsAvailable: 5,
        mcpCommandsMissing: 1,
        globalAgents: 3,
        projectAgents: 1,
        agentErrors: 0,
      };
      expect(result.clientsDetected).toBe(2);
    });
  });

  describe('DiagnosticsResult', () => {
    it('should compile with complete structure', () => {
      const result: DiagnosticsResult = {
        environment: {
          platform: 'darwin',
          isWSL2: false,
        },
        configRepo: {
          configRepoPath: '/Users/test/.config/overture',
          skillsPath: '/Users/test/.config/overture/skills',
          configRepoExists: true,
          skillsDirExists: true,
          git: {
            isGitRepo: true,
            gitRemote: 'https://github.com/user/repo.git',
            localHash: 'abc123',
            remoteHash: 'abc123',
            gitInSync: true,
          },
          skills: {
            skillsPath: '/Users/test/.config/overture/skills',
            skillsDirExists: true,
            skillCount: 5,
          },
          agents: {
            globalAgentsPath: '/Users/test/.config/overture/agents',
            globalAgentsDirExists: true,
            globalAgentCount: 2,
            globalAgentErrors: [],
            projectAgentsPath: null,
            projectAgentsDirExists: false,
            projectAgentCount: 0,
            projectAgentErrors: [],
            modelsConfigPath: '/Users/test/.config/overture/models.yaml',
            modelsConfigExists: true,
            modelsConfigValid: true,
            modelsConfigError: null,
          },
        },
        clients: {
          clients: [
            {
              client: 'claude-code',
              status: 'found',
              configValid: true,
            },
          ],
          summary: {
            clientsDetected: 1,
            clientsMissing: 0,
            wsl2Detections: 0,
            configsValid: 1,
            configsInvalid: 0,
          },
        },
        mcpServers: {
          mcpServers: [
            {
              name: 'filesystem',
              command: 'npx',
              available: true,
              source: 'user',
            },
          ],
          summary: {
            mcpCommandsAvailable: 1,
            mcpCommandsMissing: 0,
          },
        },
        summary: {
          clientsDetected: 1,
          clientsMissing: 0,
          wsl2Detections: 0,
          configsValid: 1,
          configsInvalid: 0,
          mcpCommandsAvailable: 1,
          mcpCommandsMissing: 0,
          globalAgents: 2,
          projectAgents: 0,
          agentErrors: 0,
        },
      };
      expect(result).toBeDefined();
      expect(result.environment.platform).toBe('darwin');
      expect(result.configRepo.git.gitInSync).toBe(true);
      expect(result.clients.summary.clientsDetected).toBe(1);
    });
  });

  describe('DiagnosticsOptions', () => {
    it('should compile with all options', () => {
      const options: DiagnosticsOptions = {
        wsl2: true,
        verbose: true,
        json: false,
      };
      expect(options.wsl2).toBe(true);
    });

    it('should compile with partial options', () => {
      const options: DiagnosticsOptions = {
        json: true,
      };
      expect(options.json).toBe(true);
    });

    it('should compile with no options', () => {
      const options: DiagnosticsOptions = {};
      expect(options).toBeDefined();
    });
  });
});
