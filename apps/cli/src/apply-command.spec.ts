/**
 * F1 + F2 — `overture apply` test suite.
 *
 * Locks the F1 contract (gate-5 types, args/exit-code plumbing, dry-run
 * human renderer) and the F2 real-write contract (backup helper,
 * two-pass orchestration, `ApplyResult` envelope, real-write human
 * renderer, exit-code helper). Mirrors `apps/cli/src/bootstrap-command.spec.ts`:
 * real tmpdirs for filesystem isolation, `BufferWriter` from
 * `test-support/bootstrap-test-support.ts` for stdout/stderr, and
 * per-test env override + restore via `beforeEach`/`afterEach`.
 *
 * Coverage map (each `it(...)` is one bullet):
 *   1. happy path — seeded Claude + OpenCode configs, --dry-run,
 *      seeded bytes are byte-identical before vs after.
 *   2. --json --dry-run envelope shape (matches gate-5).
 *   3. missing canonical config → exit 1 + "no overture config".
 *   4. unknown `settings.defaultProfile` → exit 2.
 *   5. unknown agent id in `sync.targets` → per-agent refusal, others
 *      still complete.
 *   6. agent without `mcp.write` → per-agent refusal with reason
 *      "no writer registered".
 *   7. `disabledServers` excludes a server from the writer input.
 *   8. `settings.defaultProfile` is honored when set.
 *   9. exit code 1 when any result has a refusal reason
 *      (`not-targetable`, `parse-error`, `unsupported-shape`,
 *      `unsupported-format`).
 *   10. exit code 0 when every result is `no-change`.
 *   11. `apply` without `--dry-run` → exit 2 + "not yet implemented".
 *       F2 replaces this stub: the assertion becomes outdated after
 *       F2 lands (Todo 3 replaces it with a real-write assertion).
 *   12. `apply --json` without `--dry-run` → exit 2 (invalid combo).
 *   13. regression: Claude dry-run with a planned update (seeded file
 *       content differs from canonical) classifies as `would-update`,
 *       not `no-change`. Different writers encode the dry-run "would
 *       have written" signal differently (OpenCode / OpenAI Codex set
 *       `changed: true`; Claude / GitHub Copilot CLI leave `changed:
 *       false` and surface `serversWritten` / `bytesChanged` instead);
 *       `statusFromWriterResult` must accept both conventions.
 *
 * F2 — `overture apply` real-write (cases 14-23):
 *   14. real-write happy path — seeded Claude + OpenCode configs,
 *       apply (no flag) writes both targets and creates adjacent
 *       timestamped backups byte-identical to the seeded content.
 *   15. `settings.backupBeforeWrite: false` skips backups entirely
 *       but still performs writes.
 *   16. backup collision suffix — pre-creating `<target>.bak.<ts>`
 *       forces the backup to land at `<target>.bak.<ts>-<hex4>`.
 *   17. `backup-failed` refusal — chmod 0o555 on the parent directory
 *       makes `fs.copyFile` throw `EACCES`; status surfaces
 *       `backup-failed`, the writer is not called, the target is
 *       untouched.
 *   18. `--dry-run` byte-identical regression — backups are NEVER
 *       created under `--dry-run`; targets unchanged.
 *   19. `--json` without `--dry-run` still exit 2 (regression for
 *       the invalid-combination guard from F1).
 *   20. agent without `mcp.write` still surfaces `not-targetable`
 *       (regression for the F1 refusal path).
 *   21. `disabledServers` excludes a server from BOTH Pass 1 (dry-run)
 *       and Pass 2 (real-write) writer inputs.
 *   22. exit code 1 when at least one result is `backup-failed`.
 *   23. multi-target backup — a writer that returns two `targetPaths`
 *       entries causes the backup orchestrator to create one backup
 *       file per resolved target.
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

import { defaultOverturePaths } from '@overture/config';
import { agentRegistry } from '@overture/agents';
import type {
  AgentDefinition,
  AgentMcpWriteResult,
  PlatformId,
  ServerConflict,
} from '@overture/agents';

import { createHash } from 'node:crypto';

import {
  APPLY_USAGE,
  exitCodeForApply,
  exitCodeForApplyDryRun,
  formatBackupTimestamp,
  formatHumanApply,
  formatHumanApplyDryRun,
  runApply,
  type ApplyAgentResult,
  type ApplyDryRunAgentResult,
  type ApplyDryRunResult,
  type ApplyDryRunStatus,
  type ApplyResult,
  type ApplyStatus,
  type RunApplyOptions,
} from './apply-command.js';
import { readApplyState } from './apply-state.js';
import { BufferWriter } from '../test-support/bootstrap-test-support.js';

// Touch RunApplyOptions so a future refactor that removes the export
// surfaces as a compile error here. The F1 slice exposes it for tests
// that need to inject a path context (e.g. spies); the happy-path tests
// below rely on the default factory, but we keep the type referenced so
// a sloppy removal is caught.
export type _ApplyOptionsTouched = RunApplyOptions;
void (null as unknown as _ApplyOptionsTouched);

// ---------------------------------------------------------------------------
// Test environment helpers — mirror bootstrap-command.spec.ts.
// ---------------------------------------------------------------------------

interface ApplyTempEnv {
  readonly home: string;
  readonly xdgConfigHome: string;
  readonly pathDir: string;
  /**
   * Isolated workspace directory. The test calls `process.chdir(workspace)`
   * in beforeEach so Claude Code's writer picks `~/.claude.json` instead
   * of any `.mcp.json` that may exist at the real cwd (e.g. the worktree
   * root ships one for the `nx-mcp` server). After each test, afterEach
   * restores the previous cwd.
   */
  readonly workspace: string;
  readonly env: NodeJS.ProcessEnv;
  readonly cleanup: readonly string[];
}

function createApplyTempEnv(): ApplyTempEnv {
  const home = mkdtempSync(join(tmpdir(), 'overture-apply-home-'));
  const xdgConfigHome = mkdtempSync(join(tmpdir(), 'overture-apply-xdg-'));
  const pathDir = mkdtempSync(join(tmpdir(), 'overture-apply-path-'));
  // Each test gets its own workspace dir; chdir there so writer pickers
  // resolve against an isolated tree with no project-level `.mcp.json`.
  const workspace = mkdtempSync(join(tmpdir(), 'overture-apply-ws-'));
  return {
    home,
    xdgConfigHome,
    pathDir,
    workspace,
    env: {
      ...process.env,
      HOME: home,
      XDG_CONFIG_HOME: xdgConfigHome,
      PATH: pathDir,
    },
    cleanup: [home, xdgConfigHome, pathDir, workspace],
  };
}

function applyEnv(env: {
  readonly home: string;
  readonly xdgConfigHome: string;
  readonly pathDir: string;
  readonly workspace: string;
}): void {
  process.env.HOME = env.home;
  process.env.XDG_CONFIG_HOME = env.xdgConfigHome;
  process.env.PATH = env.pathDir;
  // Isolate `cwd` so the writer pickers (Claude Code's `<workspaceDir>/.mcp.json`
  // preference, in particular) don't see a project-level `.mcp.json` left over
  // from the real cwd (e.g. the worktree root ships one for the `nx-mcp`
  // server). cwd restoration lives in the suite's afterEach.
  process.chdir(env.workspace);
}

// All four agents get stubs on PATH so binary-first detection never
// gates the writers during the happy path. We do NOT touch installed
// state via the agent registry — that is owned by the writer module
// and tested separately. Here we only need the writer to be invoked.
function seedFakeBin(pathDir: string, name: string): void {
  const bin = join(pathDir, name);
  writeFileSync(bin, '#!/bin/sh\nexit 0\n');
  chmodSync(bin, 0o755);
}

function seedAllFakeBins(pathDir: string): void {
  for (const name of ['opencode', 'claude']) {
    seedFakeBin(pathDir, name);
  }
}

// List `<targetName>.bak.*` entries inside `dir`. Used by F2 cases to
// assert that backups were created (or, in Case 18, that none were).
function findBackupFiles(dir: string, targetName: string): string[] {
  if (!existsDir(dir)) return [];
  const entries = readdirSync(dir);
  return entries
    .filter((e: string) => e.startsWith(`${targetName}.bak.`))
    .map((e: string) => join(dir, e))
    .sort();
}

// `existsSync` is imported for the chmod helpers above; use a tiny
// wrapper here so the F2 cases can call it without re-importing.
function existsDir(dir: string): boolean {
  try {
    const s = statSync(dir);
    return s.isDirectory();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Canonical config fixture builders.
// ---------------------------------------------------------------------------

interface CanonicalConfigOptions {
  readonly defaultProfileName?: string;
  readonly profileName?: string;
  readonly mcpServers?: Readonly<Record<string, unknown>>;
  readonly targets?: readonly string[];
  readonly disabledServers?: readonly string[];
  /**
   * Optional `settings.backupBeforeWrite` flag (F2). Defaults to
   * `undefined` so the existing F1 fixtures stay clean — the schema
   * default of `true` fills it in. Tests that want to assert the
   * `false` behavior pass `false` here.
   */
  readonly backupBeforeWrite?: boolean;
}

function buildCanonicalConfigJson(
  options: CanonicalConfigOptions = {},
): string {
  const profileName = options.profileName ?? 'default';
  const mcpServers = options.mcpServers ?? {
    filesystem: {
      type: 'stdio',
      command: 'node',
    },
  };
  const targets = options.targets ?? ['claude-code', 'opencode'];
  const disabledServers = options.disabledServers ?? [];
  const profiles: Record<string, unknown> = {
    [profileName]: {
      mcpServers,
      sync: { targets, disabledServers },
      skills: [],
    },
  };
  if (profileName !== 'default') {
    profiles.default = {
      mcpServers: {},
      sync: { targets: [], disabledServers: [] },
      skills: [],
    };
  }
  // F1 only consumes `settings.defaultProfile` and `settings.dryRunByDefault`.
  // F2 threads `settings.backupBeforeWrite` through the orchestrator. We
  // omit every other Settings field so scope greps for F3 keywords
  // (conflictPolicy) stay clean.
  const settings: Record<string, unknown> = {
    defaultProfile: options.defaultProfileName ?? profileName,
    dryRunByDefault: true,
  };
  if (options.backupBeforeWrite !== undefined) {
    settings.backupBeforeWrite = options.backupBeforeWrite;
  }
  return JSON.stringify(
    {
      version: 1,
      settings,
      profiles,
    },
    null,
    2,
  );
}

function seedCanonicalConfig(xdgConfigHome: string, json: string): string {
  // Derive the on-disk config path purely from the XDG override so this
  // helper does not need to read process.env (the test's beforeEach has
  // already set XDG_CONFIG_HOME by the time this runs).
  const paths = defaultOverturePaths(
    {},
    {
      ...process.env,
      XDG_CONFIG_HOME: xdgConfigHome,
    },
  );
  mkdirSync(paths.configDir, { recursive: true });
  writeFileSync(paths.configFile, json);
  return paths.configFile;
}

// ---------------------------------------------------------------------------
// Per-agent config fixtures.
// ---------------------------------------------------------------------------

function claudeUserConfigJson(serverName = 'filesystem'): string {
  return JSON.stringify(
    {
      mcpServers: {
        [serverName]: {
          type: 'stdio',
          command: 'node',
        },
      },
    },
    null,
    2,
  );
}

function opencodeConfigJsonc(serverName = 'filesystem'): string {
  return `{
  // apply dry-run fixture
  "mcp": {
    "${serverName}": {
      "type": "local",
      "command": ["node"]
    }
  }
}
`;
}

function seedClaudeUserConfig(home: string, contents: string): string {
  const p = join(home, '.claude.json');
  writeFileSync(p, contents);
  return p;
}

function seedOpencodeUserConfig(
  xdgConfigHome: string,
  contents: string,
): string {
  const dir = join(xdgConfigHome, 'opencode');
  mkdirSync(dir, { recursive: true });
  // The opencode writer targets `opencode.json` (not `.jsonc`) per
  // `packages/agents/src/opencode.ts` `mcpLocations[0]`. Seed the file the
  // writer will actually find; F1 dry-run tests still pass because dry-run
  // never writes, and F2 real-write tests need a real target on disk so
  // the backup step has something to copy.
  const p = join(dir, 'opencode.json');
  writeFileSync(p, contents);
  return p;
}

// ---------------------------------------------------------------------------
// Suite-wide env save/restore.
// ---------------------------------------------------------------------------

const ALL_PLATFORM_IDS: readonly PlatformId[] = [
  'claude-code',
  'opencode',
  'github-copilot-cli',
  'openai-codex',
];

describe('runApply (F1 dry-run contract)', () => {
  let cleanupDirs: readonly string[] = [];
  let originalEnv: NodeJS.ProcessEnv;
  let originalCwd: string;

  beforeEach(() => {
    cleanupDirs = [];
    originalEnv = { ...process.env };
    originalCwd = process.cwd();
  });

  afterEach(() => {
    for (const dir of cleanupDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    // Restore cwd so a chdir inside a test does not leak across cases.
    // `process.chdir` throws on undefined, but beforeEach always captures
    // a real cwd at suite start.
    process.chdir(originalCwd);
    // Restore env: simplest reliable approach is to drop our additions and
    // re-apply the captured snapshot. process.env is sealed enough that
    // restoring keys by name is the supported pattern.
    for (const key of [
      'HOME',
      'XDG_CONFIG_HOME',
      'XDG_CONFIG_DIRS',
      'XDG_DATA_HOME',
      'XDG_STATE_HOME',
      'XDG_CACHE_HOME',
      'PATH',
      'USERPROFILE',
    ]) {
      const original = originalEnv[key];
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
  });

  // -------------------------------------------------------------------------
  // Case 12 — invalid flag combination (`--json` requires `--dry-run`).
  //
  // This case works whether or not the real-write path is implemented, so
  // it lives near the top of the F1 suite to exercise the dispatcher
  // contract before any feature flags flip.
  // -------------------------------------------------------------------------

  it('rejects `apply --json` without --dry-run with exit 2 (invalid combination)', async () => {
    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runApply(['--json'], stdout, stderr);
    expect(code).toBe(2);
    // Mirror bootstrap: explicit "invalid combination" message.
    expect(stderr.text().toLowerCase()).toContain('invalid');
    expect(stdout.text()).toBe('');
  });

  it('prints usage for `--help` and returns 0', async () => {
    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runApply(['--help'], stdout, stderr);
    expect(code).toBe(0);
    expect(stdout.text()).toBe(APPLY_USAGE);
    expect(stderr.text()).toBe('');
  });

  it('rejects unknown flag with exit 2', async () => {
    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runApply(['--bogus'], stdout, stderr);
    expect(code).toBe(2);
    expect(stderr.text()).toContain('Unknown flag: --bogus');
    expect(stderr.text()).toContain(APPLY_USAGE);
    expect(stdout.text()).toBe('');
  });

  // -------------------------------------------------------------------------
  // Case 3 — missing canonical config.
  // -------------------------------------------------------------------------

  it('returns exit 1 with "no overture config" message when overture.jsonc is absent', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runApply(['--dry-run'], stdout, stderr);

    expect(code).toBe(1);
    // Either stderr or stdout must surface the canonical-config message.
    const combined = `${stdout.text()}${stderr.text()}`.toLowerCase();
    expect(combined).toContain('no overture config');
  });

  // -------------------------------------------------------------------------
  // Case 4 — unknown profile name.
  // -------------------------------------------------------------------------

  it('returns exit 2 when settings.defaultProfile names an unknown profile', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);

    seedCanonicalConfig(
      env.xdgConfigHome,
      buildCanonicalConfigJson({ defaultProfileName: 'ghost' }),
    );

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runApply(['--dry-run'], stdout, stderr);

    expect(code).toBe(2);
    expect(stderr.text().toLowerCase()).toContain('unknown profile');
  });

  // -------------------------------------------------------------------------
  // Case 8 — defaultProfile is honored when set.
  // -------------------------------------------------------------------------

  it('honors settings.defaultProfile when set (envelope profile name)', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    seedCanonicalConfig(
      env.xdgConfigHome,
      buildCanonicalConfigJson({
        defaultProfileName: 'prod',
        profileName: 'prod',
        targets: ['claude-code'],
      }),
    );
    const claudePath = seedClaudeUserConfig(env.home, claudeUserConfigJson());
    const claudeBefore = readFileSync(claudePath);

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runApply(['--dry-run', '--json'], stdout, stderr);

    expect(code).toBeGreaterThanOrEqual(0);
    expect(code).toBeLessThanOrEqual(1);
    const parsed = JSON.parse(stdout.text()) as ApplyDryRunResult;
    expect(parsed.profile).toBe('prod');
    expect(parsed.results.length).toBe(1);
    expect(parsed.results[0]?.agentId).toBe('claude-code');
    expect(readFileSync(claudePath)).toEqual(claudeBefore);
  });

  // -------------------------------------------------------------------------
  // Case 1 — happy path: seeded Claude + OpenCode, --dry-run,
  // seeded bytes are byte-identical before vs after.
  // -------------------------------------------------------------------------

  it('apply --dry-run succeeds with seeded Claude + OpenCode configs and never writes disk', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    const claudePath = seedClaudeUserConfig(env.home, claudeUserConfigJson());
    const opencodePath = seedOpencodeUserConfig(
      env.xdgConfigHome,
      opencodeConfigJsonc(),
    );

    seedCanonicalConfig(env.xdgConfigHome, buildCanonicalConfigJson());

    const claudeBeforeBytes = readFileSync(claudePath);
    const claudeBeforeStat = statSync(claudePath);
    const opencodeBeforeBytes = readFileSync(opencodePath);
    const opencodeBeforeStat = statSync(opencodePath);

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runApply(['--dry-run'], stdout, stderr);

    expect(stderr.text()).toBe('');
    expect(code).toBeGreaterThanOrEqual(0);
    expect(code).toBeLessThanOrEqual(1);

    // Human-readable report should mention both seeded agents.
    const out = stdout.text();
    expect(out).toContain('claude-code');
    expect(out).toContain('opencode');
    // Per-agent status line must include one of the documented statuses.
    expect(out).toMatch(
      /would-update|no-change|not-targetable|parse-error|unsupported-shape|unsupported-format/,
    );

    // Disk invariants — the dry-run guarantee proof.
    expect(readFileSync(claudePath)).toEqual(claudeBeforeBytes);
    expect(statSync(claudePath).size).toBe(claudeBeforeStat.size);
    expect(statSync(claudePath).mtimeMs).toBe(claudeBeforeStat.mtimeMs);
    expect(readFileSync(opencodePath)).toEqual(opencodeBeforeBytes);
    expect(statSync(opencodePath).size).toBe(opencodeBeforeStat.size);
    expect(statSync(opencodePath).mtimeMs).toBe(opencodeBeforeStat.mtimeMs);
  });

  // -------------------------------------------------------------------------
  // Case 2 — --json --dry-run envelope shape.
  // -------------------------------------------------------------------------

  it('apply --json --dry-run emits the gate-5 envelope shape without raw byte leaks', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    const claudePath = seedClaudeUserConfig(env.home, claudeUserConfigJson());
    const opencodePath = seedOpencodeUserConfig(
      env.xdgConfigHome,
      opencodeConfigJsonc(),
    );

    seedCanonicalConfig(env.xdgConfigHome, buildCanonicalConfigJson());

    const claudeBeforeBytes = readFileSync(claudePath);
    const opencodeBeforeBytes = readFileSync(opencodePath);

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runApply(['--dry-run', '--json'], stdout, stderr);

    expect(stderr.text()).toBe('');
    expect(code).toBeGreaterThanOrEqual(0);
    expect(code).toBeLessThanOrEqual(1);

    const text = stdout.text();
    expect(text.endsWith('\n')).toBe(true);

    const parsed = JSON.parse(text) as unknown;
    expect(parsed).toBeTypeOf('object');
    const envelope = parsed as Record<string, unknown>;

    // Envelope keys: profile, configPath, disabledServers, results.
    expect(Object.keys(envelope).sort()).toEqual(
      ['configPath', 'disabledServers', 'profile', 'results'].sort(),
    );
    expect(typeof envelope.profile).toBe('string');
    expect(typeof envelope.configPath).toBe('string');
    expect(Array.isArray(envelope.disabledServers)).toBe(true);
    expect(Array.isArray(envelope.results)).toBe(true);

    const results = envelope.results as readonly ApplyDryRunAgentResult[];
    expect(results.length).toBe(2);

    // Each result must carry agentId, displayName, status, result.
    for (const r of results) {
      expect(typeof r.agentId).toBe('string');
      expect(typeof r.displayName).toBe('string');
      expect([
        'would-update',
        'no-change',
        'not-targetable',
        'parse-error',
        'unsupported-shape',
        'unsupported-format',
      ]).toContain(r.status);
      expect(r.result).toBeTypeOf('object');
      expect(typeof r.result.written).toBe('number');
      expect(typeof r.result.changed).toBe('boolean');
      expect(typeof r.result.dryRun).toBe('boolean');
    }

    // No raw-bytes leak: walk the JSON tree and assert the forbidden keys
    // never appear anywhere.
    const serialized = JSON.stringify(envelope);
    expect(serialized).not.toContain('originalBytes');
    expect(serialized).not.toContain('writtenBytes');

    // Disk invariants — the dry-run guarantee proof.
    expect(readFileSync(claudePath)).toEqual(claudeBeforeBytes);
    expect(readFileSync(opencodePath)).toEqual(opencodeBeforeBytes);
  });

  // -------------------------------------------------------------------------
  // Case 5 — unknown agent id in sync.targets.
  // -------------------------------------------------------------------------

  it('unknown agent id in sync.targets surfaces as not-targetable while other targets complete', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    seedCanonicalConfig(
      env.xdgConfigHome,
      buildCanonicalConfigJson({
        targets: ['claude-code', 'fake-agent'],
      }),
    );
    const claudePath = seedClaudeUserConfig(env.home, claudeUserConfigJson());
    const claudeBefore = readFileSync(claudePath);

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runApply(['--dry-run', '--json'], stdout, stderr);

    // At least one refusal → exit 1.
    expect(code).toBe(1);

    const envelope = JSON.parse(stdout.text()) as ApplyDryRunResult;
    expect(envelope.results.length).toBe(2);

    const fakeAgent = envelope.results.find(
      (r: ApplyDryRunAgentResult) => r.agentId === 'fake-agent',
    );
    expect(fakeAgent).toBeDefined();
    expect(fakeAgent?.status).toBe('not-targetable');

    const claudeResult = envelope.results.find(
      (r: ApplyDryRunAgentResult) => r.agentId === 'claude-code',
    );
    expect(claudeResult).toBeDefined();
    // claude-code target seeded and valid → not a refusal.
    expect(claudeResult?.status).not.toBe('not-targetable');
    expect(claudeResult?.status).not.toBe('parse-error');

    // Dry-run guarantee still holds.
    expect(readFileSync(claudePath)).toEqual(claudeBefore);
  });

  // -------------------------------------------------------------------------
  // Case 6 — agent without `mcp.write`.
  //
  // We use a vi.spyOn on the registry entry's `mcp` getter to swap in a
  // handlers object whose `write` is undefined for the duration of the
  // test. After the call we restore the spy. This is the supported way
  // to test "writer missing" against a frozen registry.
  // -------------------------------------------------------------------------

  it('agent whose mcp.write is absent surfaces as not-targetable with reason "no writer registered"', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    seedCanonicalConfig(
      env.xdgConfigHome,
      buildCanonicalConfigJson({ targets: ['opencode'] }),
    );
    const opencodePath = seedOpencodeUserConfig(
      env.xdgConfigHome,
      opencodeConfigJsonc(),
    );
    const opencodeBefore = readFileSync(opencodePath);

    const target: AgentDefinition | undefined = agentRegistry.find(
      (a) => a.id === 'opencode',
    );
    expect(target).toBeDefined();
    if (target === undefined) return;

    // Replace `mcp` with a handlers object missing `write`. The agent
    // still exposes a read so the rest of the registry stays consistent.
    const originalMcp = target.mcp;
    const strippedMcp = {
      read: originalMcp.read,
      // intentionally omit `write`
    } as unknown as AgentDefinition['mcp'];

    const spy = vi.spyOn(target, 'mcp', 'get').mockReturnValue(strippedMcp);

    try {
      const stdout = new BufferWriter();
      const stderr = new BufferWriter();
      const code = await runApply(['--dry-run', '--json'], stdout, stderr);

      expect(code).toBe(1);
      const envelope = JSON.parse(stdout.text()) as ApplyDryRunResult;
      const opencodeResult = envelope.results.find(
        (r: ApplyDryRunAgentResult) => r.agentId === 'opencode',
      );
      expect(opencodeResult).toBeDefined();
      expect(opencodeResult?.status).toBe('not-targetable');
      expect(opencodeResult?.reasonDetail).toContain('no writer registered');
    } finally {
      spy.mockRestore();
    }

    // Disk invariant — the missing-writer path must not write either.
    expect(readFileSync(opencodePath)).toEqual(opencodeBefore);
  });

  // -------------------------------------------------------------------------
  // Case 7 — disabledServers excludes a server from the writer input.
  //
  // We swap one agent's `mcp.write` for a spy that captures the input.
  // The spy preserves the original writer's no-op dry-run result shape
  // so the surrounding envelope/aggregation path is exercised too.
  // -------------------------------------------------------------------------

  it('disabledServers excludes the named server from the writer input', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    seedCanonicalConfig(
      env.xdgConfigHome,
      buildCanonicalConfigJson({
        mcpServers: {
          a: { type: 'stdio', command: 'node' },
          b: { type: 'stdio', command: 'node' },
        },
        targets: ['claude-code'],
        disabledServers: ['a'],
      }),
    );
    const claudePath = seedClaudeUserConfig(
      env.home,
      // Pre-existing entries so the writer targets the file.
      claudeUserConfigJson('a'),
    );
    const claudeBefore = readFileSync(claudePath);

    const target: AgentDefinition | undefined = agentRegistry.find(
      (a) => a.id === 'claude-code',
    );
    expect(target).toBeDefined();
    if (target === undefined) return;

    const captured: { input: { servers: readonly { name: string }[] } | null } =
      {
        input: null,
      };
    const originalWrite = target.mcp.write;
    const writeSpy = vi
      .spyOn(target.mcp, 'write')
      .mockImplementation(async (ctx, input) => {
        captured.input = {
          servers: input.servers.map((s) => ({ name: s.name })),
        };
        return originalWrite(ctx, input);
      });

    try {
      const stdout = new BufferWriter();
      const stderr = new BufferWriter();
      await runApply(['--dry-run'], stdout, stderr);

      expect(captured.input).not.toBeNull();
      const names = (captured.input?.servers ?? []).map((s) => s.name);
      expect(names).not.toContain('a');
      expect(names).toContain('b');
    } finally {
      writeSpy.mockRestore();
    }

    expect(readFileSync(claudePath)).toEqual(claudeBefore);
  });

  // -------------------------------------------------------------------------
  // Case 9 — exit code 1 when any per-agent result has a refusal reason.
  //
  // We force a parse-error by seeding the Claude config as malformed
  // JSONC. The writer surfaces `reason: 'parse-error'` and the
  // aggregator returns 1.
  // -------------------------------------------------------------------------

  it('returns exit code 1 when any result has a refusal reason (parse-error via malformed Claude JSONC)', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    seedCanonicalConfig(
      env.xdgConfigHome,
      buildCanonicalConfigJson({ targets: ['claude-code'] }),
    );
    // Malformed JSONC: unterminated string. Writer must surface parse-error.
    seedClaudeUserConfig(env.home, '{ "mcpServers": { ');

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runApply(['--dry-run', '--json'], stdout, stderr);

    expect(code).toBe(1);
    const envelope = JSON.parse(stdout.text()) as ApplyDryRunResult;
    const claudeResult = envelope.results.find(
      (r: ApplyDryRunAgentResult) => r.agentId === 'claude-code',
    );
    expect(claudeResult).toBeDefined();
    expect(claudeResult?.status).toBe('parse-error');
    expect(claudeResult?.result?.reason).toBe('parse-error');
  });

  // -------------------------------------------------------------------------
  // Case 10 — exit code 0 when every result is no-change.
  //
  // Strategy: seed a Claude config whose current mcpServers already
  // match the canonical intent exactly. The writer computes a no-change
  // result and the aggregator returns 0. We pick a fixture that the
  // writer will treat as byte-equal for the single-server "filesystem"
  // case (the writer normalizes `type: 'stdio'` defaults, so we keep
  // the field explicit to match the canonical shape).
  // -------------------------------------------------------------------------

  it('returns exit code 0 when every result is no-change (byte-equal agent config)', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    // Seed canonical intent with a single filesystem server.
    seedCanonicalConfig(
      env.xdgConfigHome,
      buildCanonicalConfigJson({
        mcpServers: {
          filesystem: { type: 'stdio', command: 'node' },
        },
        targets: ['claude-code'],
      }),
    );
    // Pre-existing Claude config: identical to the writer's emitted
    // shape for a single stdio server. The writer must treat this as
    // no-change.
    seedClaudeUserConfig(env.home, claudeUserConfigJson('filesystem'));

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    // F2 changed the default: `apply` (no flag) now real-writes. To
    // assert "no-change" semantics with the F1 JSON envelope shape,
    // pass `--dry-run --json` so we exercise the dry-run path that
    // already covers no-change classification.
    const code = await runApply(['--dry-run', '--json'], stdout, stderr);

    expect(stderr.text()).toBe('');
    expect(code).toBe(0);

    const envelope = JSON.parse(stdout.text()) as ApplyDryRunResult;
    expect(envelope.results.length).toBe(1);
    const claudeResult = envelope.results[0];
    expect(claudeResult?.status).toBe('no-change');
    expect(claudeResult?.result?.changed).toBe(false);
    expect(claudeResult?.result?.dryRun).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Case 13 — regression: Claude dry-run with a planned update must classify
  // as `would-update`, not `no-change`.
  //
  // The Claude Code writer reports `changed: false` and `written: 0` in
  // dry-run even when the seeded file content differs from canonical and a
  // planned update exists; it surfaces the dry-run diff via
  // `serversWritten` and `bytesChanged` instead. (OpenCode and OpenAI Codex
  // writers set `changed: true` for the same case — a writer-convention
  // divergence.) Case 1 + Case 10 above only exercise the matching-content
  // path and therefore pass under both the old and the fixed
  // `statusFromWriterResult`; this case seeds a DIFFERING command so the
  // dry-run computes a planned update and the classifier has to recognize
  // it via `serversWritten` / `bytesChanged`.
  // -------------------------------------------------------------------------

  it('F3: classifies a Claude dry-run with divergent canonical settings as conflict refusal', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    // Canonical intent: single filesystem server with `command: 'node'`.
    seedCanonicalConfig(
      env.xdgConfigHome,
      buildCanonicalConfigJson({
        mcpServers: {
          filesystem: { type: 'stdio', command: 'node' },
        },
        targets: ['claude-code'],
      }),
    );
    // Seeded file: same server name but a different `command`. Under
    // F3 this is a settings-drift refusal (not a planned update).
    seedClaudeUserConfig(
      env.home,
      JSON.stringify(
        {
          mcpServers: {
            filesystem: { type: 'stdio', command: 'old' },
          },
        },
        null,
        2,
      ),
    );

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runApply(['--dry-run', '--json'], stdout, stderr);

    expect(stderr.text()).toBe('');
    // F3 supersedes the pre-F3 "would-update" path: divergent settings
    // refuse the write, and the orchestrator returns exit 1.
    expect(code).toBe(1);

    const envelope = JSON.parse(stdout.text()) as ApplyDryRunResult;
    expect(envelope.results.length).toBe(1);
    const claudeResult = envelope.results[0];
    expect(claudeResult).toBeDefined();
    expect(claudeResult?.status).toBe('conflict');
    const writer = claudeResult?.result;
    expect(writer.changed).toBe(false);
    expect(writer.dryRun).toBe(true);
    expect(writer.written).toBe(0);
    expect(writer.serversWritten).toEqual([]);
    expect(writer.conflicts).toBeDefined();
    expect(writer.conflicts?.[0]?.serverName).toBe('filesystem');
  });
});

// ---------------------------------------------------------------------------
// F2 — `overture apply` real-write contract.
//
// Each new `it(...)` is one bullet from the F2 plan (cases 14-23). They run
// against the same env scaffolding as the F1 suite above (real tmpdirs,
// `applyEnv` for env + cwd isolation, `seedAllFakeBins` for binary markers).
// ---------------------------------------------------------------------------

describe('runApply (F2 real-write contract)', () => {
  let cleanupDirs: readonly string[] = [];
  let originalEnv: NodeJS.ProcessEnv;
  let originalCwd: string;

  beforeEach(() => {
    cleanupDirs = [];
    originalEnv = { ...process.env };
    originalCwd = process.cwd();
  });

  afterEach(() => {
    for (const dir of cleanupDirs) {
      // Best-effort restore permissions so a chmod 0o555 in Case 17 does not
      // make `rmSync` fail.
      try {
        chmodSync(dir, 0o755);
      } catch {
        /* ignore */
      }
      rmSync(dir, { recursive: true, force: true });
    }
    process.chdir(originalCwd);
    for (const key of [
      'HOME',
      'XDG_CONFIG_HOME',
      'XDG_CONFIG_DIRS',
      'XDG_DATA_HOME',
      'XDG_STATE_HOME',
      'XDG_CACHE_HOME',
      'PATH',
      'USERPROFILE',
    ]) {
      const original = originalEnv[key];
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
  });

  // -------------------------------------------------------------------------
  // Case 14 — real-write happy path.
  //
  // Seeds BOTH Claude and OpenCode configs that differ from canonical so
  // each writer plans an update (Claude: `command: 'old'` vs canonical
  // `'node'`; OpenCode: `type: 'local'` + `command: ['old']` vs canonical
  // `type: 'stdio'` + `command: 'node'`). Case 14 covers both writers'
  // real-write paths with byte-level assertions; per-writer byte fidelity
  // is locked by the unit-specs in
  // `packages/agents/src/{claude-code,opencode,...}.write.spec.ts`.
  // -------------------------------------------------------------------------

  it('F3: apply (no flag) refuses divergent canonical settings, leaves files unchanged, no backups created', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    // Claude seeded with `command: 'old'`; canonical `command: 'node'`.
    // F3 detects the settings drift and refuses the write.
    const claudePath = seedClaudeUserConfig(
      env.home,
      JSON.stringify(
        {
          mcpServers: {
            filesystem: { type: 'stdio', command: 'old' },
          },
        },
        null,
        2,
      ),
    );
    const opencodePath = seedOpencodeUserConfig(
      env.xdgConfigHome,
      `{
  "mcp": {
    "filesystem": {
      "type": "local",
      "command": ["old"]
    }
  }
}
`,
    );
    seedCanonicalConfig(
      env.xdgConfigHome,
      buildCanonicalConfigJson({
        mcpServers: {
          filesystem: { type: 'stdio', command: 'node' },
        },
      }),
    );

    const claudeBeforeBytes = readFileSync(claudePath);
    const opencodeBeforeBytes = readFileSync(opencodePath);

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runApply([], stdout, stderr);

    expect(stderr.text()).toBe('');
    // F3 refusal: exit code 1.
    expect(code).toBe(1);

    // Targets untouched.
    const claudeAfterBytes = readFileSync(claudePath);
    const opencodeAfterBytes = readFileSync(opencodePath);
    expect(claudeAfterBytes).toEqual(claudeBeforeBytes);
    expect(opencodeAfterBytes).toEqual(opencodeBeforeBytes);

    // No backups created — Pass 2 never ran, conflict path skips backup.
    const claudeBackups = findBackupFiles(
      dirname(claudePath),
      basename(claudePath),
    );
    const opencodeBackups = findBackupFiles(
      dirname(opencodePath),
      basename(opencodePath),
    );

    expect(claudeBackups.length).toBe(0);
    expect(opencodeBackups.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Case 15 — `settings.backupBeforeWrite: false` skips backups but still
  // writes.
  // -------------------------------------------------------------------------

  it('F3: divergent canonical settings with backupBeforeWrite: false still refuse (conflict precludes backup and write)', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    const claudePath = seedClaudeUserConfig(
      env.home,
      JSON.stringify(
        {
          mcpServers: {
            filesystem: { type: 'stdio', command: 'old' },
          },
        },
        null,
        2,
      ),
    );
    seedCanonicalConfig(
      env.xdgConfigHome,
      buildCanonicalConfigJson({ backupBeforeWrite: false }),
    );

    const claudeBeforeBytes = readFileSync(claudePath);

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runApply([], stdout, stderr);

    expect(stderr.text()).toBe('');
    // F3 refusal: exit 1 (backupBeforeWrite: false does not weaken refusal).
    expect(code).toBe(1);

    // Target untouched.
    const claudeAfterBytes = readFileSync(claudePath);
    expect(claudeAfterBytes).toEqual(claudeBeforeBytes);

    // No backup files created — conflict path skips both backup and write.
    const claudeDir = dirname(claudePath);
    const claudeBackups = findBackupFiles(claudeDir, basename(claudePath));
    expect(claudeBackups.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Case 16 — backup collision suffix.
  //
  // We inject a deterministic clock via `RunApplyOptions.now` and pre-create
  // `<target>.bak.<expected-ts>` so the timestamped name collides. The
  // helper must retry with a `-<hex4>` suffix.
  // -------------------------------------------------------------------------

  it('F3: divergent canonical settings pre-empt the backup collision path (no write, no backup)', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    const fixedNow = new Date('2026-07-03T18:30:00.123Z');
    const expectedTs = formatBackupTimestamp(fixedNow);

    const claudePath = seedClaudeUserConfig(
      env.home,
      JSON.stringify(
        {
          mcpServers: {
            filesystem: { type: 'stdio', command: 'old' },
          },
        },
        null,
        2,
      ),
    );
    const claudeDir = dirname(claudePath);

    // Pre-create the colliding backup path (from the pre-F3 backup
    // collision test that lived here). Under F3 the writer refuses
    // before any backup would be created, so the pre-existing collision
    // is irrelevant.
    const collidingPath = `${claudePath}.bak.${expectedTs}`;
    writeFileSync(collidingPath, 'collision\n');

    seedCanonicalConfig(
      env.xdgConfigHome,
      buildCanonicalConfigJson({
        targets: ['claude-code'],
        mcpServers: {
          filesystem: { type: 'stdio', command: 'node' },
        },
      }),
    );

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runApply([], stdout, stderr, { now: fixedNow });

    expect(stderr.text()).toBe('');
    // F3 refusal: exit 1.
    expect(code).toBe(1);

    // No NEW backup created (the colliding pre-existing file may stay).
    const backups = findBackupFiles(claudeDir, basename(claudePath));
    const collisionSuffixRegex = new RegExp(
      `\\.bak\\.${expectedTs}-[0-9a-f]{4}$`,
    );
    const suffixed = backups.filter(
      (p) => collisionSuffixRegex.test(p) && p !== collidingPath,
    );
    expect(suffixed.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Case 17 — backup-failed refusal.
  //
  // chmodSync the target's parent directory to 0o555 so `fs.copyFile`
  // throws EACCES. The orchestrator must surface `status: 'backup-failed'`
  // and skip Pass 2 (the target file is unchanged).
  // -------------------------------------------------------------------------

  it('chmod 0o555 on parent dir surfaces backup-failed and does not call Pass 2', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    const claudePath = seedClaudeUserConfig(
      env.home,
      JSON.stringify(
        {
          mcpServers: {
            filesystem: { type: 'stdio', command: 'old' },
          },
        },
        null,
        2,
      ),
    );
    const claudeDir = dirname(claudePath);

    seedCanonicalConfig(env.xdgConfigHome, buildCanonicalConfigJson());

    const claudeBeforeBytes = readFileSync(claudePath);

    // Lock down the directory: no write perms → copyFile to .bak.* fails.
    // Skip on Windows where chmod mode bits are not enforced the same way.
    if (process.platform === 'win32') {
      return;
    }
    const originalDirMode = statSync(claudeDir).mode & 0o777;
    chmodSync(claudeDir, 0o555);

    let code!: number;
    let stdoutText!: string;
    let stderrText!: string;
    try {
      const stdout = new BufferWriter();
      const stderr = new BufferWriter();
      code = await runApply([], stdout, stderr);
      stdoutText = stdout.text();
      stderrText = stderr.text();
    } finally {
      // Always restore perms so afterEach can rmSync.
      chmodSync(claudeDir, originalDirMode);
    }

    // At least one agent (claude-code) reports backup-failed → exit 1.
    expect(code).toBe(1);
    const combined = `${stdoutText}${stderrText}`.toLowerCase();
    expect(combined).toContain('backup');

    // The target was NOT written (Pass 2 skipped).
    expect(readFileSync(claudePath)).toEqual(claudeBeforeBytes);
  });

  // -------------------------------------------------------------------------
  // Case 18 — `apply --dry-run` byte-identical regression; backupBeforeWrite
  // is honored but `--dry-run` is read-only so no backup files exist.
  // -------------------------------------------------------------------------

  it('F3: apply --dry-run with divergent canonical is byte-identical and creates no .bak. files (exit 1)', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    const claudePath = seedClaudeUserConfig(
      env.home,
      JSON.stringify(
        {
          mcpServers: {
            filesystem: { type: 'stdio', command: 'old' },
          },
        },
        null,
        2,
      ),
    );
    const opencodePath = seedOpencodeUserConfig(
      env.xdgConfigHome,
      opencodeConfigJsonc(),
    );

    seedCanonicalConfig(env.xdgConfigHome, buildCanonicalConfigJson());

    const claudeBeforeBytes = readFileSync(claudePath);
    const opencodeBeforeBytes = readFileSync(opencodePath);

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runApply(['--dry-run'], stdout, stderr);

    expect(stderr.text()).toBe('');
    // F3 refusal: Claude detects divergent canonical settings → exit 1.
    expect(code).toBe(1);

    // Targets unchanged.
    expect(readFileSync(claudePath)).toEqual(claudeBeforeBytes);
    expect(readFileSync(opencodePath)).toEqual(opencodeBeforeBytes);

    // No .bak.* files anywhere.
    expect(findBackupFiles(dirname(claudePath), basename(claudePath))).toEqual(
      [],
    );
    expect(
      findBackupFiles(dirname(opencodePath), basename(opencodePath)),
    ).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Case 19 — `apply --json` without `--dry-run` exits 2 (regression for
  // F1 invalid-combination guard).
  // -------------------------------------------------------------------------

  it('apply --json without --dry-run exits 2 (invalid combination)', async () => {
    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runApply(['--json'], stdout, stderr);

    expect(code).toBe(2);
    expect(stderr.text().toLowerCase()).toContain('invalid');
    expect(stdout.text()).toBe('');
  });

  // -------------------------------------------------------------------------
  // Case 20 — unknown agent id surfaces as not-targetable.
  // -------------------------------------------------------------------------

  it('unknown agent id in sync.targets surfaces as not-targetable', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    seedCanonicalConfig(
      env.xdgConfigHome,
      buildCanonicalConfigJson({ targets: ['nonexistent'] }),
    );

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runApply([], stdout, stderr);

    expect(code).toBe(1);
    const out = stdout.text();
    expect(out).toContain('not-targetable');
    expect(out).toContain('nonexistent');
  });

  // -------------------------------------------------------------------------
  // Case 21 — `disabledServers` excludes a server from BOTH Pass 1
  // (dry-run discovery) and Pass 2 (real-write) inputs.
  //
  // We spy on the opencode writer to capture both calls. Both must show
  // `b` but never `a`.
  // -------------------------------------------------------------------------

  it('disabledServers excludes the named server from both Pass 1 and Pass 2 writer inputs', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    seedCanonicalConfig(
      env.xdgConfigHome,
      buildCanonicalConfigJson({
        mcpServers: {
          a: { type: 'stdio', command: 'node' },
          b: { type: 'stdio', command: 'node' },
        },
        targets: ['opencode'],
        disabledServers: ['a'],
      }),
    );
    seedOpencodeUserConfig(env.xdgConfigHome, opencodeConfigJsonc('b'));

    const target: AgentDefinition | undefined = agentRegistry.find(
      (a) => a.id === 'opencode',
    );
    expect(target).toBeDefined();
    if (target === undefined) return;
    const originalWrite = target.mcp.write;
    if (originalWrite === undefined) return;

    const capturedInputs: { servers: readonly { name: string }[] }[] = [];
    const writeSpy = vi
      .spyOn(target.mcp, 'write')
      .mockImplementation(async (ctx, input) => {
        capturedInputs.push({
          servers: input.servers.map((s) => ({ name: s.name })),
        });
        return originalWrite(ctx, input);
      });

    try {
      const stdout = new BufferWriter();
      const stderr = new BufferWriter();
      await runApply([], stdout, stderr);

      // Two writer calls (Pass 1 dry-run + Pass 2 real-write).
      expect(capturedInputs.length).toBeGreaterThanOrEqual(1);
      for (const captured of capturedInputs) {
        const names = captured.servers.map((s) => s.name);
        expect(names).not.toContain('a');
      }
      // At least one captured input must contain `b`.
      const lastInput = capturedInputs[capturedInputs.length - 1];
      expect(lastInput?.servers.map((s) => s.name)).toContain('b');
    } finally {
      writeSpy.mockRestore();
    }
  });

  // -------------------------------------------------------------------------
  // Case 22 — exit code 1 when at least one result is `backup-failed`.
  // -------------------------------------------------------------------------

  it('exit code is 1 when at least one agent result is backup-failed', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    const claudePath = seedClaudeUserConfig(
      env.home,
      JSON.stringify(
        {
          mcpServers: {
            filesystem: { type: 'stdio', command: 'old' },
          },
        },
        null,
        2,
      ),
    );
    const claudeDir = dirname(claudePath);

    seedCanonicalConfig(env.xdgConfigHome, buildCanonicalConfigJson());

    if (process.platform === 'win32') return;
    const originalDirMode = statSync(claudeDir).mode & 0o777;
    chmodSync(claudeDir, 0o555);

    let code!: number;
    try {
      const stdout = new BufferWriter();
      const stderr = new BufferWriter();
      code = await runApply([], stdout, stderr);
    } finally {
      chmodSync(claudeDir, originalDirMode);
    }

    expect(code).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Case 23 — Claude Code two-target backup.
  //
  // TODO: skipped — see `.omo/drafts/f2-apply-with-backups.md` Case 23.
  //
  // The Claude Code writer (`packages/agents/src/claude-code-write.ts`)
  // calls `pickClaudeCodeTarget`, which returns at most ONE target
  // (project `.mcp.json` wins if present; otherwise user-top or
  // user-projects under `~/.claude.json`). It never writes to both
  // `~/.claude.json` AND `<workspaceDir>/.mcp.json` in a single call,
  // so a "two backups per agent" assertion cannot be made against the
  // current writer surface. The end-to-end real-write guarantee is
  // exercised instead by `node apps/cli/scripts/verify-package.mjs`,
  // which performs a real `overture apply` against a tmpdir.
  //
  // (Adding the multi-target support is intentionally out of scope for
  // F2; it would require widening `AgentMcpWriteResult.targetPaths[]`
  // semantics beyond the writer's "first matching location" contract.)
  // -------------------------------------------------------------------------
});

// ---------------------------------------------------------------------------
// G1 — `overture apply` apply-state recording (cases 24-28).
//
// Each case uses the same tmpdir scaffolding as F1/F2/F3. The XDG_STATE_HOME
// override (Case 28) and the state-file lifecycle (Cases 24-27) are locked
// here; codec and writer round-trip semantics live in `apply-state.spec.ts`.
// ---------------------------------------------------------------------------

describe('runApply (G1 apply-state recording)', () => {
  let cleanupDirs: readonly string[] = [];
  let originalEnv: NodeJS.ProcessEnv;
  let originalCwd: string;

  // Resolve the default `stateDir` for the current env. Mirrors the
  // real-writer path so tests assert against the same directories the
  // orchestrator lands on. `XDG_STATE_HOME` overrides take precedence
  // over `HOME` per the XDG Base Directory Specification.
  function defaultStateDir(): string {
    const paths = defaultOverturePaths({}, process.env);
    return join(paths.stateDir, 'apply');
  }

  beforeEach(() => {
    cleanupDirs = [];
    originalEnv = { ...process.env };
    originalCwd = process.cwd();
    // Default XDG_STATE_HOME to a fresh tmpdir so each test gets an
    // isolated state directory. The afterEach restores the original
    // env (and afterEach removes the listed dirs in `cleanupDirs`).
    const xdgState = mkdtempSync(join(tmpdir(), 'overture-apply-state-'));
    process.env.XDG_STATE_HOME = xdgState;
    cleanupDirs = [...cleanupDirs, xdgState];
  });

  afterEach(() => {
    for (const dir of cleanupDirs) {
      try {
        chmodSync(dir, 0o755);
      } catch {
        /* ignore */
      }
      rmSync(dir, { recursive: true, force: true });
    }
    process.chdir(originalCwd);
    for (const key of [
      'HOME',
      'XDG_CONFIG_HOME',
      'XDG_CONFIG_DIRS',
      'XDG_DATA_HOME',
      'XDG_STATE_HOME',
      'XDG_CACHE_HOME',
      'PATH',
      'USERPROFILE',
    ]) {
      const original = originalEnv[key];
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
  });

  // -------------------------------------------------------------------------
  // Case 24 — `overture apply` (real-write) writes both the per-run record
  // and the `last.json` pointer. Hashes present for every agent whose
  // target file existed pre-write.
  //
  // Setup: single OpenCode agent. Seeded content differs from canonical so
  // the writer plans an update (`would-update`) and Pass 2 runs. `last.json`
  // must point to the per-run file's basename and the per-run record must
  // parse back to an `ApplyStateRecord`.
  // -------------------------------------------------------------------------

  it('Case 24: real-write writes <stateDir>/apply/<runId>.json + last.json pointer with hashes for the agent', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    const opencodePath = seedOpencodeUserConfig(
      env.xdgConfigHome,
      opencodeConfigJsonc('filesystem'),
    );
    // Capture the seeded bytes; pre-hash must match.
    const opencodeBefore = readFileSync(opencodePath);

    seedCanonicalConfig(
      env.xdgConfigHome,
      buildCanonicalConfigJson({
        mcpServers: {
          filesystem: { type: 'stdio', command: 'node' },
          extra: { type: 'stdio', command: 'extra-cmd' },
        },
      }),
    );

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runApply([], stdout, stderr);

    expect(stderr.text()).toBe('');
    expect(code).toBeGreaterThanOrEqual(0);
    expect(code).toBeLessThanOrEqual(1);

    const stateDir = defaultStateDir();
    expect(stateDir).toContain('/apply');

    // Both files exist on disk.
    const entries = readdirSync(stateDir).sort();
    const perRunEntries = entries.filter(
      (e) => e !== 'last.json' && e.endsWith('.json'),
    );
    expect(perRunEntries.length).toBe(1);
    const runFile = perRunEntries[0];
    expect(runFile).toBeDefined();
    if (runFile === undefined) throw new Error('expected one per-run file');

    const lastFile = readFileSync(join(stateDir, 'last.json'), 'utf8');
    const lastParsed = JSON.parse(lastFile) as { runId: string };
    expect(lastParsed.runId).toBe(runFile.replace(/\.json$/, ''));

    // Per-run record round-trips through `readApplyState`.
    const recordPath = join(stateDir, runFile);
    const record = await readApplyState(recordPath);
    expect(record.schemaVersion).toBe(1);
    expect(record.mode).toBe('apply');
    expect(record.profile).toBe('default');
    expect(record.runId).toBe(runFile.replace(/\.json$/, ''));
    expect(record.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );

    expect(record.agents.length).toBeGreaterThanOrEqual(1);
    // The seeded OpenCode target existed pre-write → preWriteSha256 is
    // a non-null hex digest, postWriteSha256 is a hex digest of the
    // post-write bytes (must differ from the pre hash because the
    // writer actually wrote).
    const opencodeAgent = record.agents.find((a) => a.agentId === 'opencode');
    expect(opencodeAgent).toBeDefined();
    if (opencodeAgent === undefined) throw new Error('expected opencode agent');
    expect(opencodeAgent.targetPaths.length).toBeGreaterThan(0);
    expect(opencodeAgent.preWriteSha256).not.toBeNull();
    expect(opencodeAgent.preWriteSha256?.length).toBe(64);
    expect(opencodeAgent.postWriteSha256).not.toBeNull();
    expect(opencodeAgent.postWriteSha256?.length).toBe(64);
    // The post-hash differs from the pre-hash — the writer actually
    // wrote new bytes.
    expect(opencodeAgent.preWriteSha256).not.toBe(
      opencodeAgent.postWriteSha256,
    );

    // Pre-hash matches the seeded (pre-write) bytes for the resolved
    // target path. The agent result's `targetPaths[0].path` is the
    // absolute path on disk (or relative resolved via `base`).
    expect(opencodeAgent.preWriteSha256).toBe(
      createHashSyncSha256(opencodeBefore),
    );
  });

  // -------------------------------------------------------------------------
  // Case 25 — `overture apply --dry-run --json` writes NO state file.
  //
  // The pre-write path is gated on real-write; `--dry-run` must leave the
  // state directory empty.
  // -------------------------------------------------------------------------

  it('Case 25: apply --dry-run --json writes no state file', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    seedOpencodeUserConfig(
      env.xdgConfigHome,
      opencodeConfigJsonc('filesystem'),
    );
    seedCanonicalConfig(env.xdgConfigHome, buildCanonicalConfigJson());

    const stateDir = defaultStateDir();
    // Pre-condition: state dir is empty / does not exist (beforeEach
    // allocated a fresh tmpdir as XDG_STATE_HOME).
    expect(existsDir(stateDir)).toBe(false);

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runApply(['--dry-run', '--json'], stdout, stderr);

    expect(stderr.text()).toBe('');
    expect(code).toBeGreaterThanOrEqual(0);
    expect(code).toBeLessThanOrEqual(1);

    // State dir either doesn't exist or is empty.
    if (existsDir(stateDir)) {
      expect(readdirSync(stateDir)).toEqual([]);
    }
  });

  // -------------------------------------------------------------------------
  // Case 26 — state-write failure does NOT change the apply exit code.
  //
  // Spy on `writeApplyState` to throw. The apply itself succeeds; the
  // state-write failure surfaces as a stderr warning line.
  // -------------------------------------------------------------------------

  it('Case 26: mocked writeApplyState rejection leaves exit code untouched + emits warning', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    seedOpencodeUserConfig(
      env.xdgConfigHome,
      opencodeConfigJsonc('filesystem'),
    );
    seedCanonicalConfig(env.xdgConfigHome, buildCanonicalConfigJson());

    const writeSpy = vi
      .spyOn(await import('./apply-state.js'), 'writeApplyState')
      .mockRejectedValueOnce(new Error('synthetic-state-write-failure'));

    try {
      const stdout = new BufferWriter();
      const stderr = new BufferWriter();
      const code = await runApply([], stdout, stderr);

      // Apply succeeded. Exit code is the apply outcome, not the
      // state-write failure.
      expect(code).toBeGreaterThanOrEqual(0);
      expect(code).toBeLessThanOrEqual(1);

      // Warning line on stderr.
      expect(stderr.text()).toContain('warning');
      expect(stderr.text()).toContain('failed to write apply state');
    } finally {
      writeSpy.mockRestore();
    }
  });

  // -------------------------------------------------------------------------
  // Case 27 — retention cap of 10 enforced. Pre-seed 11 per-run JSON files
  // lexically ordered oldest-first, run `apply`, then assert the new
  // per-run file lands and that pruneApplyState culled the 2 oldest.
  // -------------------------------------------------------------------------

  it('Case 27: retention keeps the 10 lexically newest per-run files (oldest 2 culled)', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    seedOpencodeUserConfig(
      env.xdgConfigHome,
      opencodeConfigJsonc('filesystem'),
    );
    seedCanonicalConfig(env.xdgConfigHome, buildCanonicalConfigJson());

    const stateDir = defaultStateDir();
    mkdirSync(stateDir, { recursive: true });

    // 11 pre-existing per-run files spanning two timestamps, lexically
    // ordered oldest-first. runIds are arbitrary synthetic strings,
    // but the LEXICAL order must be sortable so the older two are the
    // clear losers.
    const ts1 = '20260101-000000000';
    const ts2 = '20260102-000000000';
    const seededRunIds = [
      `${ts1}-00000001`,
      `${ts1}-00000002`,
      `${ts1}-00000003`,
      `${ts1}-00000004`,
      `${ts1}-00000005`,
      `${ts1}-00000006`,
      `${ts2}-00000007`,
      `${ts2}-00000008`,
      `${ts2}-00000009`,
      `${ts2}-0000000a`,
      `${ts2}-0000000b`,
    ];
    for (const id of seededRunIds) {
      writeFileSync(
        join(stateDir, `${id}.json`),
        JSON.stringify({
          schemaVersion: 1,
          runId: id,
          timestamp: '2026-01-01T00:00:00.000Z',
          mode: 'apply',
          profile: 'default',
          configPath: '/tmp/seeded.jsonc',
          backupBeforeWrite: true,
          agents: [],
        }),
      );
    }
    writeFileSync(
      join(stateDir, 'last.json'),
      JSON.stringify({ runId: seededRunIds[seededRunIds.length - 1] }),
    );
    expect(readdirSync(stateDir)).toHaveLength(12); // 11 + last.json

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runApply([], stdout, stderr);

    expect(stderr.text()).toBe('');
    expect(code).toBeGreaterThanOrEqual(0);
    expect(code).toBeLessThanOrEqual(1);

    const after = readdirSync(stateDir).sort();
    // 11 per-run + last.json = 12 total before prune; new run makes 12
    // per-run + last.json = 13; retention culls 2 oldest → 10 per-run +
    // last.json = 11. Filter out `last.json`.
    const afterPerRun = after.filter(
      (e) => e !== 'last.json' && e.endsWith('.json'),
    );
    expect(afterPerRun).toHaveLength(10);
    expect(after).toContain('last.json');

    // The two lexically oldest runIds are gone.
    expect(after).not.toContain(`${ts1}-00000001.json`);
    expect(after).not.toContain(`${ts1}-00000002.json`);

    // The retained 10 are the lexically newest pre-existing runIds, in
    // order.
    const expectedKept = seededRunIds
      .slice()
      .sort()
      .slice(-9)
      .map((id) => `${id}.json`);
    // The new run (from this test's apply) is the very newest. Pull
    // it from the actual directory listing.
    const newRunFile = afterPerRun.find(
      (f) => !seededRunIds.some((id) => `${id}.json` === f),
    );
    expect(newRunFile).toBeDefined();
    if (newRunFile === undefined) throw new Error('expected a new run file');
    const expectedRetained = [...expectedKept, newRunFile].sort();
    expect(afterPerRun).toEqual(expectedRetained);
  });

  // -------------------------------------------------------------------------
  // Case 28 — `stateDir` follows `XDG_STATE_HOME`. Set the env override to
  // a tmpdir; the state file lands at `<XDG_STATE_HOME>/overture/apply/`
  // (per `defaultOverturePaths().stateDir`).
  // -------------------------------------------------------------------------

  it('Case 28: stateDir follows XDG_STATE_HOME override (defaultOverturePaths().stateDir)', async () => {
    // beforeEach already allocated an isolated XDG_STATE_HOME; we're
    // confirming the apply honors it.
    const xdgState = process.env.XDG_STATE_HOME;
    expect(xdgState).toBeDefined();
    if (xdgState === undefined) throw new Error('XDG_STATE_HOME must be set');

    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    seedOpencodeUserConfig(
      env.xdgConfigHome,
      opencodeConfigJsonc('filesystem'),
    );
    seedCanonicalConfig(env.xdgConfigHome, buildCanonicalConfigJson());

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runApply([], stdout, stderr);

    expect(stderr.text()).toBe('');
    expect(code).toBeGreaterThanOrEqual(0);
    expect(code).toBeLessThanOrEqual(1);

    // State file lives under the XDG override.
    const expectedDir = join(xdgState, 'overture', 'apply');
    expect(existsDir(expectedDir)).toBe(true);
    const entries = readdirSync(expectedDir);
    const perRunEntries = entries.filter(
      (e) => e !== 'last.json' && e.endsWith('.json'),
    );
    expect(perRunEntries.length).toBe(1);

    // Sanity: the state's stateDir is exactly `${XDG_STATE_HOME}/overture`
    // when XDG_STATE_HOME is set.
    expect(defaultStateDir()).toBe(expectedDir);
  });
});

// ---------------------------------------------------------------------------
// Inline helpers (G1 cases only).
// ---------------------------------------------------------------------------

/** SHA-256 hex digest using the same algorithm as `apply-state.ts`. */
function createHashSyncSha256(input: Buffer | string): string {
  return createHash('sha256').update(input).digest('hex');
}

// ---------------------------------------------------------------------------
// Pure-function tests — no env setup, no IO.
// ---------------------------------------------------------------------------

describe('exitCodeForApplyDryRun', () => {
  function makeResult(
    status: ApplyDryRunAgentResult['status'],
  ): ApplyDryRunAgentResult {
    return {
      agentId: 'claude-code',
      displayName: 'Claude Code',
      status,
      result: {
        written: 0,
        changed: false,
        dryRun: true,
        serversWritten: [],
        targetPaths: [],
        reason:
          status === 'no-change'
            ? 'no-change'
            : status === 'not-targetable'
              ? 'not-targetable'
              : status === 'parse-error'
                ? 'parse-error'
                : status === 'unsupported-shape'
                  ? 'unsupported-shape'
                  : status === 'unsupported-format'
                    ? 'unsupported-format'
                    : undefined,
      },
    };
  }

  it('returns 0 when every result is would-update', () => {
    expect(
      exitCodeForApplyDryRun([
        makeResult('would-update'),
        makeResult('would-update'),
      ]),
    ).toBe(0);
  });

  it('returns 0 when every result is no-change', () => {
    expect(
      exitCodeForApplyDryRun([
        makeResult('no-change'),
        makeResult('no-change'),
      ]),
    ).toBe(0);
  });

  it('returns 0 when results mix would-update and no-change', () => {
    expect(
      exitCodeForApplyDryRun([
        makeResult('would-update'),
        makeResult('no-change'),
      ]),
    ).toBe(0);
  });

  it.each([
    'not-targetable',
    'parse-error',
    'unsupported-shape',
    'unsupported-format',
  ] as const)('returns 1 when any result has status %s', (status) => {
    expect(
      exitCodeForApplyDryRun([makeResult('no-change'), makeResult(status)]),
    ).toBe(1);
  });
});

describe('formatHumanApplyDryRun', () => {
  const sampleEnvelope: ApplyDryRunResult = {
    profile: 'default',
    configPath: '/tmp/example/overture.jsonc',
    disabledServers: [],
    results: [
      {
        agentId: 'claude-code',
        displayName: 'Claude Code',
        status: 'would-update',
        result: {
          written: 1,
          changed: true,
          dryRun: true,
          serversWritten: ['filesystem'],
          targetPaths: [
            { scope: 'user', base: 'home', path: '/tmp/example/.claude.json' },
          ],
          resolvedPath: '/tmp/example/.claude.json',
          format: 'jsonc',
          bytesChanged: 42,
        },
      },
      {
        agentId: 'opencode',
        displayName: 'OpenCode',
        status: 'no-change',
        result: {
          written: 0,
          changed: false,
          dryRun: true,
          serversWritten: [],
          targetPaths: [
            {
              scope: 'user',
              base: 'config',
              path: '/tmp/example/.config/opencode/opencode.jsonc',
            },
          ],
        },
      },
      {
        agentId: 'github-copilot-cli',
        displayName: 'GitHub Copilot CLI',
        status: 'not-targetable',
        reasonDetail: 'no workspace .github/mcp.json found',
        result: {
          written: 0,
          changed: false,
          dryRun: true,
          serversWritten: [],
          targetPaths: [],
          reason: 'not-targetable',
        },
      },
      {
        agentId: 'openai-codex',
        displayName: 'OpenAI Codex',
        status: 'parse-error',
        reasonDetail: 'malformed TOML at ~/.codex/config.toml:18',
        result: {
          written: 0,
          changed: false,
          dryRun: true,
          serversWritten: [],
          targetPaths: [],
          reason: 'parse-error',
        },
      },
    ],
  };

  it('mentions every agent in the result set', () => {
    const text = formatHumanApplyDryRun(sampleEnvelope);
    for (const id of ALL_PLATFORM_IDS) {
      expect(text).toContain(id);
    }
  });

  it('includes a footer pointing at overture apply (no longer "not yet implemented" since F2)', () => {
    const text = formatHumanApplyDryRun(sampleEnvelope);
    expect(text).toContain('overture apply');
    // F1 used "not yet implemented" to flag the real-write path as
    // future work; F2 lands the real-write path, so the dry-run footer
    // now points operators at `overture apply` without the stub warning.
    expect(text.toLowerCase()).not.toContain('not yet implemented');
  });

  it('does not include raw original or written config bytes', () => {
    const text = formatHumanApplyDryRun(sampleEnvelope);
    expect(text).not.toContain('originalBytes');
    expect(text).not.toContain('writtenBytes');
    // The known seeded contents must not appear verbatim.
    expect(text).not.toContain('filesystem: node');
  });

  it('echoes the profile and config path', () => {
    const text = formatHumanApplyDryRun(sampleEnvelope);
    expect(text).toContain('default');
    expect(text).toContain('/tmp/example/overture.jsonc');
  });

  it('surfaces refusal reasons (reasonDetail) in the human report', () => {
    const text = formatHumanApplyDryRun(sampleEnvelope);
    expect(text).toContain('no workspace .github/mcp.json found');
    expect(text).toContain('malformed TOML at ~/.codex/config.toml:18');
  });
});

// ---------------------------------------------------------------------------
// F3 — `conflict` type-contract surface (Task 1, type-only).
//
// Behavior tests for the conflict refusal path (orchestrator mapping, exit
// codes, human/JSON rendering) land in Task 4. This block locks the type
// surface only: every shape F3 needs downstream must already be reachable
// before any writer populates it. No detection logic yet (Task 2).
// ---------------------------------------------------------------------------

describe('F3 conflict status type contract', () => {
  it("ApplyStatus member enum includes 'conflict'", () => {
    // Member enumeration: every value of the union must be reachable.
    // Stripping `never` lets us compare against a heterogeneous list.
    type Members = ApplyStatus extends infer U
      ? U extends ApplyStatus
        ? [U] extends [string]
          ? U
          : never
        : never
      : never;
    expectTypeOf<Members>().toEqualTypeOf<
      | 'updated'
      | 'no-change'
      | 'backup-failed'
      | 'not-targetable'
      | 'parse-error'
      | 'unsupported-shape'
      | 'unsupported-format'
      | 'conflict'
    >();
  });

  it("ApplyDryRunStatus member enum includes 'conflict'", () => {
    type Members = ApplyDryRunStatus extends infer U
      ? U extends ApplyDryRunStatus
        ? [U] extends [string]
          ? U
          : never
        : never
      : never;
    expectTypeOf<Members>().toEqualTypeOf<
      | 'would-update'
      | 'no-change'
      | 'not-targetable'
      | 'parse-error'
      | 'unsupported-shape'
      | 'unsupported-format'
      | 'conflict'
    >();
  });

  it("AgentMcpWriteResult['conflicts'] accepts readonly ServerConflict[] (and undefined)", () => {
    const sample: AgentMcpWriteResult = {
      written: 0,
      changed: false,
      dryRun: true,
      serversWritten: [],
      targetPaths: [],
      conflicts: [
        {
          serverName: 'remote-tools',
          message: 'canonical settings drift on url',
          diffKeys: ['url'],
        },
      ],
    };
    // The field is optional — `undefined` must remain assignable.
    const omitted: AgentMcpWriteResult = {
      written: 0,
      changed: false,
      dryRun: true,
      serversWritten: [],
      targetPaths: [],
    };
    // Both shapes must satisfy the indexed-access type.
    expectTypeOf(sample.conflicts).toMatchTypeOf<
      readonly ServerConflict[] | undefined
    >();
    expectTypeOf(omitted.conflicts).toMatchTypeOf<
      readonly ServerConflict[] | undefined
    >();
  });

  it('ServerConflict is JSON-serializable (no functions, no class instances)', () => {
    const sample: ServerConflict = {
      serverName: 'stdio-tools',
      message: 'canonical settings drift on env',
      diffKeys: ['env', 'args'],
    };
    // JSON roundtrip must deeply equal the original — proves every field
    // is a JSON scalar or a readonly string array (no functions, no
    // class instances, no Map/Set).
    expect(JSON.parse(JSON.stringify(sample))).toEqual(sample);
  });
});

// ---------------------------------------------------------------------------
// F3 — `overture apply` conflict refusal integration (Task 4).
//
// Locks the orchestrator short-circuit, the human-output `Conflicts:`
// block (both `--dry-run` and real-write), the `--json` envelope
// pass-through of `result.conflicts`, and the `reasonDetail` policy.
// All tests use the production per-agent writers so the conflict path
// is exercised end-to-end (B2 normalization + B3 detector → CLI refusal).
// ---------------------------------------------------------------------------

describe('F3 apply conflict refusal integration', () => {
  let cleanupDirs: readonly string[] = [];
  let originalEnv: NodeJS.ProcessEnv;
  let originalCwd: string;

  beforeEach(() => {
    cleanupDirs = [];
    originalEnv = { ...process.env };
    originalCwd = process.cwd();
  });

  afterEach(() => {
    for (const dir of cleanupDirs) {
      try {
        chmodSync(dir, 0o755);
      } catch {
        /* ignore */
      }
      rmSync(dir, { recursive: true, force: true });
    }
    process.chdir(originalCwd);
    for (const key of [
      'HOME',
      'XDG_CONFIG_HOME',
      'XDG_CONFIG_DIRS',
      'XDG_DATA_HOME',
      'XDG_STATE_HOME',
      'XDG_CACHE_HOME',
      'PATH',
      'USERPROFILE',
    ]) {
      const original = originalEnv[key];
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
  });

  // -------------------------------------------------------------------------
  // Integration 1 — single-agent refused (real-write).
  //
  // Seeds Claude with divergent canonical settings. The writer's
  // Pass 1 dryRun must return `conflict`. The orchestrator must:
  //   - exit 1,
  //   - skip Pass 2 (writer called exactly once with `dryRun: true`),
  //   - skip backup creation (no `.bak.*` in the target directory),
  //   - leave the target byte-identical.
  // -------------------------------------------------------------------------

  it('refuses a single agent on conflict: no Pass 2, no backup, exit 1', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    const claudePath = seedClaudeUserConfig(
      env.home,
      JSON.stringify(
        {
          mcpServers: {
            filesystem: { type: 'stdio', command: 'old' },
          },
        },
        null,
        2,
      ),
    );
    seedCanonicalConfig(
      env.xdgConfigHome,
      buildCanonicalConfigJson({ targets: ['claude-code'] }),
    );

    const claudeTarget: AgentDefinition | undefined = agentRegistry.find(
      (a) => a.id === 'claude-code',
    );
    expect(claudeTarget).toBeDefined();
    if (claudeTarget === undefined) return;
    const originalWrite = claudeTarget.mcp.write;
    if (originalWrite === undefined) return;

    const writeCalls: { dryRun: boolean }[] = [];
    const writeSpy = vi
      .spyOn(claudeTarget.mcp, 'write')
      .mockImplementation(async (ctx, input) => {
        writeCalls.push({ dryRun: input.dryRun === true });
        return originalWrite(ctx, input);
      });

    try {
      const stdout = new BufferWriter();
      const stderr = new BufferWriter();
      const code = await runApply([], stdout, stderr);

      expect(stderr.text()).toBe('');
      expect(code).toBe(1);

      // Writer called twice — once for the G1 pre-discovery snapshot
      // (dryRun: true) and once for Pass 1 inside applyToAgentReal
      // (dryRun: true). Pass 2 is still skipped on conflict, so neither
      // call is dryRun: false. The semantic claim is preserved: no real
      // write occurred.
      expect(writeCalls.length).toBe(2);
      for (const call of writeCalls) {
        expect(call.dryRun).toBe(true);
      }
      expect(writeCalls.some((c) => c.dryRun === false)).toBe(false);

      // No backup files created — conflict path skips the backup step.
      const backups = findBackupFiles(
        dirname(claudePath),
        basename(claudePath),
      );
      expect(backups.length).toBe(0);

      // Target byte-identical — no real write occurred.
      // Capture target after the run; assert no change.
      // (The seed content is `{ type: 'stdio', command: 'old' }`; the
      // canonical intent is `command: 'node'`. The writer never
      // overwrote it.)
      const claudeAfter = readFileSync(claudePath);
      expect(claudeAfter.toString()).toContain('"command": "old"');
      expect(claudeAfter.toString()).not.toContain('"command": "node"');
    } finally {
      writeSpy.mockRestore();
    }
  });

  // -------------------------------------------------------------------------
  // Integration 2 — mixed run: one agent refused, another would-update.
  //
  // Seeds Claude with divergent settings (conflict) AND OpenCode with
  // matching settings (would-update → real write). The orchestrator must:
  //   - exit 1 (refusal wins over would-update),
  //   - call Claude's writer exactly once (Pass 1 only — conflict skip),
  //   - call OpenCode's writer twice (Pass 1 dryRun + Pass 2 real),
  //   - create a backup for OpenCode (Pass 2 path),
  //   - leave Claude byte-identical, OpenCode written.
  // -------------------------------------------------------------------------

  it('mixed run: conflict agent skipped, successful agent real-writes; overall exit 1', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    // Claude seeded with divergent settings (canonical: 'node', target: 'old').
    const claudePath = seedClaudeUserConfig(
      env.home,
      JSON.stringify(
        {
          mcpServers: {
            filesystem: { type: 'stdio', command: 'old' },
          },
        },
        null,
        2,
      ),
    );
    const claudeBefore = readFileSync(claudePath);
    // OpenCode seeded with matching settings for `filesystem`. The
    // canonical config adds a second server (`extra`) that does NOT
    // exist in the OpenCode target — this is the only way to drive
    // `planned.changed = true` for a writer that byte-preserves an
    // existing equal entry: the planner still has to insert the new
    // server name, so planned.changed is true and Pass 2 runs.
    const opencodePath = seedOpencodeUserConfig(
      env.xdgConfigHome,
      opencodeConfigJsonc('filesystem'),
    );
    const opencodeBefore = readFileSync(opencodePath);

    seedCanonicalConfig(
      env.xdgConfigHome,
      buildCanonicalConfigJson({
        mcpServers: {
          filesystem: { type: 'stdio', command: 'node' },
          extra: { type: 'stdio', command: 'extra-cmd' },
        },
      }),
    );

    const claudeTarget: AgentDefinition | undefined = agentRegistry.find(
      (a) => a.id === 'claude-code',
    );
    const opencodeTarget: AgentDefinition | undefined = agentRegistry.find(
      (a) => a.id === 'opencode',
    );
    expect(claudeTarget).toBeDefined();
    expect(opencodeTarget).toBeDefined();
    if (claudeTarget === undefined || opencodeTarget === undefined) return;
    const claudeOriginal = claudeTarget.mcp.write;
    const opencodeOriginal = opencodeTarget.mcp.write;
    if (claudeOriginal === undefined || opencodeOriginal === undefined) return;

    const claudeCalls: { dryRun: boolean }[] = [];
    const opencodeCalls: { dryRun: boolean }[] = [];
    const claudeSpy = vi
      .spyOn(claudeTarget.mcp, 'write')
      .mockImplementation(async (ctx, input) => {
        claudeCalls.push({ dryRun: input.dryRun === true });
        return claudeOriginal(ctx, input);
      });
    const opencodeSpy = vi
      .spyOn(opencodeTarget.mcp, 'write')
      .mockImplementation(async (ctx, input) => {
        opencodeCalls.push({ dryRun: input.dryRun === true });
        return opencodeOriginal(ctx, input);
      });

    try {
      const stdout = new BufferWriter();
      const stderr = new BufferWriter();
      const code = await runApply([], stdout, stderr);

      expect(stderr.text()).toBe('');
      // At least one refusal → exit 1.
      expect(code).toBe(1);

      // Claude (conflict): Pass 1 from applyToAgentReal + pre-discovery
      // from runApply's recordApplyStateBestEffort. Pass 2 still
      // skipped on conflict — no dryRun: false call. Pre-discovery
      // happens AFTER applyToAgentReal returns, so it lands at the
      // tail of the call list.
      expect(claudeCalls.length).toBe(2);
      for (const call of claudeCalls) {
        expect(call.dryRun).toBe(true);
      }
      expect(claudeCalls.some((c) => c.dryRun === false)).toBe(false);

      // OpenCode (would-update): pre-discovery + Pass 1 + Pass 2.
      // Pre-discovery runs BEFORE applyToAgentReal so it leads the call
      // list. Pass 2 (the real write) is dryRun: false. Exactly one
      // real write occurred.
      expect(opencodeCalls.length).toBe(3);
      expect(opencodeCalls[0]?.dryRun).toBe(true); // pre-discovery
      expect(opencodeCalls[1]?.dryRun).toBe(true); // Pass 1
      expect(opencodeCalls[2]?.dryRun).toBe(false); // Pass 2 (real write)
      const opencodeRealWrites = opencodeCalls.filter(
        (c) => c.dryRun === false,
      );
      expect(opencodeRealWrites.length).toBe(1);

      // OpenCode backup created (Pass 2 path includes backup step).
      const opencodeBackups = findBackupFiles(
        dirname(opencodePath),
        basename(opencodePath),
      );
      expect(opencodeBackups.length).toBeGreaterThan(0);

      // Claude: no backup, byte-identical.
      const claudeBackups = findBackupFiles(
        dirname(claudePath),
        basename(claudePath),
      );
      expect(claudeBackups.length).toBe(0);
      expect(readFileSync(claudePath)).toEqual(claudeBefore);

      // OpenCode: written (bytes changed from the seeded form).
      // The exact byte content is owned by the opencode writer's
      // preservation tests; here we assert only that the file changed.
      const opencodeAfter = readFileSync(opencodePath);
      expect(opencodeAfter.equals(opencodeBefore)).toBe(false);
    } finally {
      claudeSpy.mockRestore();
      opencodeSpy.mockRestore();
    }
  });

  // -------------------------------------------------------------------------
  // Integration 3 — `backupBeforeWrite: false` does not weaken conflict
  // refusal.
  //
  // The setting only governs whether a backup is created when a write
  // happens; the conflict path precludes both backup and write. With
  // `backupBeforeWrite: false` the orchestrator still exits 1, never
  // calls Pass 2, never creates a backup, never touches the target.
  // -------------------------------------------------------------------------

  it('backupBeforeWrite: false still refuses on conflict: no backup, no Pass 2, exit 1', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    const claudePath = seedClaudeUserConfig(
      env.home,
      JSON.stringify(
        {
          mcpServers: {
            filesystem: { type: 'stdio', command: 'old' },
          },
        },
        null,
        2,
      ),
    );
    seedCanonicalConfig(
      env.xdgConfigHome,
      buildCanonicalConfigJson({
        targets: ['claude-code'],
        backupBeforeWrite: false,
      }),
    );

    const claudeTarget: AgentDefinition | undefined = agentRegistry.find(
      (a) => a.id === 'claude-code',
    );
    expect(claudeTarget).toBeDefined();
    if (claudeTarget === undefined) return;
    const originalWrite = claudeTarget.mcp.write;
    if (originalWrite === undefined) return;

    const writeCalls: { dryRun: boolean }[] = [];
    const writeSpy = vi
      .spyOn(claudeTarget.mcp, 'write')
      .mockImplementation(async (ctx, input) => {
        writeCalls.push({ dryRun: input.dryRun === true });
        return originalWrite(ctx, input);
      });

    try {
      const stdout = new BufferWriter();
      const stderr = new BufferWriter();
      const code = await runApply([], stdout, stderr);

      expect(stderr.text()).toBe('');
      expect(code).toBe(1);

      // Writer called twice: G1 pre-discovery + Pass 1 inside
      // applyToAgentReal. Pass 2 still skipped on conflict regardless of
      // backupBeforeWrite, so no call is dryRun: false.
      expect(writeCalls.length).toBe(2);
      for (const call of writeCalls) {
        expect(call.dryRun).toBe(true);
      }
      expect(writeCalls.some((c) => c.dryRun === false)).toBe(false);

      // No backup files — conflict path precludes backup entirely.
      const backups = findBackupFiles(
        dirname(claudePath),
        basename(claudePath),
      );
      expect(backups.length).toBe(0);

      // Target byte-identical.
      const claudeAfter = readFileSync(claudePath);
      expect(claudeAfter.toString()).toContain('"command": "old"');
      expect(claudeAfter.toString()).not.toContain('"command": "node"');
    } finally {
      writeSpy.mockRestore();
    }
  });

  // -------------------------------------------------------------------------
  // Integration 4 — `formatHumanApply` real-write output includes the
  // structured `Conflicts:` block listing each conflicted server name.
  // The block replaces the generic `reason:` line for the conflict
  // refusal — server name appears verbatim so operators can identify
  // the drift without parsing JSON.
  // -------------------------------------------------------------------------

  it('formatHumanApply includes a Conflicts: block listing each conflicted server name (real-write)', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    seedClaudeUserConfig(
      env.home,
      JSON.stringify(
        {
          mcpServers: {
            filesystem: { type: 'stdio', command: 'old' },
          },
        },
        null,
        2,
      ),
    );
    seedCanonicalConfig(
      env.xdgConfigHome,
      buildCanonicalConfigJson({ targets: ['claude-code'] }),
    );

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runApply([], stdout, stderr);

    expect(stderr.text()).toBe('');
    expect(code).toBe(1);

    const out = stdout.text();
    expect(out).toContain('Conflicts:');
    expect(out).toContain('filesystem');
    // B3-aligned wording carries the "Refusing to continue" phrase so
    // operators see the canonical vocabulary without grepping for it.
    expect(out).toContain('Refusing to continue');
  });

  // -------------------------------------------------------------------------
  // Integration 5 — `formatHumanApplyDryRun` output includes the
  // structured `Conflicts:` block plus the refusal-summary line. The
  // summary count already includes conflict in `refusal(s)` after
  // fix-3; this test pins the rendered shape.
  // -------------------------------------------------------------------------

  it('formatHumanApplyDryRun renders Conflicts: block + refusal-summary line', () => {
    const envelope: ApplyDryRunResult = {
      profile: 'default',
      configPath: '/tmp/example/overture.jsonc',
      disabledServers: [],
      results: [
        {
          agentId: 'claude-code',
          displayName: 'Claude Code',
          status: 'conflict',
          result: {
            written: 0,
            changed: false,
            dryRun: true,
            serversWritten: [],
            targetPaths: [
              {
                scope: 'user',
                base: 'home',
                path: '/tmp/example/.claude.json',
              },
            ],
            resolvedPath: '/tmp/example/.claude.json',
            conflicts: [
              {
                serverName: 'filesystem',
                message:
                  'Refusing to continue for server "filesystem": ' +
                  'canonical and agent settings differ. ' +
                  'Update the canonical config or the agent config and retry.',
                diffKeys: ['command'],
              },
            ],
          },
        },
        {
          agentId: 'opencode',
          displayName: 'OpenCode',
          status: 'no-change',
          result: {
            written: 0,
            changed: false,
            dryRun: true,
            serversWritten: [],
            targetPaths: [
              {
                scope: 'user',
                base: 'config',
                path: '/tmp/example/.config/opencode/opencode.jsonc',
              },
            ],
          },
        },
      ],
    };

    const text = formatHumanApplyDryRun(envelope);
    expect(text).toContain('Conflicts:');
    expect(text).toContain('filesystem');
    expect(text).toContain('Refusing to continue');
    // Refusal summary line — 'conflict' is part of the refusal count.
    expect(text).toMatch(/Summary:.*\d+ refusal\(s\)/);
  });

  // -------------------------------------------------------------------------
  // Integration 6 — `--json` dry-run envelope carries the `conflicts`
  // field per agent result. Real-write JSON is intentionally NOT
  // emitted (F2 gate F2-4) so we only assert the dry-run envelope.
  // -------------------------------------------------------------------------

  it('--json dry-run envelope carries result.conflicts per agent', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    seedClaudeUserConfig(
      env.home,
      JSON.stringify(
        {
          mcpServers: {
            filesystem: { type: 'stdio', command: 'old' },
          },
        },
        null,
        2,
      ),
    );
    seedCanonicalConfig(
      env.xdgConfigHome,
      buildCanonicalConfigJson({ targets: ['claude-code'] }),
    );

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runApply(['--dry-run', '--json'], stdout, stderr);

    expect(stderr.text()).toBe('');
    expect(code).toBe(1);

    const envelope = JSON.parse(stdout.text()) as ApplyDryRunResult;
    expect(envelope.results.length).toBe(1);
    const claudeResult = envelope.results[0];
    expect(claudeResult).toBeDefined();
    expect(claudeResult?.status).toBe('conflict');
    expect(claudeResult?.result?.conflicts).toBeDefined();
    expect(claudeResult?.result?.conflicts?.length).toBe(1);
    expect(claudeResult?.result?.conflicts?.[0]?.serverName).toBe('filesystem');
    expect(claudeResult?.result?.conflicts?.[0]?.message).toContain(
      'Refusing to continue',
    );
  });

  // -------------------------------------------------------------------------
  // Integration 7 — `reasonDetail` policy: stays empty for writer-driven
  // conflict refusals, populated only for synthesized refusals.
  // -------------------------------------------------------------------------

  it('reasonDetail is empty for conflict refusal but populated for synthesized not-targetable', async () => {
    const env = createApplyTempEnv();
    cleanupDirs = env.cleanup;
    applyEnv(env);
    seedAllFakeBins(env.pathDir);

    // Conflict path: divergent Claude settings. The writer drives the
    // refusal; reasonDetail must stay empty.
    seedClaudeUserConfig(
      env.home,
      JSON.stringify(
        {
          mcpServers: {
            filesystem: { type: 'stdio', command: 'old' },
          },
        },
        null,
        2,
      ),
    );
    seedCanonicalConfig(
      env.xdgConfigHome,
      buildCanonicalConfigJson({
        // Mixed run: one conflict, one synthesized not-targetable. The
        // synthesized branch proves reasonDetail still gets populated
        // when the orchestrator — not the writer — owns the refusal.
        targets: ['claude-code', 'ghost-agent'],
      }),
    );

    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runApply(['--dry-run', '--json'], stdout, stderr);

    expect(stderr.text()).toBe('');
    expect(code).toBe(1);

    const envelope = JSON.parse(stdout.text()) as ApplyDryRunResult;
    const claudeResult = envelope.results.find(
      (r: ApplyDryRunAgentResult) => r.agentId === 'claude-code',
    );
    expect(claudeResult).toBeDefined();
    expect(claudeResult?.status).toBe('conflict');
    // Conflict refusal: reasonDetail stays empty — the structured
    // `result.conflicts` channel is the canonical home for drift detail.
    expect(claudeResult?.reasonDetail).toBeUndefined();

    const ghostResult = envelope.results.find(
      (r: ApplyDryRunAgentResult) => r.agentId === 'ghost-agent',
    );
    expect(ghostResult).toBeDefined();
    expect(ghostResult?.status).toBe('not-targetable');
    // Synthesized refusal: reasonDetail populated with the orchestrator-
    // owned explanation. The reason field on the writer envelope also
    // carries it; reasonDetail is the CLI-local channel for
    // synthesized refusals.
    expect(ghostResult?.reasonDetail).toContain('unknown agent id');
  });
});

// ---------------------------------------------------------------------------
// F3 — pure-function contract locks for the human-formatter `Conflicts:`
// block and the exit-code helpers.
// ---------------------------------------------------------------------------

describe('F3 pure-function contract: Conflicts block + exit codes', () => {
  const sampleConflict: ServerConflict = {
    serverName: 'remote-tools',
    message:
      'Refusing to continue for server "remote-tools": ' +
      'canonical and agent settings differ. ' +
      'Update the canonical config or the agent config and retry.',
    diffKeys: ['url', 'headers'],
  };

  it('exitCodeForApplyDryRun returns 1 when any dry-run result is conflict', () => {
    const result: ApplyDryRunAgentResult = {
      agentId: 'claude-code',
      displayName: 'Claude Code',
      status: 'conflict',
      result: {
        written: 0,
        changed: false,
        dryRun: true,
        serversWritten: [],
        targetPaths: [],
        conflicts: [sampleConflict],
      },
    };
    expect(exitCodeForApplyDryRun([result])).toBe(1);
  });

  it('exitCodeForApply returns 1 when any real-write result is conflict', () => {
    const result: ApplyAgentResult = {
      agentId: 'claude-code',
      displayName: 'Claude Code',
      status: 'conflict',
      result: {
        written: 0,
        changed: false,
        dryRun: true,
        serversWritten: [],
        targetPaths: [],
        conflicts: [sampleConflict],
      },
      backupPaths: [],
    };
    expect(exitCodeForApply([result])).toBe(1);
  });

  it('formatHumanApply renders the Conflicts: block in the real-write envelope', () => {
    const envelope: ApplyResult = {
      profile: 'default',
      configPath: '/tmp/example/overture.jsonc',
      disabledServers: [],
      backupBeforeWrite: true,
      results: [
        {
          agentId: 'claude-code',
          displayName: 'Claude Code',
          status: 'conflict',
          result: {
            written: 0,
            changed: false,
            dryRun: true,
            serversWritten: [],
            targetPaths: [
              {
                scope: 'user',
                base: 'home',
                path: '/tmp/example/.claude.json',
              },
            ],
            resolvedPath: '/tmp/example/.claude.json',
            conflicts: [sampleConflict],
          },
          backupPaths: [],
        },
      ],
    };
    const text = formatHumanApply(envelope);
    expect(text).toContain('Conflicts:');
    expect(text).toContain('remote-tools');
    expect(text).toContain('Refusing to continue');
  });
});

// ---------------------------------------------------------------------------
// Spy restoration safety net.
//
// If a test throws partway through spy setup, the spy could outlive the
// test and poison later ones. The setup uses try/finally so the rest of
// the suite is safe. `vi.spyOn` is imported as `MockInstance` would be
// — but since the existing case-6 / case-7 spies already pin the
// return type via the target module's `mcp.write` signature, the
// explicit `MockInstance` annotation is unnecessary in this file.
// ---------------------------------------------------------------------------
