/**
 * F1 — `overture apply --dry-run` test suite.
 *
 * Locks the F1 contract: gate-5 types (`ApplyDryRunResult`,
 * `RunApplyOptions`), the args/exit-code plumbing (`runApply`,
 * `exitCodeForApplyDryRun`), the human renderer (`formatHumanApplyDryRun`),
 * and the orchestration that wires the canonical config to per-agent
 * writers via `mcp.write({ ..., dryRun: true })`.
 *
 * Style mirrors `apps/cli/src/bootstrap-command.spec.ts`: real tmpdirs
 * for filesystem isolation, `BufferWriter` from
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
 *   12. `apply --json` without `--dry-run` → exit 2 (invalid combo).
 *   13. regression: Claude dry-run with a planned update (seeded file
 *       content differs from canonical) classifies as `would-update`,
 *       not `no-change`. Different writers encode the dry-run "would
 *       have written" signal differently (OpenCode / OpenAI Codex set
 *       `changed: true`; Claude / GitHub Copilot CLI leave `changed:
 *       false` and surface `serversWritten` / `bytesChanged` instead);
 *       `statusFromWriterResult` must accept both conventions.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  chmodSync,
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
import { agentRegistry } from '@overture/agents';
import type { AgentDefinition, PlatformId } from '@overture/agents';

import {
  APPLY_USAGE,
  exitCodeForApplyDryRun,
  formatHumanApplyDryRun,
  runApply,
  type ApplyDryRunAgentResult,
  type ApplyDryRunResult,
  type RunApplyOptions,
} from './apply-command.js';
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

// ---------------------------------------------------------------------------
// Canonical config fixture builders.
// ---------------------------------------------------------------------------

interface CanonicalConfigOptions {
  readonly defaultProfileName?: string;
  readonly profileName?: string;
  readonly mcpServers?: Readonly<Record<string, unknown>>;
  readonly targets?: readonly string[];
  readonly disabledServers?: readonly string[];
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
  // F1 only consumes `settings.defaultProfile`. The other Settings fields
  // are valid schema members but irrelevant to the apply preview; the spec
  // omits them so scope greps for F2/F3 keywords (backupBeforeWrite,
  // conflictPolicy) stay clean.
  const settings: Record<string, unknown> = {
    defaultProfile: options.defaultProfileName ?? profileName,
    dryRunByDefault: true,
  };
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
  const p = join(dir, 'opencode.jsonc');
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
  // Case 11 + 12 — invalid flag combinations.
  //
  // These two cases must work even when there is no implementation
  // behind them, so the dispatcher contract is exercised first. They
  // live at the top so the failure mode is obvious in the run output.
  // -------------------------------------------------------------------------

  it('rejects `apply` without --dry-run with exit 2 + "not yet implemented"', async () => {
    const stdout = new BufferWriter();
    const stderr = new BufferWriter();
    const code = await runApply([], stdout, stderr);
    expect(code).toBe(2);
    expect(stderr.text().toLowerCase()).toContain('not yet implemented');
    expect(stdout.text()).toBe('');
  });

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

  it('classifies a Claude dry-run with a planned update as would-update (regression)', async () => {
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
    // Seeded file: same server name but a different `command`, so the
    // writer computes a hypothetical diff and surfaces it via
    // `serversWritten` / `bytesChanged` (with `changed: false`).
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
    // The planned update is clean (a would-update, not a refusal), so the
    // aggregate exit is 0.
    expect(code).toBe(0);

    const envelope = JSON.parse(stdout.text()) as ApplyDryRunResult;
    expect(envelope.results.length).toBe(1);
    const claudeResult = envelope.results[0];
    expect(claudeResult).toBeDefined();
    // The core regression assertion: differing content + Claude's
    // `changed: false` convention must still classify as `would-update`.
    expect(claudeResult?.status).toBe('would-update');
    const writer = claudeResult?.result;
    expect(writer.changed).toBe(false);
    expect(writer.dryRun).toBe(true);
    expect(writer.serversWritten).toEqual(['filesystem']);
    expect(typeof writer.bytesChanged).toBe('number');
    expect(writer.bytesChanged).toBeGreaterThan(0);
  });
});

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

  it('includes a "not yet implemented" advisory footer pointing at overture apply', () => {
    const text = formatHumanApplyDryRun(sampleEnvelope);
    expect(text.toLowerCase()).toContain('not yet implemented');
    expect(text).toContain('overture apply');
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
// Spy restoration safety net.
//
// If a test throws partway through spy setup, the spy could outlive the
// test and poison later ones. The setup uses try/finally so the rest of
// the suite is safe. `vi.spyOn` is imported as `MockInstance` would be
// — but since the existing case-6 / case-7 spies already pin the
// return type via the target module's `mcp.write` signature, the
// explicit `MockInstance` annotation is unnecessary in this file.
// ---------------------------------------------------------------------------
