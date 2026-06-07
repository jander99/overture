import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdir,
  mkdtemp,
  writeFile,
  symlink,
  chmod,
  unlink,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectPlatforms, defaultPathResolutionContext } from './detect.js';
import { platformRegistry } from './registry.js';
import type { PathResolutionContext } from './types.js';

function makeCtx(
  overrides?: Partial<PathResolutionContext>,
): PathResolutionContext {
  return {
    homeDir: '/home/testuser',
    configDir: '/home/testuser/.config',
    workspaceDir: '/workspace',
    platform: 'linux',
    ...overrides,
  };
}

describe('detectPlatforms', () => {
  let tempHomeDir: string;
  let tempConfigDir: string;
  let tempWorkspaceDir: string;

  beforeEach(async () => {
    tempHomeDir = await mkdtemp(join(tmpdir(), 'overture-home-'));
    tempConfigDir = await mkdtemp(join(tmpdir(), 'overture-config-'));
    tempWorkspaceDir = await mkdtemp(join(tmpdir(), 'overture-workspace-'));
  });

  afterEach(async () => {
    await rm(tempHomeDir, { recursive: true, force: true });
    await rm(tempConfigDir, { recursive: true, force: true });
    await rm(tempWorkspaceDir, { recursive: true, force: true });
  });

  it('happy path: detects cursor when both home and workspace markers exist', async () => {
    const cursorHomeDir = join(tempHomeDir, '.cursor');
    await mkdir(cursorHomeDir, { recursive: true });
    await writeFile(join(cursorHomeDir, 'mcp.json'), '{}');

    const cursorWorkspaceDir = join(tempWorkspaceDir, '.cursor');
    await mkdir(cursorWorkspaceDir, { recursive: true });
    await writeFile(join(cursorWorkspaceDir, 'mcp.json'), '{}');

    const ctx = makeCtx({
      homeDir: tempHomeDir,
      configDir: tempConfigDir,
      workspaceDir: tempWorkspaceDir,
    });

    const result = await detectPlatforms(ctx);
    const cursorResult = result.platforms.find((p) => p.id === 'cursor');

    expect(cursorResult).toBeDefined();
    expect(cursorResult!.installed).toBe(true);
    expect(cursorResult!.confidence).toBe('high');
    expect(cursorResult!.matchedMarkers).toHaveLength(2);
    expect(cursorResult!.matchedMarkers).toContain(
      join(tempHomeDir, '.cursor', 'mcp.json'),
    );
    expect(cursorResult!.matchedMarkers).toContain(
      join(tempWorkspaceDir, '.cursor', 'mcp.json'),
    );
    expect(cursorResult!.reason).toBe('User-global Cursor MCP configuration');
  });

  it('no markers: every platform reports installed false', async () => {
    const ctx = makeCtx({
      homeDir: tempHomeDir,
      configDir: tempConfigDir,
      workspaceDir: tempWorkspaceDir,
    });

    const result = await detectPlatforms(ctx);

    for (const platform of result.platforms) {
      expect(platform.installed).toBe(false);
    }
  });

  it('all entries returned: platforms array has 14 entries in registry order', async () => {
    const ctx = makeCtx({
      homeDir: tempHomeDir,
      configDir: tempConfigDir,
      workspaceDir: tempWorkspaceDir,
    });

    const result = await detectPlatforms(ctx);

    expect(result.platforms).toHaveLength(14);
    const expectedIds = platformRegistry.map((entry) => entry.id);
    const actualIds = result.platforms.map((p) => p.id);
    expect(actualIds).toEqual(expectedIds);
  });

  it('unsupported platform no markers: github-copilot-cloud-agent and aider', async () => {
    const ctx = makeCtx({
      homeDir: tempHomeDir,
      configDir: tempConfigDir,
      workspaceDir: tempWorkspaceDir,
    });

    const result = await detectPlatforms(ctx);

    const cloudAgent = result.platforms.find(
      (p) => p.id === 'github-copilot-cloud-agent',
    );
    expect(cloudAgent).toBeDefined();
    expect(cloudAgent!.installed).toBe(false);
    expect(cloudAgent!.confidence).toBe('unsupported');
    expect(cloudAgent!.reason).toBe(
      'v1 filesystem-only detection cannot confirm GitHub Copilot cloud agent presence; it is repository/settings-based.',
    );

    const aider = result.platforms.find((p) => p.id === 'aider');
    expect(aider).toBeDefined();
    expect(aider!.installed).toBe(false);
    expect(aider!.confidence).toBe('unsupported');
    expect(aider!.reason).toBe(
      'aider detection in v1 is filesystem-only; a stable first-party MCP config surface is unconfirmed. Marker present (e.g., .aider.conf.yml) can be reported, but the registry must not claim install from PATH.',
    );
  });

  it('broken symlink: marker resolves to false', async () => {
    const targetPath = join(tempHomeDir, 'real-file');
    const linkPath = join(tempHomeDir, '.claude.json');
    await writeFile(targetPath, 'hello');
    await symlink(targetPath, linkPath);
    await unlink(targetPath);

    const ctx = makeCtx({
      homeDir: tempHomeDir,
      configDir: tempConfigDir,
      workspaceDir: tempWorkspaceDir,
    });

    const result = await detectPlatforms(ctx);
    const claudeCode = result.platforms.find((p) => p.id === 'claude-code');

    expect(claudeCode).toBeDefined();
    expect(claudeCode!.installed).toBe(false);
    expect(claudeCode!.matchedMarkers).toEqual([]);
  });

  it('EACCES: does not throw and returns well-formed results', async () => {
    if (process.getuid && process.getuid() === 0) {
      console.warn('Skipping permission-denied test because running as root');
      return;
    }

    const restrictedDir = join(tempHomeDir, 'restricted');
    await mkdir(restrictedDir);
    const filePath = join(restrictedDir, 'secret.txt');
    await writeFile(filePath, 'secret');
    await chmod(restrictedDir, 0o000);

    try {
      const ctx = makeCtx({
        homeDir: tempHomeDir,
        configDir: tempConfigDir,
        workspaceDir: tempWorkspaceDir,
      });

      const result = await detectPlatforms(ctx);

      expect(result.platforms).toHaveLength(14);
      for (const platform of result.platforms) {
        expect(platform).toHaveProperty('id');
        expect(platform).toHaveProperty('installed');
        expect(platform).toHaveProperty('confidence');
        expect(platform).toHaveProperty('matchedMarkers');
        expect(platform).toHaveProperty('installMarkers');
        expect(platform).toHaveProperty('mcpLocations');
      }
    } finally {
      await chmod(restrictedDir, 0o755);
    }
  });
});

describe('defaultPathResolutionContext', () => {
  it('derives context from os.homedir, XDG_CONFIG_HOME, process.cwd, and process.platform', () => {
    const ctx = defaultPathResolutionContext();

    expect(typeof ctx.homeDir).toBe('string');
    expect(typeof ctx.configDir).toBe('string');
    expect(typeof ctx.workspaceDir).toBe('string');
    expect(['linux', 'darwin', 'win32']).toContain(ctx.platform);
    expect(['linux', 'darwin', 'win32']).toContain(ctx.platform);
  });
});
