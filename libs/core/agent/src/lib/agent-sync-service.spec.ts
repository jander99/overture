import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentSyncService } from './agent-sync-service.js';
import { FilesystemPort } from '@overture/ports-filesystem';
import { OutputPort } from '@overture/ports-output';

describe('AgentSyncService', () => {
  let filesystem: vi.Mocked<FilesystemPort>;
  let output: vi.Mocked<OutputPort>;
  let service: AgentSyncService;

  const homeDir = '/home/user';
  const xdgConfigHome = '/home/user/.config';

  beforeEach(() => {
    filesystem = {
      exists: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      readdir: vi.fn(),
    } as any;

    output = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      success: vi.fn(),
    } as any;

    service = new AgentSyncService(filesystem, output, homeDir, xdgConfigHome);
  });

  it('should sync agents from global directory', async () => {
    // Mock model mapping
    filesystem.exists.mockImplementation(async (path) => {
      if (path === `${xdgConfigHome}/overture/models.yaml`) return true;
      if (path === `${xdgConfigHome}/overture/agents`) return true;
      if (path === `${xdgConfigHome}/overture/agents/test.md`) return true;
      return false;
    });

    filesystem.readFile.mockImplementation(async (path) => {
      if (path === `${xdgConfigHome}/overture/models.yaml`) return 'smart: { "claude-code": "sonnet" }';
      if (path === `${xdgConfigHome}/overture/agents/test.yaml`) {
        return 'name: test\ndescription: test agent';
      }
      if (path === `${xdgConfigHome}/overture/agents/test.md`) {
        return 'test body';
      }
      return '';
    });

    filesystem.readdir.mockResolvedValue(['test.yaml']);

    const summary = await service.syncAgents({ clients: ['claude-code'] });

    expect(summary.total).toBe(1);
    expect(summary.synced).toBe(1);
    expect(filesystem.writeFile).toHaveBeenCalledWith(
      `${homeDir}/.claude/agents/test.md`,
      expect.stringContaining('test body')
    );
  });

  it('should handle missing global agents directory', async () => {
    filesystem.exists.mockResolvedValue(false);
    const summary = await service.syncAgents();
    expect(summary.total).toBe(0);
  });
});
