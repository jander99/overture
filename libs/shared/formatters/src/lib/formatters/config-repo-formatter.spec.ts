import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { ConfigRepoFormatter } from './config-repo-formatter.js';
import type { OutputPort } from '@overture/ports-output';
import type {
  ConfigRepoCheckResult,
  GitCheckResult,
  SkillsCheckResult,
  AgentsCheckResult,
} from '@overture/diagnostics-types';

describe('ConfigRepoFormatter', () => {
  let output: OutputPort;
  let formatter: ConfigRepoFormatter;
  let consoleLogSpy: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    output = {
      info: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    formatter = new ConfigRepoFormatter(output);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('formatConfigRepoStatus', () => {
    it('should display complete config repo status when repo exists', () => {
      const configRepo: ConfigRepoCheckResult & {
        git: GitCheckResult;
        skills: SkillsCheckResult;
        agents: AgentsCheckResult;
      } = {
        configRepoPath: '/home/user/.config/overture',
        skillsPath: '/home/user/.config/overture/skills',
        configRepoExists: true,
        skillsDirExists: true,
        git: {
          isGitRepo: true,
          gitRemote: 'https://github.com/user/config.git',
          localHash: 'abc1234567890',
          remoteHash: 'abc1234567890',
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
      };

      formatter.formatConfigRepoStatus(configRepo, false);

      expect(output.info).toHaveBeenCalledWith(
        expect.stringContaining('Checking config repository'),
      );
      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('Config repo'),
      );
      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('Git repository'),
      );
      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('Remote configured'),
      );
      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('Skills'),
      );
      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('Global Agents'),
      );
      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('Models config'),
      );
    });

    it('should display error when config repo does not exist', () => {
      const configRepo: ConfigRepoCheckResult & {
        git: GitCheckResult;
        skills: SkillsCheckResult;
        agents: AgentsCheckResult;
      } = {
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
      };

      formatter.formatConfigRepoStatus(configRepo, false);

      expect(output.error).toHaveBeenCalledWith(
        expect.stringContaining('Config repo not found'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('overture init'),
      );
    });
  });

  describe('formatGitRepoStatus', () => {
    it('should display git status with remote and in sync', () => {
      const git: GitCheckResult = {
        isGitRepo: true,
        gitRemote: 'https://github.com/user/config.git',
        localHash: 'abc1234567890',
        remoteHash: 'abc1234567890',
        gitInSync: true,
      };

      formatter['formatGitRepoStatus'](git, '/home/user/.config/overture');

      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('Git repository'),
      );
      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('abc1234'),
      );
      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('Remote configured'),
      );
      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('In sync with remote'),
      );
    });

    it('should display warning when git repo has no remote', () => {
      const git: GitCheckResult = {
        isGitRepo: true,
        gitRemote: null,
        localHash: 'abc1234567890',
        remoteHash: null,
        gitInSync: false,
      };

      formatter['formatGitRepoStatus'](git, '/home/user/.config/overture');

      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('Git repository'),
      );
      expect(output.warn).toHaveBeenCalledWith(
        expect.stringContaining('No git remote configured'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('git remote add origin'),
      );
    });

    it('should display warning when not a git repo', () => {
      const git: GitCheckResult = {
        isGitRepo: false,
        gitRemote: null,
        localHash: null,
        remoteHash: null,
        gitInSync: false,
      };

      formatter['formatGitRepoStatus'](git, '/home/user/.config/overture');

      expect(output.warn).toHaveBeenCalledWith(
        expect.stringContaining('Not a git repository'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('git init'),
      );
    });

    it('should handle unknown hash gracefully', () => {
      const git: GitCheckResult = {
        isGitRepo: true,
        gitRemote: null,
        localHash: null,
        remoteHash: null,
        gitInSync: false,
      };

      formatter['formatGitRepoStatus'](git, '/home/user/.config/overture');

      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('unknown'),
      );
    });
  });

  describe('formatGitSyncStatus', () => {
    it('should display success when in sync', () => {
      const git: GitCheckResult = {
        isGitRepo: true,
        gitRemote: 'origin',
        localHash: 'abc1234567890',
        remoteHash: 'abc1234567890',
        gitInSync: true,
      };

      formatter['formatGitSyncStatus'](git);

      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('In sync with remote'),
      );
    });

    it('should display warning when out of sync', () => {
      const git: GitCheckResult = {
        isGitRepo: true,
        gitRemote: 'origin',
        localHash: 'abc1234567890',
        remoteHash: 'def9876543210',
        gitInSync: false,
      };

      formatter['formatGitSyncStatus'](git);

      expect(output.warn).toHaveBeenCalledWith(
        expect.stringContaining('Out of sync with remote'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Local:'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Remote:'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('git pull or git push'),
      );
    });
  });

  describe('formatSkillsStatus', () => {
    it('should display success when skills exist', () => {
      const skills: SkillsCheckResult = {
        skillsPath: '/home/user/.config/overture/skills',
        skillsDirExists: true,
        skillCount: 5,
      };

      formatter['formatSkillsStatus'](skills);

      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('Skills'),
      );
      // The full message includes "Skills - 5 skills found"
      const successCalls = vi.mocked(output.success).mock.calls;
      const skillsCall = successCalls.find((call) =>
        call[0]?.toString().includes('Skills'),
      );
      expect(skillsCall).toBeDefined();
      expect(skillsCall?.[0]).toContain('5');
      expect(skillsCall?.[0]).toContain('skills found');
    });

    it('should use singular form for one skill', () => {
      const skills: SkillsCheckResult = {
        skillsPath: '/home/user/.config/overture/skills',
        skillsDirExists: true,
        skillCount: 1,
      };

      formatter['formatSkillsStatus'](skills);

      // The full message includes "Skills - 1 skill found"
      const successCalls = vi.mocked(output.success).mock.calls;
      const skillsCall = successCalls.find((call) =>
        call[0]?.toString().includes('Skills'),
      );
      expect(skillsCall).toBeDefined();
      expect(skillsCall?.[0]).toContain('1');
      expect(skillsCall?.[0]).toContain('skill found');
    });

    it('should display warning when skills directory is empty', () => {
      const skills: SkillsCheckResult = {
        skillsPath: '/home/user/.config/overture/skills',
        skillsDirExists: true,
        skillCount: 0,
      };

      formatter['formatSkillsStatus'](skills);

      expect(output.warn).toHaveBeenCalledWith(
        expect.stringContaining('empty'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Add .md skill files'),
      );
    });

    it('should display warning when skills directory does not exist', () => {
      const skills: SkillsCheckResult = {
        skillsPath: '/home/user/.config/overture/skills',
        skillsDirExists: false,
        skillCount: 0,
      };

      formatter['formatSkillsStatus'](skills);

      expect(output.warn).toHaveBeenCalledWith(
        expect.stringContaining('not found'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('mkdir -p'),
      );
    });
  });

  describe('formatAgentsStatus', () => {
    it('should display success when agents exist without errors', () => {
      const agents: AgentsCheckResult = {
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
      };

      formatter['formatAgentsStatus'](agents, 'Global', false);

      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('Global Agents'),
      );
      // The full message includes "Global Agents - 3 agents found"
      const successCalls = vi.mocked(output.success).mock.calls;
      const agentsCall = successCalls.find((call) =>
        call[0]?.toString().includes('Global Agents'),
      );
      expect(agentsCall).toBeDefined();
      expect(agentsCall?.[0]).toContain('3');
      expect(agentsCall?.[0]).toContain('agents found');
    });

    it('should use singular form for one agent', () => {
      const agents: AgentsCheckResult = {
        globalAgentsPath: '/home/user/.config/overture/agents',
        globalAgentsDirExists: true,
        globalAgentCount: 1,
        globalAgentErrors: [],
        projectAgentsPath: null,
        projectAgentsDirExists: false,
        projectAgentCount: 0,
        projectAgentErrors: [],
        modelsConfigPath: '/home/user/.config/overture/models.yaml',
        modelsConfigExists: true,
        modelsConfigValid: true,
        modelsConfigError: null,
      };

      formatter['formatAgentsStatus'](agents, 'Global', false);

      // The full message includes "Global Agents - 1 agent found"
      const successCalls = vi.mocked(output.success).mock.calls;
      const agentsCall = successCalls.find((call) =>
        call[0]?.toString().includes('Global Agents'),
      );
      expect(agentsCall).toBeDefined();
      expect(agentsCall?.[0]).toContain('1');
      expect(agentsCall?.[0]).toContain('agent found');
    });

    it('should display warning when agents have errors', () => {
      const agents: AgentsCheckResult = {
        globalAgentsPath: '/home/user/.config/overture/agents',
        globalAgentsDirExists: true,
        globalAgentCount: 2,
        globalAgentErrors: ['agent1.yaml: Missing required field'],
        projectAgentsPath: null,
        projectAgentsDirExists: false,
        projectAgentCount: 0,
        projectAgentErrors: [],
        modelsConfigPath: '/home/user/.config/overture/models.yaml',
        modelsConfigExists: true,
        modelsConfigValid: true,
        modelsConfigError: null,
      };

      formatter['formatAgentsStatus'](agents, 'Global', false);

      // The full message includes warning about errors
      const warnCalls = vi.mocked(output.warn).mock.calls;
      const errorsCall = warnCalls.find((call) =>
        call[0]?.toString().includes('errors'),
      );
      expect(errorsCall).toBeDefined();
      expect(errorsCall?.[0]).toContain('2');
      expect(errorsCall?.[0]).toContain('1');
    });

    it('should display errors in verbose mode', () => {
      const agents: AgentsCheckResult = {
        globalAgentsPath: '/home/user/.config/overture/agents',
        globalAgentsDirExists: true,
        globalAgentCount: 2,
        globalAgentErrors: [
          'agent1.yaml: Missing required field',
          'agent2.yaml: Invalid YAML',
        ],
        projectAgentsPath: null,
        projectAgentsDirExists: false,
        projectAgentCount: 0,
        projectAgentErrors: [],
        modelsConfigPath: '/home/user/.config/overture/models.yaml',
        modelsConfigExists: true,
        modelsConfigValid: true,
        modelsConfigError: null,
      };

      formatter['formatAgentsStatus'](agents, 'Global', true);

      expect(output.warn).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Validation errors:'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('agent1.yaml: Missing required field'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('agent2.yaml: Invalid YAML'),
      );
    });

    it('should not display errors when verbose is false', () => {
      const agents: AgentsCheckResult = {
        globalAgentsPath: '/home/user/.config/overture/agents',
        globalAgentsDirExists: true,
        globalAgentCount: 2,
        globalAgentErrors: ['agent1.yaml: Missing required field'],
        projectAgentsPath: null,
        projectAgentsDirExists: false,
        projectAgentCount: 0,
        projectAgentErrors: [],
        modelsConfigPath: '/home/user/.config/overture/models.yaml',
        modelsConfigExists: true,
        modelsConfigValid: true,
        modelsConfigError: null,
      };

      formatter['formatAgentsStatus'](agents, 'Global', false);

      // In non-verbose mode, should not show detailed error messages
      const calls = vi.mocked(consoleLogSpy).mock.calls;
      const hasValidationErrors = calls.some((call) =>
        call[0]?.toString().includes('Validation errors:'),
      );
      expect(hasValidationErrors).toBe(false);
    });

    it('should display warning when agents directory is empty', () => {
      const agents: AgentsCheckResult = {
        globalAgentsPath: '/home/user/.config/overture/agents',
        globalAgentsDirExists: true,
        globalAgentCount: 0,
        globalAgentErrors: [],
        projectAgentsPath: null,
        projectAgentsDirExists: false,
        projectAgentCount: 0,
        projectAgentErrors: [],
        modelsConfigPath: '/home/user/.config/overture/models.yaml',
        modelsConfigExists: true,
        modelsConfigValid: true,
        modelsConfigError: null,
      };

      formatter['formatAgentsStatus'](agents, 'Global', false);

      expect(output.warn).toHaveBeenCalledWith(
        expect.stringContaining('empty'),
      );
    });

    it('should display warning when agents directory does not exist', () => {
      const agents: AgentsCheckResult = {
        globalAgentsPath: '/home/user/.config/overture/agents',
        globalAgentsDirExists: false,
        globalAgentCount: 0,
        globalAgentErrors: [],
        projectAgentsPath: null,
        projectAgentsDirExists: false,
        projectAgentCount: 0,
        projectAgentErrors: [],
        modelsConfigPath: '/home/user/.config/overture/models.yaml',
        modelsConfigExists: true,
        modelsConfigValid: true,
        modelsConfigError: null,
      };

      formatter['formatAgentsStatus'](agents, 'Global', false);

      expect(output.warn).toHaveBeenCalledWith(
        expect.stringContaining('not found'),
      );
    });

    it('should display project agents when they exist', () => {
      const agents: AgentsCheckResult = {
        globalAgentsPath: '/home/user/.config/overture/agents',
        globalAgentsDirExists: true,
        globalAgentCount: 2,
        globalAgentErrors: [],
        projectAgentsPath: '/project/.overture/agents',
        projectAgentsDirExists: true,
        projectAgentCount: 3,
        projectAgentErrors: [],
        modelsConfigPath: '/home/user/.config/overture/models.yaml',
        modelsConfigExists: true,
        modelsConfigValid: true,
        modelsConfigError: null,
      };

      formatter['formatAgentsStatus'](agents, 'Global', false);

      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('Project Agents'),
      );
      // Should have two success calls: one for global, one for project
      const successCalls = vi.mocked(output.success).mock.calls;
      const projectAgentsCall = successCalls.find((call) =>
        call[0]?.toString().includes('Project Agents'),
      );
      expect(projectAgentsCall).toBeDefined();
      expect(projectAgentsCall?.[0]).toContain('3');
      expect(projectAgentsCall?.[0]).toContain('agents found');
    });

    it('should display project agent errors in verbose mode', () => {
      const agents: AgentsCheckResult = {
        globalAgentsPath: '/home/user/.config/overture/agents',
        globalAgentsDirExists: true,
        globalAgentCount: 2,
        globalAgentErrors: [],
        projectAgentsPath: '/project/.overture/agents',
        projectAgentsDirExists: true,
        projectAgentCount: 1,
        projectAgentErrors: ['project-agent.yaml: Invalid'],
        modelsConfigPath: '/home/user/.config/overture/models.yaml',
        modelsConfigExists: true,
        modelsConfigValid: true,
        modelsConfigError: null,
      };

      formatter['formatAgentsStatus'](agents, 'Global', true);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('project-agent.yaml: Invalid'),
      );
    });
  });

  describe('formatModelsConfigStatus', () => {
    it('should display success when models config is valid', () => {
      const agents: AgentsCheckResult = {
        globalAgentsPath: '/home/user/.config/overture/agents',
        globalAgentsDirExists: true,
        globalAgentCount: 2,
        globalAgentErrors: [],
        projectAgentsPath: null,
        projectAgentsDirExists: false,
        projectAgentCount: 0,
        projectAgentErrors: [],
        modelsConfigPath: '/home/user/.config/overture/models.yaml',
        modelsConfigExists: true,
        modelsConfigValid: true,
        modelsConfigError: null,
      };

      formatter['formatModelsConfigStatus'](agents);

      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('Models config'),
      );
    });

    it('should display error when models config is invalid', () => {
      const agents: AgentsCheckResult = {
        globalAgentsPath: '/home/user/.config/overture/agents',
        globalAgentsDirExists: true,
        globalAgentCount: 2,
        globalAgentErrors: [],
        projectAgentsPath: null,
        projectAgentsDirExists: false,
        projectAgentCount: 0,
        projectAgentErrors: [],
        modelsConfigPath: '/home/user/.config/overture/models.yaml',
        modelsConfigExists: true,
        modelsConfigValid: false,
        modelsConfigError: 'Invalid YAML syntax',
      };

      formatter['formatModelsConfigStatus'](agents);

      expect(output.error).toHaveBeenCalledWith(
        expect.stringContaining('invalid'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid YAML syntax'),
      );
    });

    it('should display warning when models config does not exist', () => {
      const agents: AgentsCheckResult = {
        globalAgentsPath: '/home/user/.config/overture/agents',
        globalAgentsDirExists: true,
        globalAgentCount: 2,
        globalAgentErrors: [],
        projectAgentsPath: null,
        projectAgentsDirExists: false,
        projectAgentCount: 0,
        projectAgentErrors: [],
        modelsConfigPath: '/home/user/.config/overture/models.yaml',
        modelsConfigExists: false,
        modelsConfigValid: false,
        modelsConfigError: null,
      };

      formatter['formatModelsConfigStatus'](agents);

      expect(output.warn).toHaveBeenCalledWith(
        expect.stringContaining('not found'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Create'),
      );
    });
  });
});
