/**
 * Contract tests for the Claude Code metadata-only MCP write (E3 slice).
 *
 * These tests cover the E3 wiring contract:
 *  1. `not-targetable` when no applicable target file exists.
 *  2. `dryRun` is honored (echoed on the result).
 *  3. The result carries no raw bytes regardless of the reason.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeClaudeCodeMcpConfig } from './claude-code-write.js';
import type {
  AgentMcpWriteInput,
  AgentMcpWriteResult,
  PathResolutionContext,
} from './types.js';

const EMPTY_CTX = {
  homeDir: '',
  configDir: '',
  workspaceDir: '',
  platform: 'linux' as const,
} satisfies PathResolutionContext;

let scratchDir = '';

beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'overture-claude-write-'));
});

afterEach(async () => {
  if (scratchDir) {
    await rm(scratchDir, { recursive: true, force: true });
    scratchDir = '';
  }
});

function makeCtx(): PathResolutionContext {
  return {
    homeDir: scratchDir,
    configDir: scratchDir,
    workspaceDir: join(scratchDir, 'workspace'),
    platform: 'linux',
  };
}

function makeInput(
  ctx: PathResolutionContext | undefined,
  dryRun?: boolean,
): AgentMcpWriteInput {
  return {
    servers: [],
    ...(dryRun === undefined ? {} : { dryRun }),
    ...(ctx === undefined ? {} : { pathContext: ctx }),
  };
}

describe('writeClaudeCodeMcpConfig', () => {
  it('returns not-targetable when no applicable target exists', async () => {
    const result = await writeClaudeCodeMcpConfig(
      makeCtx(),
      makeInput(undefined),
    );

    expect(result.written).toBe(0);
    expect(result.changed).toBe(false);
    expect(result.dryRun).toBe(false);
    expect(result.serversWritten).toEqual([]);
    expect(result.targetPaths).toEqual([]);
    expect(result.reason).toBe('not-targetable');
  });

  it('returns not-targetable when pathContext is omitted', async () => {
    const result = await writeClaudeCodeMcpConfig(
      EMPTY_CTX,
      makeInput(undefined),
    );

    expect(result.reason).toBe('not-targetable');
    expect(result.targetPaths).toEqual([]);
  });

  it('respects dryRun when no target', async () => {
    const result = await writeClaudeCodeMcpConfig(
      makeCtx(),
      makeInput(undefined, true),
    );

    expect(result.dryRun).toBe(true);
    expect(result.reason).toBe('not-targetable');
    expect(result.changed).toBe(false);
  });

  it('returns metadata (no raw bytes) regardless of reason', async () => {
    const result: AgentMcpWriteResult = await writeClaudeCodeMcpConfig(
      makeCtx(),
      makeInput(undefined),
    );

    const forbidden = [
      'original',
      'writtenBytes',
      'raw',
      'contents',
      'rawBytes',
      'originalBytes',
      'configText',
      'fileContents',
    ];
    const keys = Object.keys(result);
    for (const f of forbidden) {
      expect(keys).not.toContain(f);
    }

    // Strictly no string key matches /original|writtenBytes|raw|contents/i
    const rawPattern = /original|writtenBytes|raw|contents/i;
    const rawKeys = keys.filter((k) => rawPattern.test(k));
    expect(rawKeys).toHaveLength(0);
  });
});
