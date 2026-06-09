import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve as pathResolve } from 'node:path';
import type { AgentDefinition } from './types.js';
import type { PathResolutionContext, PlatformId } from '../types.js';

// Per-test scratch directory. The reader resolves paths against
// PathResolutionContext, so we point homeDir/configDir/workspaceDir at a
// fresh tmpdir and seed fixture files there. Real-fs tests are more
// reliable than module-mocked tests in the @nx/vitest executor's pool
// configuration (cross-file module cache can defeat vi.mock for
// node:fs/promises).
let scratchDir = '';

// Import after the test setup so each test gets a fresh scratch dir
// before exercising the readers.
import { claudeCode } from './claude-code.js';
import { claudeDesktop } from './claude-desktop.js';
import { opencode } from './opencode.js';
import { githubCopilotVscode } from './github-copilot-vscode.js';
import { githubCopilotCli } from './github-copilot-cli.js';
import { cursor } from './cursor.js';
import { windsurf } from './windsurf.js';
import { cline } from './cline.js';
import { rooCode } from './roo-code.js';
import { continueDef } from './continue.js';
import { zed } from './zed.js';
import { openaiCodex } from './openai-codex.js';
import { aider } from './aider.js';
import { githubCopilotCloudAgent } from './github-copilot-cloud-agent.js';

beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'overture-reader-'));
  // Pre-create the per-platform config subdirs so the reader can resolve
  // base:'config' and base:'workspace' lookups without hitting ENOENT
  // for the parent.
  await mkdir(join(scratchDir, '.config'), { recursive: true });
  await mkdir(join(scratchDir, 'workspace'), { recursive: true });
});

afterEach(async () => {
  if (scratchDir) {
    await rm(scratchDir, { recursive: true, force: true });
  }
});

function readerCtx(
  overrides: Partial<PathResolutionContext> = {},
): PathResolutionContext {
  return {
    homeDir: scratchDir,
    configDir: join(scratchDir, '.config'),
    workspaceDir: join(scratchDir, 'workspace'),
    platform: 'linux',
    ...overrides,
  };
}

async function seed(
  base: 'home' | 'config' | 'workspace',
  relativePath: string,
  contents: string,
  ctx: PathResolutionContext,
): Promise<string> {
  const dir =
    base === 'home'
      ? ctx.homeDir
      : base === 'config'
        ? ctx.configDir
        : ctx.workspaceDir;
  const fullPath = join(dir, relativePath);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, contents, 'utf8');
  return fullPath;
}

describe('per-agent mcp.read returns typed *McpConfig shape', () => {
  it('claude-code reads mcpServers from .claude.json', async () => {
    const ctx = readerCtx();
    await seed(
      'home',
      '.claude.json',
      JSON.stringify({ mcpServers: { x: { command: 'y' } } }),
      ctx,
    );
    const result = await claudeCode.mcp.read(ctx);
    expect(result.config).not.toBeNull();
    expect(result.nonEmpty).toBe(true);
    expect(result.parseError).toBeUndefined();
    if (result.config !== null) {
      const config = result.config as {
        mcpServers?: { x?: { command?: string } };
      };
      expect(config.mcpServers?.x?.command).toBe('y');
    }
  });

  it('claude-desktop reads mcpServers from Linux config path', async () => {
    const ctx = readerCtx();
    await seed(
      'config',
      'Claude/claude_desktop_config.json',
      JSON.stringify({
        mcpServers: { s: { command: 'node', args: ['m.js'] } },
      }),
      ctx,
    );
    const result = await claudeDesktop.mcp.read(ctx);
    expect(result.config).not.toBeNull();
    expect(result.nonEmpty).toBe(true);
    if (result.config !== null) {
      const config = result.config as {
        mcpServers?: { s?: { command?: string } };
      };
      expect(config.mcpServers?.s?.command).toBe('node');
    }
  });

  it('opencode reads mcp map from opencode.json', async () => {
    const ctx = readerCtx();
    await seed(
      'config',
      'opencode/opencode.json',
      JSON.stringify({
        mcp: { s: { type: 'local', command: ['npx', '-y', 'mcp'] } },
      }),
      ctx,
    );
    const result = await opencode.mcp.read(ctx);
    expect(result.config).not.toBeNull();
    expect(result.nonEmpty).toBe(true);
    if (result.config !== null) {
      const config = result.config as { mcp?: { s?: { type?: string } } };
      expect(config.mcp?.s?.type).toBe('local');
    }
  });

  it('github-copilot-vscode reads servers map from .vscode/mcp.json', async () => {
    const ctx = readerCtx();
    await seed(
      'home',
      '.vscode/mcp.json',
      JSON.stringify({ servers: { s: { type: 'stdio', command: 'c' } } }),
      ctx,
    );
    const result = await githubCopilotVscode.mcp.read(ctx);
    expect(result.config).not.toBeNull();
    expect(result.nonEmpty).toBe(true);
    if (result.config !== null) {
      const config = result.config as {
        servers?: { s?: { command?: string } };
      };
      expect(config.servers?.s?.command).toBe('c');
    }
  });

  it('github-copilot-cli reads mcpServers from .copilot/mcp-config.json', async () => {
    const ctx = readerCtx();
    await seed(
      'home',
      '.copilot/mcp-config.json',
      JSON.stringify({ mcpServers: { s: { type: 'local', command: 'c' } } }),
      ctx,
    );
    const result = await githubCopilotCli.mcp.read(ctx);
    expect(result.config).not.toBeNull();
    expect(result.nonEmpty).toBe(true);
    if (result.config !== null) {
      const config = result.config as {
        mcpServers?: { s?: { type?: string } };
      };
      expect(config.mcpServers?.s?.type).toBe('local');
    }
  });
  it('cursor reads mcpServers from .cursor/mcp.json', async () => {
    const ctx = readerCtx();
    await seed(
      'home',
      '.cursor/mcp.json',
      JSON.stringify({ mcpServers: { s: { command: 'c' } } }),
      ctx,
    );
    const result = await cursor.mcp.read(ctx);
    expect(result.config).not.toBeNull();
    expect(result.nonEmpty).toBe(true);
    if (result.config !== null) {
      const config = result.config as {
        mcpServers?: { s?: { command?: string } };
      };
      expect(config.mcpServers?.s?.command).toBe('c');
    }
  });

  it('windsurf reads mcpServers from .codeium/windsurf/mcp_config.json', async () => {
    const ctx = readerCtx();
    await seed(
      'home',
      '.codeium/windsurf/mcp_config.json',
      JSON.stringify({ mcpServers: { s: { command: 'c' } } }),
      ctx,
    );
    const result = await windsurf.mcp.read(ctx);
    expect(result.config).not.toBeNull();
    expect(result.nonEmpty).toBe(true);
    if (result.config !== null) {
      const config = result.config as {
        mcpServers?: { s?: { command?: string } };
      };
      expect(config.mcpServers?.s?.command).toBe('c');
    }
  });

  it('cline reads mcpServers from current ~/.cline/mcp.json', async () => {
    const ctx = readerCtx();
    await seed(
      'home',
      '.cline/mcp.json',
      JSON.stringify({ mcpServers: { s: { command: 'c' } } }),
      ctx,
    );
    const result = await cline.mcp.read(ctx);
    expect(result.config).not.toBeNull();
    expect(result.nonEmpty).toBe(true);
    if (result.config !== null) {
      const config = result.config as {
        mcpServers?: { s?: { command?: string } };
      };
      expect(config.mcpServers?.s?.command).toBe('c');
    }
  });
  it('roo-code reads mcpServers from project-local .roo/mcp.json', async () => {
    const ctx = readerCtx();
    await seed(
      'workspace',
      '.roo/mcp.json',
      JSON.stringify({ mcpServers: { s: { command: 'c' } } }),
      ctx,
    );
    const result = await rooCode.mcp.read(ctx);
    expect(result.config).not.toBeNull();
    expect(result.nonEmpty).toBe(true);
    if (result.config !== null) {
      const config = result.config as {
        mcpServers?: { s?: { command?: string } };
      };
      expect(config.mcpServers?.s?.command).toBe('c');
    }
  });
  it('continue reads mcpServers from project-local .continue/mcpServers/mcp.json', async () => {
    const ctx = readerCtx();
    await seed(
      'workspace',
      '.continue/mcpServers/mcp.json',
      JSON.stringify({ mcpServers: { s: { command: 'c' } } }),
      ctx,
    );
    const result = await continueDef.mcp.read(ctx);
    expect(result.config).not.toBeNull();
    expect(result.nonEmpty).toBe(true);
    if (result.config !== null) {
      const config = result.config as {
        mcpServers?: { s?: { command?: string } };
      };
      expect(config.mcpServers?.s?.command).toBe('c');
    }
  });
  it('zed reads context_servers from zed/settings.json', async () => {
    const ctx = readerCtx();
    await seed(
      'config',
      'zed/settings.json',
      JSON.stringify({ context_servers: { s: { command: 'c' } } }),
      ctx,
    );
    const result = await zed.mcp.read(ctx);
    expect(result.config).not.toBeNull();
    expect(result.nonEmpty).toBe(true);
    if (result.config !== null) {
      const config = result.config as {
        context_servers?: { s?: { command?: string } };
      };
      expect(config.context_servers?.s?.command).toBe('c');
    }
  });

  it('openai-codex reads mcp_servers TOML from .codex/config.toml', async () => {
    const ctx = readerCtx();
    await seed(
      'home',
      '.codex/config.toml',
      '[mcp_servers.s]\ncommand = "codex-mcp"\n',
      ctx,
    );
    const result = await openaiCodex.mcp.read(ctx);
    expect(result.config).not.toBeNull();
    expect(result.nonEmpty).toBe(true);
    if (result.config !== null) {
      const config = result.config as {
        mcp_servers?: { s?: { command?: string } };
      };
      expect(config.mcp_servers?.s?.command).toBe('codex-mcp');
    }
  });
});

// Missing-file semantics: every applicable location ENOENT, reader reports
// "not configured" without throwing.
describe('per-agent mcp.read handles missing files', () => {
  const supported: readonly {
    id: PlatformId;
    agent: AgentDefinition;
  }[] = [
    { id: 'claude-code', agent: claudeCode },
    { id: 'claude-desktop', agent: claudeDesktop },
    { id: 'opencode', agent: opencode },
    { id: 'github-copilot-vscode', agent: githubCopilotVscode },
    { id: 'github-copilot-cli', agent: githubCopilotCli },
    { id: 'cursor', agent: cursor },
    { id: 'windsurf', agent: windsurf },
    { id: 'cline', agent: cline },
    { id: 'roo-code', agent: rooCode },
    { id: 'continue', agent: continueDef },
    { id: 'zed', agent: zed },
    { id: 'openai-codex', agent: openaiCodex },
  ];

  for (const { id, agent } of supported) {
    it(`${id}: ENOENT yields config=null, nonEmpty=false, no parseError`, async () => {
      const result = await agent.mcp.read(readerCtx({ platform: 'linux' }));
      expect(result.config).toBeNull();
      expect(result.nonEmpty).toBe(false);
      expect(result.parseError).toBeUndefined();
    });
  }
});

// Malformed input: parse error surfaced, no typed value.
describe('per-agent mcp.read surfaces parseError on malformed input', () => {
  it('claude-code: invalid JSON returns parseError, no config', async () => {
    const ctx = readerCtx();
    await seed('home', '.claude.json', '{ "mcpServers": ', ctx);
    const result = await claudeCode.mcp.read(ctx);
    expect(result.config).toBeNull();
    expect(result.nonEmpty).toBe(false);
    expect(result.parseError).toBeTruthy();
  });

  it('openai-codex: invalid TOML returns parseError, no config', async () => {
    const ctx = readerCtx();
    await seed('home', '.codex/config.toml', '[[[invalid', ctx);
    const result = await openaiCodex.mcp.read(ctx);
    expect(result.config).toBeNull();
    expect(result.nonEmpty).toBe(false);
    expect(result.parseError).toBeTruthy();
  });
});

// Empty / missing top-level key: no parseError, no typed config.
describe('per-agent mcp.read handles empty config', () => {
  it('claude-code: empty mcpServers returns config=null, nonEmpty=false', async () => {
    const ctx = readerCtx();
    await seed('home', '.claude.json', '{"mcpServers": {}}', ctx);
    const result = await claudeCode.mcp.read(ctx);
    expect(result.config).toBeNull();
    expect(result.nonEmpty).toBe(false);
    expect(result.parseError).toBeUndefined();
  });

  it('claude-code: missing top-level key returns config=null, no parseError', async () => {
    const ctx = readerCtx();
    await seed('home', '.claude.json', '{}', ctx);
    const result = await claudeCode.mcp.read(ctx);
    expect(result.config).toBeNull();
    expect(result.nonEmpty).toBe(false);
    expect(result.parseError).toBeUndefined();
  });
});

// Platform filtering: only mcpLocations matching ctx.platform are probed.
describe('per-agent mcp.read respects platform filter', () => {
  it('claude-desktop: linux ctx reads only the Linux mcpLocation', async () => {
    const ctx = readerCtx({ platform: 'linux' });
    await seed(
      'config',
      'Claude/claude_desktop_config.json',
      JSON.stringify({ mcpServers: { s: { command: 'c' } } }),
      ctx,
    );
    const result = await claudeDesktop.mcp.read(ctx);
    expect(result.config).not.toBeNull();
    expect(result.location?.resolvedPath).toBe(
      join(ctx.configDir, 'Claude/claude_desktop_config.json'),
    );
  });

  it('claude-desktop: macos ctx reads only the macOS mcpLocation', async () => {
    const ctx = readerCtx({ platform: 'darwin' });
    await seed(
      'home',
      'Library/Application Support/Claude/claude_desktop_config.json',
      JSON.stringify({ mcpServers: { s: { command: 'c' } } }),
      ctx,
    );
    const result = await claudeDesktop.mcp.read(ctx);
    expect(result.config).not.toBeNull();
    expect(result.location?.resolvedPath).toBe(
      join(
        ctx.homeDir,
        'Library/Application Support/Claude/claude_desktop_config.json',
      ),
    );
  });
});

// Unsupported agents: still placeholder behavior, NOT silent success.
describe('per-agent mcp.read falls back to placeholder for unsupported agents', () => {
  it('aider: mcp.read rejects with "not implemented"', async () => {
    await expect(aider.mcp.read(readerCtx())).rejects.toThrow(
      /MCP read for agent 'aider' is not implemented yet/,
    );
  });

  it('github-copilot-cloud-agent: mcp.read rejects with "not implemented"', async () => {
    await expect(githubCopilotCloudAgent.mcp.read(readerCtx())).rejects.toThrow(
      /MCP read for agent 'github-copilot-cloud-agent' is not implemented yet/,
    );
  });
});

// Multi-location agents: first mcpLocation missing, second present — the
// reader should return the second location's result.
describe('per-agent mcp.read skips missing locations', () => {
  it('claude-code: first mcpLocation missing, second present', async () => {
    const ctx = readerCtx();
    // .claude.json (home) is missing; .mcp.json (workspace) is present.
    await seed(
      'workspace',
      '.mcp.json',
      JSON.stringify({ mcpServers: { s: { command: 'c' } } }),
      ctx,
    );
    const result = await claudeCode.mcp.read(ctx);
    expect(result.config).not.toBeNull();
    expect(result.nonEmpty).toBe(true);
    expect(result.location?.resolvedPath).toBe(
      join(ctx.workspaceDir, '.mcp.json'),
    );
  });
});

// Real-fs smoke tests using the fixtures/ directory. These tests prove
// the reader pipeline works against actual disk files (not just
// per-test tmpdirs) and can be reused by future integration tests.
//
// Fixture path is relative to this spec file: ./fixtures/mcp-configs/.
import { readFile as readFileRaw } from 'node:fs/promises';

const fixtureDir = pathResolve(
  process.cwd(),
  'apps/cli/src/platforms/agents/fixtures/mcp-configs',
);

describe('per-agent mcp.read smoke: real-fs fixtures', () => {
  it('claude-desktop reads the fixture file and returns the typed config', async () => {
    const contents = await readFileRaw(
      pathResolve(fixtureDir, 'claude-desktop.json'),
      'utf8',
    );
    const dest = join(
      scratchDir,
      '.config',
      'Claude',
      'claude_desktop_config.json',
    );
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, contents, 'utf8');

    const result = await claudeDesktop.mcp.read(
      readerCtx({ platform: 'linux' }),
    );
    expect(result.config).not.toBeNull();
    expect(result.nonEmpty).toBe(true);
    if (result.config !== null) {
      const config = result.config as {
        mcpServers?: Record<string, { command?: string }>;
      };
      expect(config.mcpServers?.filesystem?.command).toBe('npx');
      expect(config.mcpServers?.github?.command).toBe('npx');
    }
  });

  it('openai-codex reads the fixture TOML and returns the typed config', async () => {
    const contents = await readFileRaw(
      pathResolve(fixtureDir, 'openai-codex.toml'),
      'utf8',
    );
    const dest = join(scratchDir, '.codex', 'config.toml');
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, contents, 'utf8');

    const result = await openaiCodex.mcp.read(readerCtx({ platform: 'linux' }));
    expect(result.config).not.toBeNull();
    expect(result.nonEmpty).toBe(true);
    if (result.config !== null) {
      const config = result.config as {
        mcp_servers?: Record<string, { command?: string; url?: string }>;
      };
      expect(config.mcp_servers?.filesystem?.command).toBe('npx');
      expect(config.mcp_servers?.fetch?.url).toBe(
        'https://mcp.example.com/fetch',
      );
    }
  });
});

// Audit PR: additional coverage for the 6 mcpLocations fixes.
describe('per-agent mcp.read covers audit-PR paths', () => {
  it('opencode: .jsonc variant at ~/.config/opencode/opencode.jsonc (real-host regression)', async () => {
    const ctx = readerCtx();
    await seed(
      'config',
      'opencode/opencode.jsonc',
      '// opencode config with comments and trailing commas\n{ "mcp": { "fs": { "type": "local", "command": ["npx", "-y", "fs"] } } , }\n',
      ctx,
    );
    const result = await opencode.mcp.read(ctx);
    expect(result.config).not.toBeNull();
    expect(result.nonEmpty).toBe(true);
    expect(result.parseError).toBeUndefined();
    if (result.config !== null) {
      const config = result.config as {
        mcp?: { fs?: { type?: string; command?: string[] } };
      };
      expect(config.mcp?.fs?.type).toBe('local');
      expect(config.mcp?.fs?.command?.[0]).toBe('npx');
    }
  });

  it('opencode: .opencode/opencode.jsonc at user-global config dir', async () => {
    const ctx = readerCtx();
    await seed(
      'config',
      '.opencode/opencode.jsonc',
      JSON.stringify({
        mcp: { s: { type: 'remote', url: 'https://example.com/mcp' } },
      }),
      ctx,
    );
    const result = await opencode.mcp.read(ctx);
    expect(result.config).not.toBeNull();
    expect(result.nonEmpty).toBe(true);
  });

  it('opencode: project-local .opencode/opencode.json wins over missing user-global', async () => {
    const ctx = readerCtx();
    await seed(
      'workspace',
      '.opencode/opencode.json',
      JSON.stringify({
        mcp: { local: { type: 'local', command: ['node', 'mcp.js'] } },
      }),
      ctx,
    );
    const result = await opencode.mcp.read(ctx);
    expect(result.config).not.toBeNull();
    expect(result.nonEmpty).toBe(true);
    expect(result.location?.resolvedPath).toBe(
      join(ctx.workspaceDir, '.opencode/opencode.json'),
    );
  });

  it('github-copilot-cli: ~/.copilot/mcp-config.json (correct location)', async () => {
    const ctx = readerCtx();
    await seed(
      'home',
      '.copilot/mcp-config.json',
      JSON.stringify({
        mcpServers: { s: { type: 'local', command: 'c' } },
      }),
      ctx,
    );
    const result = await githubCopilotCli.mcp.read(ctx);
    expect(result.config).not.toBeNull();
    expect(result.nonEmpty).toBe(true);
    expect(result.location?.resolvedPath).toBe(
      join(ctx.homeDir, '.copilot/mcp-config.json'),
    );
  });

  it('cline: project-local legacy Linux storage still works when ~/.cline/mcp.json is absent', async () => {
    const ctx = readerCtx();
    // Seed only the legacy Linux VS Code global-storage path.
    await seed(
      'config',
      'Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json',
      JSON.stringify({ mcpServers: { legacy: { command: 'legacy' } } }),
      ctx,
    );
    const result = await cline.mcp.read(ctx);
    expect(result.config).not.toBeNull();
    expect(result.nonEmpty).toBe(true);
  });

  it('roo-code: project-local .roo/mcp.json reads before legacy storage', async () => {
    const ctx = readerCtx();
    await seed(
      'workspace',
      '.roo/mcp.json',
      JSON.stringify({ mcpServers: { project: { command: 'proj' } } }),
      ctx,
    );
    const result = await rooCode.mcp.read(ctx);
    expect(result.config).not.toBeNull();
    expect(result.nonEmpty).toBe(true);
    expect(result.location?.resolvedPath).toBe(
      join(ctx.workspaceDir, '.roo/mcp.json'),
    );
  });

  it('zed: project-local .zed/settings.json reads when present', async () => {
    const ctx = readerCtx();
    await seed(
      'workspace',
      '.zed/settings.json',
      JSON.stringify({ context_servers: { p: { command: 'proj' } } }),
      ctx,
    );
    const result = await zed.mcp.read(ctx);
    expect(result.config).not.toBeNull();
    expect(result.nonEmpty).toBe(true);
    expect(result.location?.resolvedPath).toBe(
      join(ctx.workspaceDir, '.zed/settings.json'),
    );
  });

  it('continue: project-local .continue/mcpServers/mcp.json is the canonical MCP path', async () => {
    const ctx = readerCtx();
    await seed(
      'workspace',
      '.continue/mcpServers/mcp.json',
      JSON.stringify({ mcpServers: { s: { command: 'c' } } }),
      ctx,
    );
    const result = await continueDef.mcp.read(ctx);
    expect(result.config).not.toBeNull();
    expect(result.nonEmpty).toBe(true);
    expect(result.location?.resolvedPath).toBe(
      join(ctx.workspaceDir, '.continue/mcpServers/mcp.json'),
    );
  });
});
