import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
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

class BufferWriter {
  public readonly chunks: string[] = [];
  public write(chunk: string): boolean {
    this.chunks.push(chunk);
    return true;
  }
  public text(): string {
    return this.chunks.join('');
  }
}

function validCanonicalConfigJson(): string {
  return JSON.stringify(
    {
      version: 1,
      settings: {
        defaultProfile: 'default',
        dryRunByDefault: true,
        backupBeforeWrite: true,
        conflictPolicy: 'refuse',
      },
      profiles: {
        default: {
          mcpServers: {},
          sync: {
            targets: [],
            disabledServers: [],
          },
          skills: [],
        },
      },
    },
    null,
    2,
  );
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

describe('runBootstrap', () => {
  let originalHome: string | undefined;
  let originalXdgConfigHome: string | undefined;
  let originalPath: string | undefined;
  let tempRoots: string[];

  beforeEach(() => {
    originalHome = process.env.HOME;
    originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
    originalPath = process.env.PATH;
    tempRoots = [];
  });

  afterEach(() => {
    for (const dir of tempRoots) {
      rmSync(dir, { recursive: true, force: true });
    }
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    if (originalXdgConfigHome === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = originalXdgConfigHome;
    }
    if (originalPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = originalPath;
    }
  });

  it('returns 0 and prints usage for --help', async () => {
    const stdout = new BufferWriter();
    const stderr = new BufferWriter();

    const code = await runBootstrap(['--help'], stdout, stderr);

    expect(code).toBe(0);
    expect(stdout.text()).toBe(BOOTSTRAP_USAGE);
    expect(stderr.text()).toBe('');
  });

  it('returns 0 and prints usage for -h', async () => {
    const stdout = new BufferWriter();
    const stderr = new BufferWriter();

    const code = await runBootstrap(['-h'], stdout, stderr);

    expect(code).toBe(0);
    expect(stdout.text()).toBe(BOOTSTRAP_USAGE);
    expect(stderr.text()).toBe('');
  });

  it('returns 2 for the no-flag reserved bootstrap path', async () => {
    const stdout = new BufferWriter();
    const stderr = new BufferWriter();

    const code = await runBootstrap([], stdout, stderr);

    expect(code).toBe(2);
    expect(stdout.text()).toBe('');
    expect(stderr.text()).toBe(BOOTSTRAP_RESERVED_MESSAGE);
  });

  it('returns 2 for --json without --dry-run', async () => {
    const stdout = new BufferWriter();
    const stderr = new BufferWriter();

    const code = await runBootstrap(['--json'], stdout, stderr);

    expect(code).toBe(2);
    expect(stderr.text()).toContain('--dry-run');
    expect(stdout.text()).toBe('');
  });

  it('returns 2 for the D1 dry-run stub without --json', async () => {
    const stdout = new BufferWriter();
    const stderr = new BufferWriter();

    const code = await runBootstrap(['--dry-run'], stdout, stderr);

    expect(code).toBe(2);
    expect(stdout.text()).toBe('');
    expect(stderr.text()).toContain(
      'Human output is not implemented in D1 yet.',
    );
  });

  it('returns 2 for an unknown flag', async () => {
    const stdout = new BufferWriter();
    const stderr = new BufferWriter();

    const code = await runBootstrap(['--bogus'], stdout, stderr);

    expect(code).toBe(2);
    expect(stderr.text()).toContain('Unknown flag: --bogus');
    expect(stdout.text()).toBe('');
  });

  it('emits machine JSON, does not create overture.jsonc, and leaves seeded agent config unchanged', async () => {
    const home = mkdtempSync(join(tmpdir(), 'overture-bootstrap-home-'));
    const xdgConfigHome = mkdtempSync(
      join(tmpdir(), 'overture-bootstrap-xdg-'),
    );
    const pathDir = mkdtempSync(join(tmpdir(), 'overture-bootstrap-path-'));
    tempRoots.push(home, xdgConfigHome, pathDir);

    process.env.HOME = home;
    process.env.XDG_CONFIG_HOME = xdgConfigHome;
    process.env.PATH = pathDir;

    const opencodeBin = join(pathDir, 'opencode');
    writeFileSync(opencodeBin, '#!/bin/sh\nexit 0\n');
    chmodSync(opencodeBin, 0o755);

    const opencodeDir = join(xdgConfigHome, 'opencode');
    mkdirSync(opencodeDir, { recursive: true });
    const agentConfigPath = join(opencodeDir, 'opencode.jsonc');
    const agentConfigBefore = opencodeFixtureJsonc();
    writeFileSync(agentConfigPath, agentConfigBefore);

    const paths = defaultOverturePaths();
    expect(existsSync(paths.configFile)).toBe(false);

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
    expect(readFileSync(agentConfigPath, 'utf8')).toBe(agentConfigBefore);
  });

  it('returns 1 and rejects an existing canonical config', async () => {
    const home = mkdtempSync(join(tmpdir(), 'overture-bootstrap-home-'));
    const xdgConfigHome = mkdtempSync(
      join(tmpdir(), 'overture-bootstrap-xdg-'),
    );
    tempRoots.push(home, xdgConfigHome);

    process.env.HOME = home;
    process.env.XDG_CONFIG_HOME = xdgConfigHome;
    process.env.PATH = '';

    const paths = defaultOverturePaths();
    mkdirSync(paths.configDir, { recursive: true });
    writeFileSync(paths.configFile, validCanonicalConfigJson());

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();

    const code = await runBootstrap(['--dry-run', '--json'], stdout, stderr);

    expect(code).toBe(1);
    expect(stdout.text()).toBe('');
    expect(stderr.text()).toContain('Existing canonical config already exists');
  });

  it('returns 2 for an invalid canonical config', async () => {
    const home = mkdtempSync(join(tmpdir(), 'overture-bootstrap-home-'));
    const xdgConfigHome = mkdtempSync(
      join(tmpdir(), 'overture-bootstrap-xdg-'),
    );
    tempRoots.push(home, xdgConfigHome);

    process.env.HOME = home;
    process.env.XDG_CONFIG_HOME = xdgConfigHome;
    process.env.PATH = '';

    const paths = defaultOverturePaths();
    mkdirSync(paths.configDir, { recursive: true });
    writeFileSync(paths.configFile, '{"version":1');

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();

    const code = await runBootstrap(['--dry-run', '--json'], stdout, stderr);

    expect(code).toBe(2);
    expect(stdout.text()).toBe('');
    expect(stderr.text()).toContain('Failed to parse overture config');
  });

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
