/**
 * Contract tests for the GitHub Copilot CLI metadata-only MCP write (E3 slice).
 *
 * These tests cover the E3 wiring contract:
 *  1. `not-targetable` when no applicable target file exists.
 *  2. `dryRun` is honored (echoed on the result).
 *  3. The result carries no raw bytes regardless of the reason.
 */
import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeGitHubCopilotCliMcpConfig } from './github-copilot-cli-write.js';
import type { PathResolutionContext } from './types.js';

const EMPTY_CTX = {
  homeDir: '',
  configDir: '',
  workspaceDir: '',
  platform: 'linux' as const,
} satisfies PathResolutionContext;

async function tmp(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'copilot-write-'));
}

describe('writeGitHubCopilotCliMcpConfig', () => {
  it('returns not-targetable when no pathContext', async () => {
    const res = await writeGitHubCopilotCliMcpConfig(EMPTY_CTX, {
      servers: [],
    });
    expect(res.reason).toBe('not-targetable');
    expect(res.written).toBe(0);
    expect(res.changed).toBe(false);
  });

  it('returns not-targetable when neither workspace nor user config exists', async () => {
    const home = await tmp();
    try {
      const ctx = {
        homeDir: home,
        configDir: home,
        workspaceDir: '/nonexistent',
        platform: 'linux' as const,
      };
      const res = await writeGitHubCopilotCliMcpConfig(ctx, {
        servers: [],
      });
      expect(res.reason).toBe('not-targetable');
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it('returns metadata-only result (no raw bytes)', async () => {
    const home = await tmp();
    const ws = await tmp();
    try {
      const copilotDir = join(home, '.copilot');
      await mkdir(copilotDir, { recursive: true });
      const userConfig = join(copilotDir, 'mcp-config.json');
      await writeFile(userConfig, '{"mcpServers":{}}');
      const ctx = {
        homeDir: home,
        configDir: home,
        workspaceDir: ws,
        platform: 'linux' as const,
      };
      const res = await writeGitHubCopilotCliMcpConfig(ctx, {
        servers: [],
        dryRun: true,
      });
      expect(res.dryRun).toBe(true);
      // No raw bytes field; only metadata.
      expect(
        (res as unknown as { original?: unknown }).original,
      ).toBeUndefined();
      expect(
        (res as unknown as { written_bytes?: unknown }).written_bytes,
      ).toBeUndefined();
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(ws, { recursive: true, force: true });
    }
  });
});
