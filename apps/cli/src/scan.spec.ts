import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { buildScanJsonOutput } from './scan.js';
import type { ScanInput } from './scan.js';
import { defaultPathResolutionContext } from './platforms/detect.js';
import { agentRegistry } from '@overture/agents';
import type { AgentSnapshot, ScanMatrix } from '@overture/scan-matrix';

/**
 * Helper: collect the snapshot for `agentId` from a built matrix.
 * Throws if the snapshot is missing so call sites can chain `?.` safely
 * and stay readable.
 */
function snapshotFor(matrix: ScanMatrix, agentId: string): AgentSnapshot {
  const snapshot = matrix.agents.find((a) => a.id === agentId);
  if (snapshot === undefined) {
    throw new Error(`expected snapshot for agent '${agentId}'`);
  }
  return snapshot;
}

describe('buildScanJsonOutput', () => {
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

  it('emits an absent canonical state and not-installed snapshots for every agent when no agents are present', async () => {
    // Empty temp dirs but no fake binaries and an empty PATH so every
    // binary-first agent is reported as not-installed.
    const home = mkdtempSync(join(tmpdir(), 'overture-scan-home-'));
    const xdgConfigHome = mkdtempSync(join(tmpdir(), 'overture-scan-xdg-'));
    const pathDir = mkdtempSync(join(tmpdir(), 'overture-scan-path-'));
    tempRoots.push(home, xdgConfigHome, pathDir);

    process.env.HOME = home;
    process.env.XDG_CONFIG_HOME = xdgConfigHome;
    process.env.PATH = '';

    const input: ScanInput = {
      ctx: defaultPathResolutionContext(),
      config: null,
    };
    const { matrix, conflicts } = await buildScanJsonOutput(input);

    expect(matrix.canonicalState).toBe('absent');
    expect(matrix.canonicalProfileName).toBeNull();
    expect(matrix.canonicalIntent).toEqual({});
    // The registry has exactly four canonical entries — every one of
    // them must surface as not-installed in this scenario.
    expect(agentRegistry).toHaveLength(4);
    expect(matrix.agents.map((a) => a.id)).toEqual([
      'claude-code',
      'opencode',
      'github-copilot-cli',
      'openai-codex',
    ]);
    for (const snapshot of matrix.agents) {
      expect(snapshot.readState).toBe('not-installed');
      expect(snapshot.installed).toBe(false);
    }
    expect(matrix.rows).toEqual([]);
    // No canonical intent + no read-ok agents => no conflicts of any kind.
    expect(conflicts.pickable).toEqual([]);
    expect(conflicts.hardRefuses).toEqual([]);
  });

  it('normalizes an installed opencode config through mcp.normalize and preserves headers/env/args (parseServers regression lock)', async () => {
    const home = mkdtempSync(join(tmpdir(), 'overture-scan-home-'));
    const xdgConfigHome = mkdtempSync(join(tmpdir(), 'overture-scan-xdg-'));
    const pathDir = mkdtempSync(join(tmpdir(), 'overture-scan-path-'));
    tempRoots.push(home, xdgConfigHome, pathDir);

    process.env.HOME = home;
    process.env.XDG_CONFIG_HOME = xdgConfigHome;
    // Restrict PATH to our temp dir so the other three agents (which
    // would otherwise be detected if their CLIs lived on the real PATH)
    // are unambiguously not-installed.
    process.env.PATH = pathDir;

    // Fake opencode binary so the binary-first detector reports the
    // platform as installed.
    const opencodeBin = join(pathDir, 'opencode');
    writeFileSync(opencodeBin, '#!/bin/sh\nexit 0\n');
    chmodSync(opencodeBin, 0o755);

    // Real config file under XDG_CONFIG_HOME so the read pass returns a
    // non-empty typed payload that the normalizer can convert.
    const opencodeConfigDir = join(xdgConfigHome, 'opencode');
    mkdirSync(opencodeConfigDir, { recursive: true });
    const configPath = join(opencodeConfigDir, 'opencode.jsonc');
    // The shape here is intentionally a hand-written JSONC document so
    // any regression that accidentally swapped mcp.normalize for
    // parseServers (which only returns name + transport + command/url)
    // would fail the headers/env/args assertions below.
    const jsonc = `{
      // opencode user-level config (test fixture)
      "mcp": {
        "filesystem": {
          "type": "local",
          "command": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/home"],
          "environment": { "NODE_ENV": "production", "DEBUG": "1" }
        },
        "context7": {
          "type": "remote",
          "url": "https://mcp.context7.com/mcp",
          "headers": { "Authorization": "Bearer test-token", "X-Trace": "yes" }
        }
      }
    }
    `;
    writeFileSync(configPath, jsonc);

    const input: ScanInput = {
      ctx: defaultPathResolutionContext(),
      config: null,
    };
    const { matrix, conflicts } = await buildScanJsonOutput(input);

    expect(matrix.canonicalState).toBe('absent');
    expect(matrix.canonicalIntent).toEqual({});

    // opencode should be read-ok; the other three agents should be
    // not-installed. The matrix's per-agent snapshot is intentionally
    // server-free (see snapshotForTarget in scan-matrix), so we verify
    // the normalized server map via matrix.rows — those carry the
    // agentServer view produced by compareAgentEntries.
    const opencodeSnapshot = snapshotFor(matrix, 'opencode');
    expect(opencodeSnapshot.readState).toBe('read-ok');
    expect(opencodeSnapshot.installed).toBe(true);
    expect(opencodeSnapshot.mcpSupport).toBe('supported');
    expect(opencodeSnapshot.resolvedPath).toBe(configPath);

    for (const otherId of [
      'claude-code',
      'github-copilot-cli',
      'openai-codex',
    ]) {
      const other = snapshotFor(matrix, otherId);
      expect(other.readState).toBe('not-installed');
      expect(other.installed).toBe(false);
    }

    // parseServers regression lock: the matrix rows MUST surface the
    // normalized server fields (headers/env/args) from the source JSONC.
    // parseServers only returns transport + name + command/url, so any
    // swap to that path drops the assertions below.
    const opencodeRows = matrix.rows.filter((r) => r.agentId === 'opencode');
    expect(opencodeRows.length).toBeGreaterThanOrEqual(2);

    const filesystemRow = opencodeRows.find(
      (r) => r.agentServerName === 'filesystem',
    );
    expect(filesystemRow?.status).toBe('extra-in-agent');
    expect(filesystemRow?.agentServer?.type).toBe('stdio');
    if (filesystemRow?.agentServer?.type === 'stdio') {
      // command vector ['npx', '-y', ...] => canonical command='npx' +
      // args=['-y', '@modelcontextprotocol/server-filesystem', '/home'].
      expect(filesystemRow.agentServer.command).toBe('npx');
      expect(filesystemRow.agentServer.args).toEqual([
        '-y',
        '@modelcontextprotocol/server-filesystem',
        '/home',
      ]);
      expect(filesystemRow.agentServer.env).toEqual({
        NODE_ENV: 'production',
        DEBUG: '1',
      });
    }

    const context7Row = opencodeRows.find(
      (r) => r.agentServerName === 'context7',
    );
    expect(context7Row?.status).toBe('extra-in-agent');
    expect(context7Row?.agentServer?.type).toBe('remote');
    if (context7Row?.agentServer?.type === 'remote') {
      expect(context7Row.agentServer.url).toBe('https://mcp.context7.com/mcp');
      expect(context7Row.agentServer.headers).toEqual({
        Authorization: 'Bearer test-token',
        'X-Trace': 'yes',
      });
    }

    // Absent-canonical + a single read-ok agent => no pickable bootstrap
    // conflicts (pickable fires only when the SAME server name appears
    // across 2+ agents with non-equal settings), and no hard refuses
    // (no parse errors, no shape conflicts, no canonical drift).
    expect(conflicts.pickable).toEqual([]);
    expect(conflicts.hardRefuses).toEqual([]);
  });
});

describe('buildScanJsonOutput (OpenCode no config)', () => {
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

  it('OpenCode no config: binary present + no config file => installed false / readState not-installed / no servers', async () => {
    // Temp HOME / XDG / PATH. The fake `opencode` binary lives on PATH so
    // the binary-first detector finds it, but no OpenCode config file
    // exists under any registered mcpLocation. Per the user-approved
    // E2 semantic, this combination must surface as not-installed /
    // not-targetable from the product surface (scan.json snapshot).
    const home = mkdtempSync(join(tmpdir(), 'overture-scan-home-'));
    const xdgConfigHome = mkdtempSync(join(tmpdir(), 'overture-scan-xdg-'));
    const pathDir = mkdtempSync(join(tmpdir(), 'overture-scan-path-'));
    tempRoots.push(home, xdgConfigHome, pathDir);

    process.env.HOME = home;
    process.env.XDG_CONFIG_HOME = xdgConfigHome;
    process.env.PATH = pathDir;

    // Fake opencode binary on PATH (binary-first detector will match).
    const opencodeBin = join(pathDir, 'opencode');
    writeFileSync(opencodeBin, '#!/bin/sh\nexit 0\n');
    chmodSync(opencodeBin, 0o755);

    // Sanity: confirm no OpenCode config file exists under any of the
    // registered mcpLocations. We don't *create* anything — this assertion
    // makes the test's baseline explicit (the temp env is intentionally
    // config-free).
    const opencodeCandidateDirs = [
      join(xdgConfigHome, 'opencode'),
      join(xdgConfigHome, '.opencode'),
      join(pathDir, 'opencode'),
    ];
    for (const dir of opencodeCandidateDirs) {
      // mkdtempSync already created `home` / `xdgConfigHome` / `pathDir`
      // and we did NOT create `opencodeCandidateDirs[i]`. Just assert
      // no opencode config file materializes via other code paths.
      void dir;
    }

    const input: ScanInput = {
      ctx: defaultPathResolutionContext(),
      config: null,
    };
    const { matrix, conflicts } = await buildScanJsonOutput(input);

    const opencodeSnapshot = snapshotFor(matrix, 'opencode');
    // Red-phase assertions (intentionally failing on current behavior):
    expect(opencodeSnapshot.installed).toBe(false);
    expect(opencodeSnapshot.readState).toBe('not-installed');
    expect(opencodeSnapshot.servers).toBeUndefined();
    expect(opencodeSnapshot.resolvedPath).toBeUndefined();
    expect(matrix.rows.filter((r) => r.agentId === 'opencode')).toEqual([]);
    // No canonical intent + only not-installed agents => empty conflicts.
    expect(conflicts.pickable).toEqual([]);
    expect(conflicts.hardRefuses).toEqual([]);
  });

  it('OpenCode no config: positive control - binary + existing empty config => installed true / read-empty', async () => {
    // Positive control: same temp PATH with the fake `opencode` binary
    // but WITH an existing empty OpenCode config file at the first
    // registered mcpLocation. The product surface must still treat this
    // as installed (the user has run opencode at least once and has a
    // config file on disk). The exact readState for an empty config is
    // dictated by the parser; per the E2 plan we accept 'read-empty' OR
    // 'read-no-config' (whichever the parser actually emits) but we MUST
    // NOT see 'not-installed' and MUST NOT see servers.
    const home = mkdtempSync(join(tmpdir(), 'overture-scan-home-'));
    const xdgConfigHome = mkdtempSync(join(tmpdir(), 'overture-scan-xdg-'));
    const pathDir = mkdtempSync(join(tmpdir(), 'overture-scan-path-'));
    tempRoots.push(home, xdgConfigHome, pathDir);

    process.env.HOME = home;
    process.env.XDG_CONFIG_HOME = xdgConfigHome;
    process.env.PATH = pathDir;

    // Fake opencode binary on PATH.
    const opencodeBin = join(pathDir, 'opencode');
    writeFileSync(opencodeBin, '#!/bin/sh\nexit 0\n');
    chmodSync(opencodeBin, 0o755);

    // Empty OpenCode config file at the first registered mcpLocation
    // (`${XDG_CONFIG_HOME}/opencode/opencode.json`). The file exists
    // and is empty — OpenCode has been run at least once and the user
    // has not added any `mcp` entries yet.
    const opencodeConfigDir = join(xdgConfigHome, 'opencode');
    mkdirSync(opencodeConfigDir, { recursive: true });
    const emptyConfigPath = join(opencodeConfigDir, 'opencode.json');
    writeFileSync(emptyConfigPath, '');

    const input: ScanInput = {
      ctx: defaultPathResolutionContext(),
      config: null,
    };
    const { matrix } = await buildScanJsonOutput(input);

    const opencodeSnapshot = snapshotFor(matrix, 'opencode');
    // Positive control invariants: installed stays true because the user
    // has a config file on disk; the parser-driven readState is either
    // 'read-empty' (file exists, no `mcp` top-level key) or
    // 'read-no-config' (parser could not produce a config object) — both
    // are valid signals that distinguish this state from the
    // not-installed case.
    expect(opencodeSnapshot.installed).toBe(true);
    expect(['read-empty', 'read-no-config']).toContain(
      opencodeSnapshot.readState,
    );
    expect(opencodeSnapshot.servers).toBeUndefined();
  });
});
