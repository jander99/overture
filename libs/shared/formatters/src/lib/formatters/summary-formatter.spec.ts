/**
 * @overture/formatters
 *
 * Tests for SummaryFormatter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SummaryFormatter } from './summary-formatter.js';
import type { OutputPort } from '@overture/ports-output';
import type { DiagnosticsResult } from '@overture/diagnostics-types';

describe('SummaryFormatter', () => {
  let output: OutputPort;
  let formatter: SummaryFormatter;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    output = {
      info: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    formatter = new SummaryFormatter(output);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('formatSummary', () => {
    it('should format complete summary with all sections', () => {
      const result: DiagnosticsResult = {
        environment: {
          platform: 'linux',
          isWSL2: false,
        },
        configRepo: {
          configRepoPath: '/home/user/.config/overture',
          skillsPath: '/home/user/.config/overture/skills',
          configRepoExists: true,
          skillsDirExists: true,
          git: {
            isGitRepo: true,
            gitRemote: 'https://github.com/user/config',
            localHash: 'abc1234',
            remoteHash: 'abc1234',
            gitInSync: true,
          },
          skills: {
            skillsPath: '/home/user/.config/overture/skills',
            skillsDirExists: true,
            skillCount: 5,
          },
          agents: {
            globalAgentsPath: '/home/user/.config/overture/agents',
            globalAgentsDirExists: true,
            globalAgentCount: 3,
            globalAgentErrors: [],
            projectAgentsPath: null,
            projectAgentsDirExists: false,
            projectAgentCount: 0,
            projectAgentErrors: [],
            modelsConfigPath: '/home/user/.config/overture/models.yaml',
            modelsConfigExists: true,
            modelsConfigValid: true,
            modelsConfigError: null,
          },
        },
        clients: {
          clients: [],
          summary: {
            clientsDetected: 2,
            clientsMissing: 1,
            wsl2Detections: 0,
            configsValid: 2,
            configsInvalid: 0,
          },
        },
        mcpServers: {
          mcpServers: [
            { name: 'fs', command: 'npx', available: true, source: 'user' },
            { name: 'mem', command: 'npx', available: true, source: 'user' },
            { name: 'gh', command: 'npx', available: true, source: 'user' },
            { name: 'py', command: 'uvx', available: false, source: 'user' },
          ],
          summary: {
            mcpCommandsAvailable: 3,
            mcpCommandsMissing: 1,
          },
        },
        summary: {
          clientsDetected: 2,
          clientsMissing: 1,
          wsl2Detections: 0,
          configsValid: 2,
          configsInvalid: 0,
          mcpCommandsAvailable: 3,
          mcpCommandsMissing: 1,
          globalAgents: 3,
          projectAgents: 0,
          agentErrors: 0,
        },
      };

      formatter.formatSummary(result, 3);

      expect(output.info).toHaveBeenCalledWith(expect.stringContaining('Summary:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Config repo:'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Git repository:'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skills directory:'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Global agents:'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Clients detected:'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Configs valid:'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('MCP commands available:'),
      );
    });

    it('should handle config repo not found', () => {
      const result: DiagnosticsResult = {
        environment: {
          platform: 'linux',
          isWSL2: false,
        },
        configRepo: {
          configRepoPath: '/home/user/.config/overture',
          skillsPath: '/home/user/.config/overture/skills',
          configRepoExists: false,
          skillsDirExists: false,
          git: {
            isGitRepo: false,
            gitRemote: null,
            localHash: null,
            remoteHash: null,
            gitInSync: false,
          },
          skills: {
            skillsPath: '/home/user/.config/overture/skills',
            skillsDirExists: false,
            skillCount: 0,
          },
          agents: {
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
            modelsConfigError: null,
          },
        },
        clients: {
          clients: [],
          summary: {
            clientsDetected: 0,
            clientsMissing: 3,
            wsl2Detections: 0,
            configsValid: 0,
            configsInvalid: 0,
          },
        },
        mcpServers: {
          mcpServers: [],
          summary: {
            mcpCommandsAvailable: 0,
            mcpCommandsMissing: 0,
          },
        },
        summary: {
          clientsDetected: 0,
          clientsMissing: 3,
          wsl2Detections: 0,
          configsValid: 0,
          configsInvalid: 0,
          mcpCommandsAvailable: 0,
          mcpCommandsMissing: 0,
          globalAgents: 0,
          projectAgents: 0,
          agentErrors: 0,
        },
      };

      formatter.formatSummary(result, 3);

      // Check that config repo shows "not found"
      const calls = consoleLogSpy.mock.calls.map((call) => call[0]);
      const hasConfigRepoNotFound = calls.some(
        (call) => typeof call === 'string' && call.includes('not found'),
      );
      expect(hasConfigRepoNotFound).toBe(true);

      // Should not show git, skills, or agents when config repo doesn't exist
      const hasGitRepo = calls.some(
        (call) => typeof call === 'string' && call.includes('Git repository:'),
      );
      expect(hasGitRepo).toBe(false);
    });

    it('should show WSL2 detections when present', () => {
      const result: DiagnosticsResult = {
        environment: {
          platform: 'linux',
          isWSL2: true,
        },
        configRepo: {
          configRepoPath: '/home/user/.config/overture',
          skillsPath: '/home/user/.config/overture/skills',
          configRepoExists: true,
          skillsDirExists: true,
          git: {
            isGitRepo: false,
            gitRemote: null,
            localHash: null,
            remoteHash: null,
            gitInSync: false,
          },
          skills: {
            skillsPath: '/home/user/.config/overture/skills',
            skillsDirExists: true,
            skillCount: 0,
          },
          agents: {
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
            modelsConfigError: null,
          },
        },
        clients: {
          clients: [],
          summary: {
            clientsDetected: 1,
            clientsMissing: 2,
            wsl2Detections: 1,
            configsValid: 0,
            configsInvalid: 0,
          },
        },
        mcpServers: {
          mcpServers: [],
          summary: {
            mcpCommandsAvailable: 0,
            mcpCommandsMissing: 0,
          },
        },
        summary: {
          clientsDetected: 1,
          clientsMissing: 2,
          wsl2Detections: 1,
          configsValid: 0,
          configsInvalid: 0,
          mcpCommandsAvailable: 0,
          mcpCommandsMissing: 0,
          globalAgents: 0,
          projectAgents: 0,
          agentErrors: 0,
        },
      };

      formatter.formatSummary(result, 3);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('WSL2 detections:'),
      );
    });

    it('should show project agents when present', () => {
      const result: DiagnosticsResult = {
        environment: {
          platform: 'linux',
          isWSL2: false,
        },
        configRepo: {
          configRepoPath: '/home/user/.config/overture',
          skillsPath: '/home/user/.config/overture/skills',
          configRepoExists: true,
          skillsDirExists: true,
          git: {
            isGitRepo: false,
            gitRemote: null,
            localHash: null,
            remoteHash: null,
            gitInSync: false,
          },
          skills: {
            skillsPath: '/home/user/.config/overture/skills',
            skillsDirExists: true,
            skillCount: 0,
          },
          agents: {
            globalAgentsPath: '/home/user/.config/overture/agents',
            globalAgentsDirExists: true,
            globalAgentCount: 2,
            globalAgentErrors: [],
            projectAgentsPath: '/project/.agents',
            projectAgentsDirExists: true,
            projectAgentCount: 1,
            projectAgentErrors: [],
            modelsConfigPath: '/home/user/.config/overture/models.yaml',
            modelsConfigExists: false,
            modelsConfigValid: false,
            modelsConfigError: null,
          },
        },
        clients: {
          clients: [],
          summary: {
            clientsDetected: 0,
            clientsMissing: 0,
            wsl2Detections: 0,
            configsValid: 0,
            configsInvalid: 0,
          },
        },
        mcpServers: {
          mcpServers: [],
          summary: {
            mcpCommandsAvailable: 0,
            mcpCommandsMissing: 0,
          },
        },
        summary: {
          clientsDetected: 0,
          clientsMissing: 0,
          wsl2Detections: 0,
          configsValid: 0,
          configsInvalid: 0,
          mcpCommandsAvailable: 0,
          mcpCommandsMissing: 0,
          globalAgents: 2,
          projectAgents: 1,
          agentErrors: 0,
        },
      };

      formatter.formatSummary(result, 3);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Project agents:'),
      );
    });

    it('should show agent errors when present', () => {
      const result: DiagnosticsResult = {
        environment: {
          platform: 'linux',
          isWSL2: false,
        },
        configRepo: {
          configRepoPath: '/home/user/.config/overture',
          skillsPath: '/home/user/.config/overture/skills',
          configRepoExists: true,
          skillsDirExists: true,
          git: {
            isGitRepo: false,
            gitRemote: null,
            localHash: null,
            remoteHash: null,
            gitInSync: false,
          },
          skills: {
            skillsPath: '/home/user/.config/overture/skills',
            skillsDirExists: true,
            skillCount: 0,
          },
          agents: {
            globalAgentsPath: '/home/user/.config/overture/agents',
            globalAgentsDirExists: true,
            globalAgentCount: 2,
            globalAgentErrors: ['Error 1', 'Error 2'],
            projectAgentsPath: null,
            projectAgentsDirExists: false,
            projectAgentCount: 0,
            projectAgentErrors: [],
            modelsConfigPath: '/home/user/.config/overture/models.yaml',
            modelsConfigExists: false,
            modelsConfigValid: false,
            modelsConfigError: null,
          },
        },
        clients: {
          clients: [],
          summary: {
            clientsDetected: 0,
            clientsMissing: 0,
            wsl2Detections: 0,
            configsValid: 0,
            configsInvalid: 0,
          },
        },
        mcpServers: {
          mcpServers: [],
          summary: {
            mcpCommandsAvailable: 0,
            mcpCommandsMissing: 0,
          },
        },
        summary: {
          clientsDetected: 0,
          clientsMissing: 0,
          wsl2Detections: 0,
          configsValid: 0,
          configsInvalid: 0,
          mcpCommandsAvailable: 0,
          mcpCommandsMissing: 0,
          globalAgents: 2,
          projectAgents: 0,
          agentErrors: 2,
        },
      };

      formatter.formatSummary(result, 3);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('2 errors'),
      );
    });

    it('should show invalid configs when present', () => {
      const result: DiagnosticsResult = {
        environment: {
          platform: 'linux',
          isWSL2: false,
        },
        configRepo: {
          configRepoPath: '/home/user/.config/overture',
          skillsPath: '/home/user/.config/overture/skills',
          configRepoExists: true,
          skillsDirExists: true,
          git: {
            isGitRepo: false,
            gitRemote: null,
            localHash: null,
            remoteHash: null,
            gitInSync: false,
          },
          skills: {
            skillsPath: '/home/user/.config/overture/skills',
            skillsDirExists: true,
            skillCount: 0,
          },
          agents: {
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
            modelsConfigError: null,
          },
        },
        clients: {
          clients: [],
          summary: {
            clientsDetected: 1,
            clientsMissing: 0,
            wsl2Detections: 0,
            configsValid: 1,
            configsInvalid: 2,
          },
        },
        mcpServers: {
          mcpServers: [],
          summary: {
            mcpCommandsAvailable: 0,
            mcpCommandsMissing: 0,
          },
        },
        summary: {
          clientsDetected: 1,
          clientsMissing: 0,
          wsl2Detections: 0,
          configsValid: 1,
          configsInvalid: 2,
          mcpCommandsAvailable: 0,
          mcpCommandsMissing: 0,
          globalAgents: 0,
          projectAgents: 0,
          agentErrors: 0,
        },
      };

      formatter.formatSummary(result, 3);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Configs invalid:'),
      );
    });

    it('should not show MCP section when no MCP servers', () => {
      const result: DiagnosticsResult = {
        environment: {
          platform: 'linux',
          isWSL2: false,
        },
        configRepo: {
          configRepoPath: '/home/user/.config/overture',
          skillsPath: '/home/user/.config/overture/skills',
          configRepoExists: true,
          skillsDirExists: true,
          git: {
            isGitRepo: false,
            gitRemote: null,
            localHash: null,
            remoteHash: null,
            gitInSync: false,
          },
          skills: {
            skillsPath: '/home/user/.config/overture/skills',
            skillsDirExists: true,
            skillCount: 0,
          },
          agents: {
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
            modelsConfigError: null,
          },
        },
        clients: {
          clients: [],
          summary: {
            clientsDetected: 0,
            clientsMissing: 0,
            wsl2Detections: 0,
            configsValid: 0,
            configsInvalid: 0,
          },
        },
        mcpServers: {
          mcpServers: [],
          summary: {
            mcpCommandsAvailable: 0,
            mcpCommandsMissing: 0,
          },
        },
        summary: {
          clientsDetected: 0,
          clientsMissing: 0,
          wsl2Detections: 0,
          configsValid: 0,
          configsInvalid: 0,
          mcpCommandsAvailable: 0,
          mcpCommandsMissing: 0,
          globalAgents: 0,
          projectAgents: 0,
          agentErrors: 0,
        },
      };

      formatter.formatSummary(result, 3);

      const calls = consoleLogSpy.mock.calls.map((call) => call[0]);
      const hasMcpCommands = calls.some(
        (call) => typeof call === 'string' && call.includes('MCP commands'),
      );
      expect(hasMcpCommands).toBe(false);
    });

    it('should show git sync status when out of sync', () => {
      const result: DiagnosticsResult = {
        environment: {
          platform: 'linux',
          isWSL2: false,
        },
        configRepo: {
          configRepoPath: '/home/user/.config/overture',
          skillsPath: '/home/user/.config/overture/skills',
          configRepoExists: true,
          skillsDirExists: true,
          git: {
            isGitRepo: true,
            gitRemote: 'https://github.com/user/config',
            localHash: 'abc1234',
            remoteHash: 'def5678',
            gitInSync: false,
          },
          skills: {
            skillsPath: '/home/user/.config/overture/skills',
            skillsDirExists: true,
            skillCount: 0,
          },
          agents: {
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
            modelsConfigError: null,
          },
        },
        clients: {
          clients: [],
          summary: {
            clientsDetected: 0,
            clientsMissing: 0,
            wsl2Detections: 0,
            configsValid: 0,
            configsInvalid: 0,
          },
        },
        mcpServers: {
          mcpServers: [],
          summary: {
            mcpCommandsAvailable: 0,
            mcpCommandsMissing: 0,
          },
        },
        summary: {
          clientsDetected: 0,
          clientsMissing: 0,
          wsl2Detections: 0,
          configsValid: 0,
          configsInvalid: 0,
          mcpCommandsAvailable: 0,
          mcpCommandsMissing: 0,
          globalAgents: 0,
          projectAgents: 0,
          agentErrors: 0,
        },
      };

      formatter.formatSummary(result, 3);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Git sync:'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('out of sync'),
      );
    });
  });
});
