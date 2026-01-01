/**
 * Doctor Command Tests
 *
 * Tests for the `overture doctor` command using the new diagnostics orchestrator architecture.
 *
 * Test Coverage:
 * - Command structure and options
 * - Diagnostics orchestrator integration
 * - Output formatting (text and JSON modes)
 * - Verbose mode
 * - Error handling
 *
 * @see apps/cli/src/cli/commands/doctor.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDoctorCommand } from './doctor.js';
import type { AppDependencies } from '../../composition-root.js';
import { createMockAppDependencies } from '../../test-utils/app-dependencies.mock.js';
import type { DiagnosticsResult } from '@overture/diagnostics-types';

describe('doctor command', () => {
  let deps: AppDependencies;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

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

  describe('diagnostics orchestrator integration', () => {
    it('should call diagnosticsOrchestrator.runDiagnostics()', async () => {
      const command = createDoctorCommand(deps);

      await command.parseAsync(['node', 'doctor']);

      expect(deps.diagnosticsOrchestrator.runDiagnostics).toHaveBeenCalled();
    });

    it('should pass options to diagnosticsOrchestrator', async () => {
      const command = createDoctorCommand(deps);

      await command.parseAsync(['node', 'doctor', '--verbose', '--wsl2']);

      expect(deps.diagnosticsOrchestrator.runDiagnostics).toHaveBeenCalledWith({
        wsl2: true,
        verbose: true,
        json: undefined,
      });
    });

    it('should handle --no-wsl2 option', async () => {
      const command = createDoctorCommand(deps);

      await command.parseAsync(['node', 'doctor', '--no-wsl2']);

      expect(deps.diagnosticsOrchestrator.runDiagnostics).toHaveBeenCalledWith({
        wsl2: false,
        verbose: undefined,
        json: undefined,
      });
    });
  });

  describe('text output mode', () => {
    it('should call all formatters in text mode', async () => {
      const mockResult: DiagnosticsResult = {
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
            gitRemote: 'https://github.com/user/overture-config',
            localHash: 'abc123',
            remoteHash: 'abc123',
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
            projectAgentsPath: '/project/.overture/agents',
            projectAgentsDirExists: true,
            projectAgentCount: 2,
            projectAgentErrors: [],
            modelsConfigPath: '/home/user/.config/overture/models.json',
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
              version: '1.0.0',
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
          globalAgents: 3,
          projectAgents: 2,
          agentErrors: 0,
        },
      };

      vi.mocked(deps.diagnosticsOrchestrator.runDiagnostics).mockResolvedValue(
        mockResult,
      );

      const command = createDoctorCommand(deps);
      await command.parseAsync(['node', 'doctor']);

      // Verify all formatters were called
      expect(
        deps.formatters.environment.formatEnvironment,
      ).toHaveBeenCalledWith(mockResult.environment);
      expect(
        deps.formatters.configRepo.formatConfigRepoStatus,
      ).toHaveBeenCalledWith(mockResult.configRepo, undefined);
      expect(deps.formatters.clients.formatClientResults).toHaveBeenCalledWith(
        mockResult.clients,
        undefined,
      );
      expect(deps.formatters.mcp.formatMcpResults).toHaveBeenCalledWith(
        mockResult.mcpServers,
        undefined,
      );
      expect(deps.formatters.summary.formatSummary).toHaveBeenCalledWith(
        mockResult,
        1,
      );
    });

    it('should pass verbose flag to formatters', async () => {
      const mockResult: DiagnosticsResult = {
        environment: { platform: 'linux', isWSL2: false },
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
            modelsConfigPath: '/home/user/.config/overture/models.json',
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
          summary: { mcpCommandsAvailable: 0, mcpCommandsMissing: 0 },
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

      vi.mocked(deps.diagnosticsOrchestrator.runDiagnostics).mockResolvedValue(
        mockResult,
      );

      const command = createDoctorCommand(deps);
      await command.parseAsync(['node', 'doctor', '--verbose']);

      // Verify verbose flag was passed to formatters
      expect(
        deps.formatters.configRepo.formatConfigRepoStatus,
      ).toHaveBeenCalledWith(mockResult.configRepo, true);
      expect(deps.formatters.clients.formatClientResults).toHaveBeenCalledWith(
        mockResult.clients,
        true,
      );
      expect(deps.formatters.mcp.formatMcpResults).toHaveBeenCalledWith(
        mockResult.mcpServers,
        true,
      );
    });

    it('should not call formatters in JSON mode', async () => {
      const command = createDoctorCommand(deps);
      await command.parseAsync(['node', 'doctor', '--json']);

      // Formatters should NOT be called in JSON mode
      expect(
        deps.formatters.environment.formatEnvironment,
      ).not.toHaveBeenCalled();
      expect(
        deps.formatters.configRepo.formatConfigRepoStatus,
      ).not.toHaveBeenCalled();
      expect(
        deps.formatters.clients.formatClientResults,
      ).not.toHaveBeenCalled();
      expect(deps.formatters.mcp.formatMcpResults).not.toHaveBeenCalled();
      expect(deps.formatters.summary.formatSummary).not.toHaveBeenCalled();
    });
  });

  describe('JSON output mode', () => {
    it('should output results as JSON when --json flag is provided', async () => {
      const mockResult: DiagnosticsResult = {
        environment: { platform: 'linux', isWSL2: false },
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
            modelsConfigPath: '/home/user/.config/overture/models.json',
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
          summary: { mcpCommandsAvailable: 0, mcpCommandsMissing: 0 },
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

      vi.mocked(deps.diagnosticsOrchestrator.runDiagnostics).mockResolvedValue(
        mockResult,
      );

      const command = createDoctorCommand(deps);
      await command.parseAsync(['node', 'doctor', '--json']);

      // Verify JSON output
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"environment"'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"clients"'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"summary"'),
      );

      // Verify it's valid JSON
      const output = consoleLogSpy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
      const parsed = JSON.parse(output);
      expect(parsed).toEqual(mockResult);
    });

    it('should include summary metrics in JSON output', async () => {
      const mockResult: DiagnosticsResult = {
        environment: { platform: 'linux', isWSL2: false },
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
            modelsConfigPath: '/home/user/.config/overture/models.json',
            modelsConfigExists: false,
            modelsConfigValid: false,
            modelsConfigError: null,
          },
        },
        clients: {
          clients: [
            {
              client: 'claude-code',
              status: 'found',
              version: '1.0.0',
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
          mcpServers: [],
          summary: { mcpCommandsAvailable: 0, mcpCommandsMissing: 0 },
        },
        summary: {
          clientsDetected: 1,
          clientsMissing: 0,
          wsl2Detections: 0,
          configsValid: 1,
          configsInvalid: 0,
          mcpCommandsAvailable: 0,
          mcpCommandsMissing: 0,
          globalAgents: 0,
          projectAgents: 0,
          agentErrors: 0,
        },
      };

      vi.mocked(deps.diagnosticsOrchestrator.runDiagnostics).mockResolvedValue(
        mockResult,
      );

      const command = createDoctorCommand(deps);
      await command.parseAsync(['node', 'doctor', '--json']);

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);

      expect(parsed.summary).toEqual(mockResult.summary);
      expect(parsed.summary.clientsDetected).toBe(1);
    });

    it('should handle invalid JSON format output errors', async () => {
      // Mock JSON.stringify to throw
      const originalStringify = JSON.stringify;
      global.JSON.stringify = vi.fn().mockImplementation(() => {
        throw new Error('Circular structure');
      });

      const command = createDoctorCommand(deps);

      await expect(
        command.parseAsync(['node', 'doctor', '--json']),
      ).rejects.toThrow('Circular structure');

      // Restore
      global.JSON.stringify = originalStringify;
    });
  });

  describe('error handling', () => {
    it('should handle diagnosticsOrchestrator errors gracefully', async () => {
      vi.mocked(deps.diagnosticsOrchestrator.runDiagnostics).mockRejectedValue(
        new Error('Diagnostics failed'),
      );

      const command = createDoctorCommand(deps);

      await expect(command.parseAsync(['node', 'doctor'])).rejects.toThrow(
        'Diagnostics failed',
      );
    });
  });
});
