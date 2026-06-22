import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

import { defaultOverturePaths } from '@overture/config';

import {
  BOOTSTRAP_RESERVED_MESSAGE,
  BOOTSTRAP_USAGE,
  exitCodeForBootstrap,
  runBootstrap,
} from './bootstrap-command.js';
import { buildBootstrapPlan } from './bootstrap.js';
import {
  BufferWriter,
  validCanonicalConfigJson,
} from './bootstrap-test-support.js';

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
    { args: [], stderr: BOOTSTRAP_RESERVED_MESSAGE, code: 2 },
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
