import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncFormatter } from './sync-formatter.js';
import type { OutputPort } from '@overture/ports-output';
import type { SyncResult, ClientSyncResult } from '@overture/sync-core';
import type { ClientName } from '@overture/config-types';

function createMockOutput(): OutputPort {
  return {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    section: vi.fn(),
    nl: vi.fn(),
    skip: vi.fn(),
    plain: vi.fn(),
  };
}

function createMockClientResult(
  client: ClientName,
  overrides: Partial<ClientSyncResult> = {},
): ClientSyncResult {
  return {
    client,
    success: true,
    configPath: `/home/user/.${client}.json`,
    warnings: [],
    ...overrides,
  };
}

function createMockSyncResult(overrides: Partial<SyncResult> = {}): SyncResult {
  return {
    success: true,
    results: [],
    warnings: [],
    errors: [],
    ...overrides,
  };
}

describe('SyncFormatter', () => {
  let output: OutputPort;
  let formatter: SyncFormatter;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    output = createMockOutput();
    formatter = new SyncFormatter(output);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('generateMcpTable', () => {
    it('should return empty string when no MCP servers', () => {
      const result = createMockSyncResult({
        results: [createMockClientResult('claude-code')],
      });

      const table = formatter.generateMcpTable(result);
      expect(table).toBe('');
    });

    it('should generate table with MCP servers', () => {
      const result = createMockSyncResult({
        results: [
          createMockClientResult('claude-code', {
            success: true,
            mcpSources: {
              filesystem: 'global',
              memory: 'project',
            },
          }),
        ],
      });

      const table = formatter.generateMcpTable(result);
      expect(table).toContain('MCP Server');
      expect(table).toContain('Source');
      expect(table).toContain('claude-code');
      expect(table).toContain('filesystem');
      expect(table).toContain('Global');
      expect(table).toContain('memory');
      expect(table).toContain('Project');
    });

    it('should sort global MCPs before project MCPs', () => {
      const result = createMockSyncResult({
        results: [
          createMockClientResult('claude-code', {
            success: true,
            mcpSources: {
              'z-project': 'project',
              'a-global': 'global',
            },
          }),
        ],
      });

      const table = formatter.generateMcpTable(result);
      const lines = table.split('\n');
      const dataLines = lines.slice(2);

      const globalIndex = dataLines.findIndex((l) => l.includes('a-global'));
      const projectIndex = dataLines.findIndex((l) => l.includes('z-project'));
      expect(globalIndex).toBeLessThan(projectIndex);
    });
  });

  describe('displayDetectionSummary', () => {
    it('should display detected clients', () => {
      const result = createMockSyncResult({
        results: [
          createMockClientResult('claude-code', {
            binaryDetection: {
              status: 'found',
              version: '1.0.0',
              configPath: '/home/user/.claude.json',
              warnings: [],
            },
          }),
        ],
      });

      formatter.displayDetectionSummary(result);

      expect(output.section).toHaveBeenCalledWith('🔍 Detecting clients...');
      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('claude-code'),
      );
    });

    it('should display skipped clients', () => {
      const result = createMockSyncResult({
        results: [
          createMockClientResult('opencode', {
            error: 'Skipped - client not detected on system',
          }),
        ],
      });

      formatter.displayDetectionSummary(result);

      expect(output.skip).toHaveBeenCalledWith(
        expect.stringContaining('opencode'),
      );
    });

    it('should display undetected but synced clients', () => {
      const result = createMockSyncResult({
        results: [
          createMockClientResult('copilot-cli', {
            binaryDetection: {
              status: 'not-found',
              warnings: [],
            },
          }),
        ],
      });

      formatter.displayDetectionSummary(result);

      expect(output.warn).toHaveBeenCalledWith(
        expect.stringContaining('not detected but config will be generated'),
      );
    });
  });

  describe('displayAgentsSummary', () => {
    it('should not display when no agents', () => {
      const result = createMockSyncResult();
      formatter.displayAgentsSummary(result, false);

      expect(output.info).not.toHaveBeenCalledWith('🤖 Agents:');
    });

    it('should display synced agents', () => {
      const result = createMockSyncResult({
        agentSyncSummary: {
          total: 2,
          synced: 2,
          failed: 0,
          results: [
            {
              agent: 'test-agent',
              success: true,
              clientResults: {
                'claude-code': { success: true },
                'copilot-cli': { success: true },
                opencode: { success: true },
              },
            },
          ],
        },
      });

      formatter.displayAgentsSummary(result, false);

      expect(output.info).toHaveBeenCalledWith('🤖 Agents:');
      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('Synced'),
      );
    });

    it('should display failed agents in detail mode', () => {
      const result = createMockSyncResult({
        agentSyncSummary: {
          total: 2,
          synced: 1,
          failed: 1,
          results: [
            {
              agent: 'failed-agent',
              success: false,
              clientResults: {
                'claude-code': { success: false, error: 'failed' },
                'copilot-cli': { success: false, error: 'failed' },
                opencode: { success: false, error: 'failed' },
              },
            },
          ],
        },
      });

      formatter.displayAgentsSummary(result, true);

      expect(output.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed'),
      );
      expect(output.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed-agent'),
      );
    });
  });

  describe('displaySkillsSummary', () => {
    it('should not display when no skills', () => {
      const result = createMockSyncResult();
      formatter.displaySkillsSummary(result, false);

      expect(output.info).not.toHaveBeenCalledWith('📚 Skills:');
    });

    it('should display synced skills', () => {
      const result = createMockSyncResult({
        skillSyncSummary: {
          total: 3,
          synced: 2,
          failed: 0,
          skipped: 1,
          results: [
            {
              skill: 'skill1',
              client: 'claude-code',
              success: true,
              targetPath: '/home/user/.claude/skills/skill1/SKILL.md',
            },
            {
              skill: 'skill1',
              client: 'opencode',
              success: true,
              targetPath: '/home/user/.config/opencode/skills/skill1/SKILL.md',
            },
            {
              skill: 'skill2',
              client: 'claude-code',
              success: true,
              skipped: true,
              targetPath: '/home/user/.claude/skills/skill2/SKILL.md',
            },
          ],
        },
      });

      formatter.displaySkillsSummary(result, false);

      expect(output.info).toHaveBeenCalledWith('📚 Skills:');
      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('Synced'),
      );
      expect(output.info).toHaveBeenCalledWith(
        expect.stringContaining('Skipped'),
      );
    });
  });

  describe('displaySyncResults', () => {
    it('should display successful sync for detected clients', () => {
      const result = createMockSyncResult({
        results: [
          createMockClientResult('claude-code', {
            success: true,
            binaryDetection: {
              status: 'found',
              version: '1.0.0',
              configPath: '/path',
              warnings: [],
            },
            configType: 'user',
          }),
        ],
      });

      formatter.displaySyncResults(result, false);

      expect(output.section).toHaveBeenCalledWith(
        '⚙️  Syncing configurations...',
      );
      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('synchronized'),
      );
    });

    it('should display failed sync', () => {
      const result = createMockSyncResult({
        results: [
          createMockClientResult('claude-code', {
            success: false,
            binaryDetection: {
              status: 'found',
              version: '1.0.0',
              configPath: '/path',
              warnings: [],
            },
          }),
        ],
      });

      formatter.displaySyncResults(result, false);

      expect(output.error).toHaveBeenCalledWith(
        expect.stringContaining('sync failed'),
      );
    });
  });

  describe('displayWarnings', () => {
    it('should display global warnings', () => {
      const result = createMockSyncResult({
        warnings: ['Config validation warning'],
        results: [],
      });

      formatter.displayWarnings(result, false);

      expect(output.section).toHaveBeenCalledWith('⚠️  Warnings:');
      expect(output.warn).toHaveBeenCalledWith('Configuration:');
    });

    it('should display client warnings', () => {
      const result = createMockSyncResult({
        results: [
          createMockClientResult('claude-code', {
            warnings: ['Permission denied error'],
          }),
        ],
      });

      formatter.displayWarnings(result, false);

      expect(output.warn).toHaveBeenCalledWith(
        expect.stringContaining('claude-code'),
      );
    });

    it('should display tips separately', () => {
      const result = createMockSyncResult({
        results: [
          createMockClientResult('claude-code', {
            warnings: ['💡 Tip: Use --detail for more info'],
          }),
        ],
      });

      formatter.displayWarnings(result, false);

      expect(output.info).toHaveBeenCalledWith(
        expect.stringContaining('💡 Tip'),
      );
    });

    it('should display errors', () => {
      const result = createMockSyncResult({
        errors: ['Critical sync error'],
      });

      formatter.displayWarnings(result, false);

      expect(output.section).toHaveBeenCalledWith('❌ Errors:');
      expect(output.error).toHaveBeenCalledWith(
        expect.stringContaining('Critical sync error'),
      );
    });
  });

  describe('displayBackupInfo', () => {
    it('should not display in non-detail mode', () => {
      const result = createMockSyncResult({
        results: [
          createMockClientResult('claude-code', {
            backupPath: '/backups/backup.json',
          }),
        ],
      });

      formatter.displayBackupInfo(result, false);

      expect(output.section).not.toHaveBeenCalledWith('💾 Backups:');
    });

    it('should display backup paths in detail mode', () => {
      const result = createMockSyncResult({
        results: [
          createMockClientResult('claude-code', {
            backupPath: '/backups/backup.json',
          }),
        ],
      });

      formatter.displayBackupInfo(result, true);

      expect(output.section).toHaveBeenCalledWith('💾 Backups:');
      expect(output.info).toHaveBeenCalledWith(
        expect.stringContaining('claude-code'),
      );
    });
  });

  describe('displayFinalStatus', () => {
    it('should display success message on success', () => {
      const result = createMockSyncResult({ success: true });
      formatter.displayFinalStatus(result);

      expect(output.success).toHaveBeenCalledWith('Sync complete!');
    });

    it('should display error message on failure', () => {
      const result = createMockSyncResult({ success: false });
      formatter.displayFinalStatus(result);

      expect(output.error).toHaveBeenCalledWith('Sync completed with errors');
    });
  });

  describe('displayMcpTable', () => {
    it('should not display when no MCP table generated', () => {
      const result = createMockSyncResult();
      formatter.displayMcpTable(result);

      expect(output.section).not.toHaveBeenCalledWith(
        '📋 MCP Server Configuration:',
      );
    });

    it('should display MCP table when available', () => {
      const result = createMockSyncResult({
        results: [
          createMockClientResult('claude-code', {
            success: true,
            mcpSources: { filesystem: 'global' },
          }),
        ],
      });

      formatter.displayMcpTable(result);

      expect(output.section).toHaveBeenCalledWith(
        '📋 MCP Server Configuration:',
      );
      expect(output.plain).toHaveBeenCalled();
    });
  });

  describe('displayPluginSyncPlan', () => {
    it('should not display in non-detail mode', () => {
      const result = createMockSyncResult({
        pluginSyncDetails: {
          configured: 5,
          installed: 3,
          toInstall: [{ name: 'plugin1', marketplace: 'npm' }],
        },
      });

      formatter.displayPluginSyncPlan(result, false);

      expect(output.section).not.toHaveBeenCalledWith('📦 Plugin Sync Plan:');
    });

    it('should display plugins to install in detail mode', () => {
      const result = createMockSyncResult({
        pluginSyncDetails: {
          configured: 5,
          installed: 3,
          toInstall: [{ name: 'plugin1', marketplace: 'npm' }],
        },
      });

      formatter.displayPluginSyncPlan(result, true);

      expect(output.section).toHaveBeenCalledWith('📦 Plugin Sync Plan:');
      expect(output.info).toHaveBeenCalledWith(
        expect.stringContaining('Configured: 5'),
      );
      expect(output.info).toHaveBeenCalledWith(
        expect.stringContaining('To install: 1'),
      );
    });

    it('should show all installed message when nothing to install', () => {
      const result = createMockSyncResult({
        pluginSyncDetails: {
          configured: 3,
          installed: 3,
          toInstall: [],
        },
      });

      formatter.displayPluginSyncPlan(result, true);

      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('All plugins already installed'),
      );
    });
  });
});
