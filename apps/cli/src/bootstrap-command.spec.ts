import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
// Deep import mirrors `packages/config/src/loader.ts`: the package root
// re-exports through a UMD wrapper that uses relative `require()` calls.
import { parse as parseJsonc } from 'jsonc-parser/lib/esm/main.js';
import { defaultOverturePaths, parseOvertureConfig } from '@overture/config';

import {
  BOOTSTRAP_USAGE,
  exitCodeForBootstrap,
  runBootstrap,
} from './bootstrap-command.js';
import { buildBootstrapPlan } from './bootstrap.js';
import {
  BufferWriter,
  validCanonicalConfigJson,
} from '../test-support/bootstrap-test-support.js';

function createBootstrapTempEnv(): {
  readonly home: string;
  readonly xdgConfigHome: string;
  readonly pathDir: string;
  readonly env: NodeJS.ProcessEnv;
  readonly cleanup: readonly string[];
} {
  const home = mkdtempSync(join(tmpdir(), 'overture-bootstrap-home-'));
  const xdgConfigHome = mkdtempSync(join(tmpdir(), 'overture-bootstrap-xdg-'));
  const pathDir = mkdtempSync(join(tmpdir(), 'overture-bootstrap-path-'));
  return {
    home,
    xdgConfigHome,
    pathDir,
    env: {
      ...process.env,
      HOME: home,
      XDG_CONFIG_HOME: xdgConfigHome,
      PATH: pathDir,
    },
    cleanup: [home, xdgConfigHome, pathDir],
  };
}

function seedFakeOpencodeBin(pathDir: string): void {
  const opencodeBin = join(pathDir, 'opencode');
  writeFileSync(opencodeBin, '#!/bin/sh\nexit 0\n');
  chmodSync(opencodeBin, 0o755);
}

function seedFakeClaudeBin(pathDir: string): void {
  const claudeBin = join(pathDir, 'claude');
  writeFileSync(claudeBin, '#!/bin/sh\nexit 0\n');
  chmodSync(claudeBin, 0o755);
}

function opencodeFixtureJsonc(): string {
  return `{
    // bootstrap dispatcher fixture
    "mcp": {
      "filesystem": {
        "type": "local",
        "command": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/home"],
        "environment": { "NODE_ENV": "production", "DEBUG": "1" }
      }
    }
  }`;
}

function seedBootstrapAgentConfig(xdgConfigHome: string): string {
  const opencodeDir = join(xdgConfigHome, 'opencode');
  mkdirSync(opencodeDir, { recursive: true });
  const agentConfigPath = join(opencodeDir, 'opencode.jsonc');
  writeFileSync(agentConfigPath, opencodeFixtureJsonc());
  return agentConfigPath;
}

function claudeFilesystemFixtureJson(): string {
  return JSON.stringify(
    {
      mcpServers: {
        filesystem: {
          type: 'stdio',
          command: 'pnpm',
          args: ['dlx', '@modelcontextprotocol/server-filesystem', '/home'],
        },
      },
    },
    null,
    2,
  );
}

function claudeRemoteFilesystemFixtureJson(): string {
  return JSON.stringify(
    {
      mcpServers: {
        filesystem: {
          type: 'remote',
          url: 'https://mcp.example.test/filesystem',
        },
      },
    },
    null,
    2,
  );
}

function claudeTwoPickablesFixtureJson(): string {
  return JSON.stringify(
    {
      mcpServers: {
        context7: {
          type: 'remote',
          url: 'https://mcp.context7.com/mcp',
          headers: { Authorization: 'Bearer claude-token' },
        },
        filesystem: {
          type: 'stdio',
          command: 'pnpm',
          args: ['dlx', '@modelcontextprotocol/server-filesystem', '/home'],
        },
      },
    },
    null,
    2,
  );
}

function opencodeTwoPickablesFixtureJsonc(): string {
  return `{
    // bootstrap dispatcher fixture
    "mcp": {
      "context7": {
        "type": "remote",
        "url": "https://mcp.context7.com/mcp",
        "headers": { "Authorization": "Bearer opencode-token" }
      },
      "filesystem": {
        "type": "local",
        "command": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/home"],
        "environment": { "NODE_ENV": "production", "DEBUG": "1" }
      }
    }
  }`;
}

function seedClaudeConfig(home: string, contents: string): string {
  const claudeConfigPath = join(home, '.claude.json');
  writeFileSync(claudeConfigPath, contents);
  return claudeConfigPath;
}

function seedOpencodeConfig(xdgConfigHome: string, contents: string): string {
  const opencodeDir = join(xdgConfigHome, 'opencode');
  mkdirSync(opencodeDir, { recursive: true });
  const agentConfigPath = join(opencodeDir, 'opencode.jsonc');
  writeFileSync(agentConfigPath, contents);
  return agentConfigPath;
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('runBootstrap', () => {
  let cleanupDirs: readonly string[] = [];

  beforeEach(() => {
    cleanupDirs = [];
  });

  afterEach(() => {
    for (const dir of cleanupDirs)
      rmSync(dir, { recursive: true, force: true });
  });

  it.each([['--help'], ['-h']])(
    'returns 0 and prints usage for %s',
    async (flag) => {
      const stdout = new BufferWriter();
      const stderr = new BufferWriter();

      const code = await runBootstrap([flag], stdout, stderr);

      expect(code).toBe(0);
      expect(stdout.text()).toBe(BOOTSTRAP_USAGE);
      expect(stderr.text()).toBe('');
    },
  );

  it.each([
    { args: ['--json'], stderr: '--dry-run', code: 2 },
    { args: ['--bogus'], stderr: 'Unknown flag: --bogus', code: 2 },
  ])(
    'reserved and invalid flags are rejected',
    async ({ args, stderr, code }) => {
      const stdout = new BufferWriter();
      const err = new BufferWriter();

      const result = await runBootstrap(args, stdout, err);

      expect(result).toBe(code);
      expect(stdout.text()).toBe('');
      expect(err.text()).toContain(stderr);
    },
  );

  it('renders the human dry-run proposal and returns a proposal-dependent exit code', async () => {
    const { home, xdgConfigHome, pathDir, cleanup, env } =
      createBootstrapTempEnv();
    cleanupDirs = cleanup;
    seedFakeOpencodeBin(pathDir);

    process.env.HOME = home;
    process.env.XDG_CONFIG_HOME = xdgConfigHome;
    process.env.PATH = pathDir;

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runBootstrap(['--dry-run'], stdout, stderr);

    expect(code).toBeGreaterThanOrEqual(0);
    expect(code).toBeLessThanOrEqual(1);
    expect(stderr.text()).toBe('');
    expect(stdout.text()).toContain('Bootstrap proposal (dry-run)');
    expect(stdout.text()).toContain('No files were written.');
    expect(existsSync(defaultOverturePaths(env).configFile)).toBe(false);
  });

  it('emits machine JSON, does not create overture.jsonc, and leaves seeded agent config unchanged', async () => {
    const { home, xdgConfigHome, pathDir, cleanup, env } =
      createBootstrapTempEnv();
    cleanupDirs = cleanup;
    seedFakeOpencodeBin(pathDir);
    const agentConfigPath = seedBootstrapAgentConfig(xdgConfigHome);

    process.env.HOME = home;
    process.env.XDG_CONFIG_HOME = xdgConfigHome;
    process.env.PATH = pathDir;

    const paths = defaultOverturePaths(env);
    expect(existsSync(paths.configFile)).toBe(false);

    const agentBefore = readFileSync(agentConfigPath, 'utf8');
    const beforeStat = statSync(agentConfigPath);

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runBootstrap(['--dry-run', '--json'], stdout, stderr);

    expect(code).toBeGreaterThanOrEqual(0);
    expect(code).toBeLessThanOrEqual(1);
    expect(stderr.text()).toBe('');

    const parsed = JSON.parse(stdout.text()) as {
      blockers: unknown[];
      conflicts: { pickable: unknown[]; hardRefuses: unknown[] };
      proposal: { status: string; configPath: string };
    };
    expect(Object.keys(parsed).sort()).toEqual([
      'blockers',
      'conflicts',
      'proposal',
    ]);
    expect(parsed.proposal.configPath).toBe(paths.configFile);
    expect(existsSync(paths.configFile)).toBe(false);
    expect(readFileSync(agentConfigPath, 'utf8')).toBe(agentBefore);
    expect(statSync(agentConfigPath).size).toBe(beforeStat.size);
  });

  it.each([
    [
      'existing canonical config',
      validCanonicalConfigJson(),
      1,
      'Existing canonical config already exists',
    ],
    [
      'invalid canonical config',
      '{"version":1',
      2,
      'Failed to parse overture config',
    ],
  ])(
    'returns the expected exit for %s',
    async (_label, json, code, message) => {
      const { home, xdgConfigHome, cleanup, env } = createBootstrapTempEnv();
      cleanupDirs = cleanup;
      process.env.HOME = home;
      process.env.XDG_CONFIG_HOME = xdgConfigHome;
      process.env.PATH = '';

      const paths = defaultOverturePaths(env);
      mkdirSync(paths.configDir, { recursive: true });
      writeFileSync(paths.configFile, json);

      const stdout = new BufferWriter();
      const stderr = new BufferWriter();
      const result = await runBootstrap(
        ['--dry-run', '--json'],
        stdout,
        stderr,
      );

      expect(result).toBe(code);
      expect(stdout.text()).toBe('');
      expect(stderr.text()).toContain(message);
    },
  );

  it('exitCodeForBootstrap mirrors proposal status', () => {
    expect(
      exitCodeForBootstrap(
        buildBootstrapPlan({
          scanOutput: {
            matrix: {
              canonicalState: 'absent',
              canonicalProfileName: null,
              canonicalIntent: {},
              agents: [],
              rows: [],
            },
            conflicts: { pickable: [], hardRefuses: [] },
          },
          configPath: '/tmp/overture.jsonc',
        }),
      ),
    ).toBe(1);
  });
});

describe('D2 interactive', () => {
  let cleanupDirs: readonly string[] = [];
  let stdinIsTtyDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    cleanupDirs = [];
    stdinIsTtyDescriptor = Object.getOwnPropertyDescriptor(
      process.stdin,
      'isTTY',
    );
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: false,
    });
  });

  afterEach(() => {
    for (const dir of cleanupDirs)
      rmSync(dir, { recursive: true, force: true });
    if (stdinIsTtyDescriptor === undefined) {
      const mutableStdin = process.stdin as { isTTY?: boolean };
      delete mutableStdin.isTTY;
    } else {
      Object.defineProperty(process.stdin, 'isTTY', stdinIsTtyDescriptor);
    }
  });

  function useBootstrapEnv(env: {
    readonly home: string;
    readonly xdgConfigHome: string;
    readonly pathDir: string;
  }): void {
    process.env.HOME = env.home;
    process.env.XDG_CONFIG_HOME = env.xdgConfigHome;
    process.env.PATH = env.pathDir;
  }

  function queuedPrompt(answers: readonly (string | null)[]) {
    const queue = [...answers];
    return vi.fn((_message: string): Promise<string | null> => {
      return Promise.resolve(queue.length > 0 ? (queue.shift() ?? null) : null);
    });
  }

  it('writes the canonical config and prints the success footer when no-flag bootstrap has no pickables', async () => {
    const { home, xdgConfigHome, pathDir, cleanup, env } =
      createBootstrapTempEnv();
    cleanupDirs = cleanup;
    useBootstrapEnv({ home, xdgConfigHome, pathDir });
    seedFakeOpencodeBin(pathDir);
    const agentConfigPath = seedBootstrapAgentConfig(xdgConfigHome);
    const agentBefore = readFileSync(agentConfigPath, 'utf8');
    const beforeStat = statSync(agentConfigPath);
    const prompt = queuedPrompt(['1']);

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runBootstrap([], stdout, stderr, {
      isTTY: true,
      prompt,
    });

    const paths = defaultOverturePaths(env);
    expect(code).toBe(0);
    expect(stderr.text()).toBe('');
    expect(prompt).not.toHaveBeenCalled();
    expect(stdout.text()).toContain('Proposal status: ready');
    expect(stdout.text()).toContain('Pickable conflicts: 0');
    expect(stdout.text()).toContain(`Wrote config: ${paths.configFile}`);
    expect(stdout.text()).not.toContain('No files were written.');
    expect(existsSync(paths.configFile)).toBe(true);
    const written = readFileSync(paths.configFile, 'utf8');
    // Parse the JSONC body (writer emits // comments) with jsonc-parser,
    // then validate the parsed shape with parseOvertureConfig.
    const jsoncErrors: import('jsonc-parser/lib/esm/main.js').ParseError[] = [];
    const writtenParsed: unknown = parseJsonc(written, jsoncErrors, {
      allowTrailingComma: true,
      disallowComments: false,
    });
    expect(jsoncErrors).toEqual([]);
    const validated = parseOvertureConfig(writtenParsed);
    expect(validated.version).toBe(1);
    expect(validated.profiles.default.mcpServers.filesystem?.type).toBe(
      'stdio',
    );

    expect(readFileSync(agentConfigPath, 'utf8')).toBe(agentBefore);
    expect(statSync(agentConfigPath).size).toBe(beforeStat.size);
    expect(statSync(agentConfigPath).mtimeMs).toBe(beforeStat.mtimeMs);
  });

  it('returns exit 2 and does not write the config when the write step fails', async () => {
    const { home, xdgConfigHome, pathDir, cleanup, env } =
      createBootstrapTempEnv();
    cleanupDirs = cleanup;
    useBootstrapEnv({ home, xdgConfigHome, pathDir });
    seedFakeOpencodeBin(pathDir);
    const agentConfigPath = seedBootstrapAgentConfig(xdgConfigHome);
    const agentBefore = readFileSync(agentConfigPath, 'utf8');
    const beforeStat = statSync(agentConfigPath);
    const prompt = queuedPrompt(['1']);

    // Pre-create a directory at the final config path so the writer's
    // rename must fail (EISDIR). The CLI must surface a clear failure
    // message on stderr, NOT claim success on stdout, and leave the
    // pre-existing directory in place.
    const paths = defaultOverturePaths(env);
    mkdirSync(paths.configFile, { recursive: true });

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runBootstrap([], stdout, stderr, {
      isTTY: true,
      prompt,
    });

    expect(code).toBe(2);
    expect(stderr.text()).toMatch(/Failed to write overture config/);
    expect(stdout.text()).not.toContain('Wrote config:');
    expect(stdout.text()).not.toContain('No files were written.');
    expect(statSync(paths.configFile).isDirectory()).toBe(true);
    expect(readFileSync(agentConfigPath, 'utf8')).toBe(agentBefore);
    expect(statSync(agentConfigPath).size).toBe(beforeStat.size);
    expect(statSync(agentConfigPath).mtimeMs).toBe(beforeStat.mtimeMs);
  });

  it('prompts for a pickable conflict and adopts the selected candidate', async () => {
    const { home, xdgConfigHome, pathDir, cleanup, env } =
      createBootstrapTempEnv();
    cleanupDirs = cleanup;
    useBootstrapEnv({ home, xdgConfigHome, pathDir });
    seedFakeOpencodeBin(pathDir);
    seedFakeClaudeBin(pathDir);
    const opencodeConfigPath = seedBootstrapAgentConfig(xdgConfigHome);
    const claudeConfigPath = seedClaudeConfig(
      home,
      claudeFilesystemFixtureJson(),
    );
    const opencodeBefore = readFileSync(opencodeConfigPath, 'utf8');
    const claudeBefore = readFileSync(claudeConfigPath, 'utf8');
    const opencodeStat = statSync(opencodeConfigPath);
    const claudeStat = statSync(claudeConfigPath);
    const prompt = queuedPrompt(['1']);

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runBootstrap([], stdout, stderr, {
      isTTY: true,
      prompt,
    });

    expect(code).toBe(0);
    expect(stderr.text()).toBe('');
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(prompt).toHaveBeenCalledWith(
      expect.stringContaining('Pickable conflict: filesystem'),
    );
    expect(stdout.text()).toContain('Resolved conflicts: 1');
    expect(stdout.text()).toContain('Skipped conflicts: 0');
    expect(stdout.text()).toContain('selected-conflict');
    expect(stdout.text()).toContain('filesystem: Claude Code (claude-code)');
    const paths = defaultOverturePaths(env);
    expect(existsSync(paths.configFile)).toBe(true);
    expect(stdout.text()).toContain(`Wrote config: ${paths.configFile}`);
    expect(stdout.text()).not.toContain('No files were written.');
    const written = readFileSync(paths.configFile, 'utf8');
    const jsoncErrors: import('jsonc-parser/lib/esm/main.js').ParseError[] = [];
    const writtenParsed: unknown = parseJsonc(written, jsoncErrors, {
      allowTrailingComma: true,
      disallowComments: false,
    });
    expect(jsoncErrors).toEqual([]);
    const validated = parseOvertureConfig(writtenParsed);
    expect(validated.profiles.default.mcpServers.filesystem?.type).toBe(
      'stdio',
    );
    expect(readFileSync(opencodeConfigPath, 'utf8')).toBe(opencodeBefore);
    expect(readFileSync(claudeConfigPath, 'utf8')).toBe(claudeBefore);
    expect(statSync(opencodeConfigPath).size).toBe(opencodeStat.size);
    expect(statSync(claudeConfigPath).size).toBe(claudeStat.size);
    expect(statSync(opencodeConfigPath).mtimeMs).toBe(opencodeStat.mtimeMs);
    expect(statSync(claudeConfigPath).mtimeMs).toBe(claudeStat.mtimeMs);
  });

  it('skips one pickable on empty input and selects the next candidate', async () => {
    const { home, xdgConfigHome, pathDir, cleanup, env } =
      createBootstrapTempEnv();
    cleanupDirs = cleanup;
    useBootstrapEnv({ home, xdgConfigHome, pathDir });
    seedFakeOpencodeBin(pathDir);
    seedFakeClaudeBin(pathDir);
    const opencodeConfigPath = seedOpencodeConfig(
      xdgConfigHome,
      opencodeTwoPickablesFixtureJsonc(),
    );
    const claudeConfigPath = seedClaudeConfig(
      home,
      claudeTwoPickablesFixtureJson(),
    );
    const opencodeBefore = readFileSync(opencodeConfigPath, 'utf8');
    const claudeBefore = readFileSync(claudeConfigPath, 'utf8');
    const opencodeStat = statSync(opencodeConfigPath);
    const claudeStat = statSync(claudeConfigPath);
    const prompt = queuedPrompt(['', '1']);

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runBootstrap([], stdout, stderr, {
      isTTY: true,
      prompt,
    });

    expect(code).toBe(0);
    expect(stderr.text()).toBe('');
    expect(prompt).toHaveBeenCalledTimes(2);
    expect(countOccurrences(stdout.text(), 'Pickable conflict:')).toBe(2);
    expect(stdout.text()).toContain('Resolved conflicts: 1');
    expect(stdout.text()).toContain('Skipped conflicts: 1');
    expect(stdout.text()).toContain('selected-conflict');
    const paths = defaultOverturePaths(env);
    expect(existsSync(paths.configFile)).toBe(true);
    expect(stdout.text()).toContain(`Wrote config: ${paths.configFile}`);
    expect(stdout.text()).not.toContain('No files were written.');
    const written = readFileSync(paths.configFile, 'utf8');
    const jsoncErrors: import('jsonc-parser/lib/esm/main.js').ParseError[] = [];
    const writtenParsed: unknown = parseJsonc(written, jsoncErrors, {
      allowTrailingComma: true,
      disallowComments: false,
    });
    expect(jsoncErrors).toEqual([]);
    const validated = parseOvertureConfig(writtenParsed);
    expect(validated.profiles.default.mcpServers).toHaveProperty('filesystem');
    expect(validated.profiles.default.mcpServers).not.toHaveProperty(
      'context7',
    );
    expect(readFileSync(opencodeConfigPath, 'utf8')).toBe(opencodeBefore);
    expect(readFileSync(claudeConfigPath, 'utf8')).toBe(claudeBefore);
    expect(statSync(opencodeConfigPath).size).toBe(opencodeStat.size);
    expect(statSync(claudeConfigPath).size).toBe(claudeStat.size);
    expect(statSync(opencodeConfigPath).mtimeMs).toBe(opencodeStat.mtimeMs);
    expect(statSync(claudeConfigPath).mtimeMs).toBe(claudeStat.mtimeMs);
  });

  it('re-asks invalid input until the invalid answer limit aborts', async () => {
    const { home, xdgConfigHome, pathDir, cleanup, env } =
      createBootstrapTempEnv();
    cleanupDirs = cleanup;
    useBootstrapEnv({ home, xdgConfigHome, pathDir });
    seedFakeOpencodeBin(pathDir);
    seedFakeClaudeBin(pathDir);
    const opencodeConfigPath = seedBootstrapAgentConfig(xdgConfigHome);
    const claudeConfigPath = seedClaudeConfig(
      home,
      claudeFilesystemFixtureJson(),
    );
    const opencodeBefore = readFileSync(opencodeConfigPath, 'utf8');
    const claudeBefore = readFileSync(claudeConfigPath, 'utf8');
    const opencodeStat = statSync(opencodeConfigPath);
    const claudeStat = statSync(claudeConfigPath);
    const prompt = vi.fn((): Promise<string> => Promise.resolve('foo'));

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runBootstrap([], stdout, stderr, {
      isTTY: true,
      prompt,
    });

    expect(code).toBe(2);
    expect(prompt).toHaveBeenCalledTimes(10);
    expect(1 + prompt.mock.calls.length).toBe(11);
    expect(stderr.text()).toBe(
      'Bootstrap aborted: too many invalid answers for filesystem\n',
    );
    expect(existsSync(defaultOverturePaths(env).configFile)).toBe(false);
    expect(readFileSync(opencodeConfigPath, 'utf8')).toBe(opencodeBefore);
    expect(readFileSync(claudeConfigPath, 'utf8')).toBe(claudeBefore);
    expect(statSync(opencodeConfigPath).size).toBe(opencodeStat.size);
    expect(statSync(claudeConfigPath).size).toBe(claudeStat.size);
    expect(statSync(opencodeConfigPath).mtimeMs).toBe(opencodeStat.mtimeMs);
    expect(statSync(claudeConfigPath).mtimeMs).toBe(claudeStat.mtimeMs);
  });

  it('aborts when the user answers q', async () => {
    const { home, xdgConfigHome, pathDir, cleanup, env } =
      createBootstrapTempEnv();
    cleanupDirs = cleanup;
    useBootstrapEnv({ home, xdgConfigHome, pathDir });
    seedFakeOpencodeBin(pathDir);
    seedFakeClaudeBin(pathDir);
    const opencodeConfigPath = seedBootstrapAgentConfig(xdgConfigHome);
    const claudeConfigPath = seedClaudeConfig(
      home,
      claudeFilesystemFixtureJson(),
    );
    const opencodeBefore = readFileSync(opencodeConfigPath, 'utf8');
    const claudeBefore = readFileSync(claudeConfigPath, 'utf8');
    const opencodeStat = statSync(opencodeConfigPath);
    const claudeStat = statSync(claudeConfigPath);
    const prompt = queuedPrompt(['q']);

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runBootstrap([], stdout, stderr, {
      isTTY: true,
      prompt,
    });

    expect(code).toBe(2);
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(stderr.text()).toBe('Bootstrap aborted: filesystem\n');
    expect(existsSync(defaultOverturePaths(env).configFile)).toBe(false);
    expect(readFileSync(opencodeConfigPath, 'utf8')).toBe(opencodeBefore);
    expect(readFileSync(claudeConfigPath, 'utf8')).toBe(claudeBefore);
    expect(statSync(opencodeConfigPath).size).toBe(opencodeStat.size);
    expect(statSync(claudeConfigPath).size).toBe(claudeStat.size);
    expect(statSync(opencodeConfigPath).mtimeMs).toBe(opencodeStat.mtimeMs);
    expect(statSync(claudeConfigPath).mtimeMs).toBe(claudeStat.mtimeMs);
  });

  it('prints the hard-refuse proposal without prompting', async () => {
    const { home, xdgConfigHome, pathDir, cleanup, env } =
      createBootstrapTempEnv();
    cleanupDirs = cleanup;
    useBootstrapEnv({ home, xdgConfigHome, pathDir });
    seedFakeOpencodeBin(pathDir);
    seedFakeClaudeBin(pathDir);
    const opencodeConfigPath = seedBootstrapAgentConfig(xdgConfigHome);
    const claudeConfigPath = seedClaudeConfig(
      home,
      claudeRemoteFilesystemFixtureJson(),
    );
    const opencodeBefore = readFileSync(opencodeConfigPath, 'utf8');
    const claudeBefore = readFileSync(claudeConfigPath, 'utf8');
    const opencodeStat = statSync(opencodeConfigPath);
    const claudeStat = statSync(claudeConfigPath);
    const prompt = queuedPrompt(['1']);

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runBootstrap([], stdout, stderr, {
      isTTY: true,
      prompt,
    });

    expect(code).toBe(1);
    expect(stderr.text()).toBe('');
    expect(prompt).not.toHaveBeenCalled();
    expect(stdout.text()).toContain('Bootstrap proposal (dry-run)');
    expect(stdout.text()).toContain('Hard refuses: 1');
    expect(stdout.text()).toContain('No files were written.');
    expect(existsSync(defaultOverturePaths(env).configFile)).toBe(false);
    expect(readFileSync(opencodeConfigPath, 'utf8')).toBe(opencodeBefore);
    expect(readFileSync(claudeConfigPath, 'utf8')).toBe(claudeBefore);
    expect(statSync(opencodeConfigPath).size).toBe(opencodeStat.size);
    expect(statSync(claudeConfigPath).size).toBe(claudeStat.size);
    expect(statSync(opencodeConfigPath).mtimeMs).toBe(opencodeStat.mtimeMs);
    expect(statSync(claudeConfigPath).mtimeMs).toBe(claudeStat.mtimeMs);
  });

  it('prints the no-readable-agents blocker proposal without prompting', async () => {
    const { home, xdgConfigHome, pathDir, cleanup, env } =
      createBootstrapTempEnv();
    cleanupDirs = cleanup;
    useBootstrapEnv({ home, xdgConfigHome, pathDir });
    const prompt = queuedPrompt(['1']);

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runBootstrap([], stdout, stderr, {
      isTTY: true,
      prompt,
    });

    expect(code).toBe(1);
    expect(stderr.text()).toBe('');
    expect(prompt).not.toHaveBeenCalled();
    expect(stdout.text()).toContain('Bootstrap proposal (dry-run)');
    expect(stdout.text()).toContain('Blockers: 1');
    expect(stdout.text()).toContain('no-readable-agents');
    expect(stdout.text()).toContain('No files were written.');
    expect(existsSync(defaultOverturePaths(env).configFile)).toBe(false);
  });

  it('requires a TTY before prompting for a pickable conflict', async () => {
    const { home, xdgConfigHome, pathDir, cleanup, env } =
      createBootstrapTempEnv();
    cleanupDirs = cleanup;
    useBootstrapEnv({ home, xdgConfigHome, pathDir });
    seedFakeOpencodeBin(pathDir);
    seedFakeClaudeBin(pathDir);
    const opencodeConfigPath = seedBootstrapAgentConfig(xdgConfigHome);
    const claudeConfigPath = seedClaudeConfig(
      home,
      claudeFilesystemFixtureJson(),
    );
    const opencodeBefore = readFileSync(opencodeConfigPath, 'utf8');
    const claudeBefore = readFileSync(claudeConfigPath, 'utf8');
    const opencodeStat = statSync(opencodeConfigPath);
    const claudeStat = statSync(claudeConfigPath);
    const prompt = queuedPrompt(['1']);

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runBootstrap([], stdout, stderr, { prompt });

    expect(code).toBe(2);
    expect(stdout.text()).toBe('');
    expect(stderr.text()).toBe(
      'Interactive bootstrap requires a TTY. Run "overture bootstrap --dry-run" for a non-interactive preview.\n',
    );
    expect(prompt).not.toHaveBeenCalled();
    expect(existsSync(defaultOverturePaths(env).configFile)).toBe(false);
    expect(readFileSync(opencodeConfigPath, 'utf8')).toBe(opencodeBefore);
    expect(readFileSync(claudeConfigPath, 'utf8')).toBe(claudeBefore);
    expect(statSync(opencodeConfigPath).size).toBe(opencodeStat.size);
    expect(statSync(claudeConfigPath).size).toBe(claudeStat.size);
    expect(statSync(opencodeConfigPath).mtimeMs).toBe(opencodeStat.mtimeMs);
    expect(statSync(claudeConfigPath).mtimeMs).toBe(claudeStat.mtimeMs);
  });

  it('preserves --dry-run as a non-interactive proposal for pickables', async () => {
    const { home, xdgConfigHome, pathDir, cleanup, env } =
      createBootstrapTempEnv();
    cleanupDirs = cleanup;
    useBootstrapEnv({ home, xdgConfigHome, pathDir });
    seedFakeOpencodeBin(pathDir);
    seedFakeClaudeBin(pathDir);
    const opencodeConfigPath = seedBootstrapAgentConfig(xdgConfigHome);
    const claudeConfigPath = seedClaudeConfig(
      home,
      claudeFilesystemFixtureJson(),
    );
    const opencodeBefore = readFileSync(opencodeConfigPath, 'utf8');
    const claudeBefore = readFileSync(claudeConfigPath, 'utf8');
    const opencodeStat = statSync(opencodeConfigPath);
    const claudeStat = statSync(claudeConfigPath);
    const prompt = queuedPrompt(['1']);

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runBootstrap(['--dry-run'], stdout, stderr, {
      isTTY: true,
      prompt,
    });

    expect(code).toBe(1);
    expect(stderr.text()).toBe('');
    expect(prompt).not.toHaveBeenCalled();
    expect(stdout.text()).toContain('Bootstrap proposal (dry-run)');
    expect(stdout.text()).toContain('Pickable conflicts: 1');
    expect(stdout.text()).not.toContain('Resolved conflicts:');
    expect(existsSync(defaultOverturePaths(env).configFile)).toBe(false);
    expect(readFileSync(opencodeConfigPath, 'utf8')).toBe(opencodeBefore);
    expect(readFileSync(claudeConfigPath, 'utf8')).toBe(claudeBefore);
    expect(statSync(opencodeConfigPath).size).toBe(opencodeStat.size);
    expect(statSync(claudeConfigPath).size).toBe(claudeStat.size);
    expect(statSync(opencodeConfigPath).mtimeMs).toBe(opencodeStat.mtimeMs);
    expect(statSync(claudeConfigPath).mtimeMs).toBe(claudeStat.mtimeMs);
  });

  it('preserves --dry-run --json as a non-interactive envelope for pickables', async () => {
    const { home, xdgConfigHome, pathDir, cleanup, env } =
      createBootstrapTempEnv();
    cleanupDirs = cleanup;
    useBootstrapEnv({ home, xdgConfigHome, pathDir });
    seedFakeOpencodeBin(pathDir);
    seedFakeClaudeBin(pathDir);
    const opencodeConfigPath = seedBootstrapAgentConfig(xdgConfigHome);
    const claudeConfigPath = seedClaudeConfig(
      home,
      claudeFilesystemFixtureJson(),
    );
    const opencodeBefore = readFileSync(opencodeConfigPath, 'utf8');
    const claudeBefore = readFileSync(claudeConfigPath, 'utf8');
    const opencodeStat = statSync(opencodeConfigPath);
    const claudeStat = statSync(claudeConfigPath);
    const prompt = queuedPrompt(['1']);

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runBootstrap(['--dry-run', '--json'], stdout, stderr, {
      isTTY: true,
      prompt,
    });

    expect(code).toBe(1);
    expect(stderr.text()).toBe('');
    expect(prompt).not.toHaveBeenCalled();
    const parsed = JSON.parse(stdout.text()) as {
      conflicts: { pickable: unknown[]; hardRefuses: unknown[] };
      proposal: { status: string };
    };
    expect(parsed.proposal.status).toBe('blocked');
    expect(parsed.conflicts.pickable).toHaveLength(1);
    expect(parsed.conflicts.hardRefuses).toHaveLength(0);
    expect(existsSync(defaultOverturePaths(env).configFile)).toBe(false);
    expect(readFileSync(opencodeConfigPath, 'utf8')).toBe(opencodeBefore);
    expect(readFileSync(claudeConfigPath, 'utf8')).toBe(claudeBefore);
    expect(statSync(opencodeConfigPath).size).toBe(opencodeStat.size);
    expect(statSync(claudeConfigPath).size).toBe(claudeStat.size);
    expect(statSync(opencodeConfigPath).mtimeMs).toBe(opencodeStat.mtimeMs);
    expect(statSync(claudeConfigPath).mtimeMs).toBe(claudeStat.mtimeMs);
  });

  it('rejects an existing canonical config before prompting', async () => {
    const { home, xdgConfigHome, pathDir, cleanup, env } =
      createBootstrapTempEnv();
    cleanupDirs = cleanup;
    useBootstrapEnv({ home, xdgConfigHome, pathDir });
    const paths = defaultOverturePaths(env);
    mkdirSync(paths.configDir, { recursive: true });
    writeFileSync(paths.configFile, validCanonicalConfigJson());
    const configBefore = readFileSync(paths.configFile, 'utf8');
    const beforeStat = statSync(paths.configFile);
    const prompt = queuedPrompt(['1']);

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runBootstrap([], stdout, stderr, {
      isTTY: true,
      prompt,
    });

    expect(code).toBe(1);
    expect(stdout.text()).toBe('');
    expect(stderr.text()).toContain('Bootstrap is one-time');
    expect(prompt).not.toHaveBeenCalled();
    expect(readFileSync(paths.configFile, 'utf8')).toBe(configBefore);
    expect(statSync(paths.configFile).size).toBe(beforeStat.size);
    expect(statSync(paths.configFile).mtimeMs).toBe(beforeStat.mtimeMs);
  });

  it('rejects an unknown flag before prompting', async () => {
    const { home, xdgConfigHome, pathDir, cleanup, env } =
      createBootstrapTempEnv();
    cleanupDirs = cleanup;
    useBootstrapEnv({ home, xdgConfigHome, pathDir });
    const prompt = queuedPrompt(['1']);

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runBootstrap(['--bogus'], stdout, stderr, {
      isTTY: true,
      prompt,
    });

    expect(code).toBe(2);
    expect(stdout.text()).toBe('');
    expect(stderr.text()).toContain('Unknown flag: --bogus');
    expect(stderr.text()).toContain(BOOTSTRAP_USAGE);
    expect(prompt).not.toHaveBeenCalled();
    expect(existsSync(defaultOverturePaths(env).configFile)).toBe(false);
  });

  it('rejects --json without --dry-run before prompting', async () => {
    const { home, xdgConfigHome, pathDir, cleanup, env } =
      createBootstrapTempEnv();
    cleanupDirs = cleanup;
    useBootstrapEnv({ home, xdgConfigHome, pathDir });
    const prompt = queuedPrompt(['1']);

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runBootstrap(['--json'], stdout, stderr, {
      isTTY: true,
      prompt,
    });

    expect(code).toBe(2);
    expect(stdout.text()).toBe('');
    expect(stderr.text()).toContain('Invalid flag combination');
    expect(stderr.text()).toContain(BOOTSTRAP_USAGE);
    expect(prompt).not.toHaveBeenCalled();
    expect(existsSync(defaultOverturePaths(env).configFile)).toBe(false);
  });
});
