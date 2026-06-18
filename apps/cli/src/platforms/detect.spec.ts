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
import { agentRegistry } from '@overture/agents';
import type { PathResolutionContext } from '@overture/agents';

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
  let originalPath: string | undefined;

  beforeEach(async () => {
    tempHomeDir = await mkdtemp(join(tmpdir(), 'overture-home-'));
    tempConfigDir = await mkdtemp(join(tmpdir(), 'overture-config-'));
    tempWorkspaceDir = await mkdtemp(join(tmpdir(), 'overture-workspace-'));
    originalPath = process.env.PATH;
    process.env.PATH = '';
  });

  afterEach(async () => {
    await rm(tempHomeDir, { recursive: true, force: true });
    await rm(tempConfigDir, { recursive: true, force: true });
    await rm(tempWorkspaceDir, { recursive: true, force: true });
    if (originalPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = originalPath;
    }
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

  it('all entries returned: platforms array has 4 entries in registry order', async () => {
    const ctx = makeCtx({
      homeDir: tempHomeDir,
      configDir: tempConfigDir,
      workspaceDir: tempWorkspaceDir,
    });

    const result = await detectPlatforms(ctx);

    expect(result.platforms).toHaveLength(4);
    const expectedIds = agentRegistry.map((entry) => entry.id);
    const actualIds = result.platforms.map((p) => p.id);
    expect(actualIds).toEqual(expectedIds);
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
    if (process.getuid?.() === 0) {
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

      expect(result.platforms).toHaveLength(4);
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

describe('PlatformDetectionResult schema (binary-first)', () => {
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

  it('every result has all additive fields present', async () => {
    const ctx = makeCtx({
      homeDir: tempHomeDir,
      configDir: tempConfigDir,
      workspaceDir: tempWorkspaceDir,
    });
    const result = await detectPlatforms(ctx);
    expect(result.platforms).toHaveLength(4);
    for (const p of result.platforms) {
      expect(p).toHaveProperty('detectionStrategy');
      expect(p).toHaveProperty('mcpSupport');
      expect(p).toHaveProperty('executableNames');
      expect(p).toHaveProperty('matchedExecutables');
      expect(p).toHaveProperty('mcpConfigured');
      expect(p).toHaveProperty('matchedMcpLocations');
      expect(p).toHaveProperty('orphanedMcpLocations');
    }
  });

  it('arrays are always arrays, never undefined', async () => {
    const ctx = makeCtx({
      homeDir: tempHomeDir,
      configDir: tempConfigDir,
      workspaceDir: tempWorkspaceDir,
    });
    const result = await detectPlatforms(ctx);
    for (const p of result.platforms) {
      expect(
        Array.isArray(p.matchedExecutables) &&
          Array.isArray(p.matchedMcpLocations) &&
          Array.isArray(p.orphanedMcpLocations),
      ).toBe(true);
    }
  });

  it('mcpConfigured is a boolean', async () => {
    const ctx = makeCtx({
      homeDir: tempHomeDir,
      configDir: tempConfigDir,
      workspaceDir: tempWorkspaceDir,
    });
    const result = await detectPlatforms(ctx);
    for (const p of result.platforms) {
      expect(typeof p.mcpConfigured).toBe('boolean');
    }
  });

  it('detectionStrategy is the closed union', async () => {
    const ctx = makeCtx({
      homeDir: tempHomeDir,
      configDir: tempConfigDir,
      workspaceDir: tempWorkspaceDir,
    });
    const result = await detectPlatforms(ctx);
    for (const p of result.platforms) {
      expect(['binary-first', 'marker-only']).toContain(p.detectionStrategy);
    }
  });

  it('mcpSupport is the closed union', async () => {
    const ctx = makeCtx({
      homeDir: tempHomeDir,
      configDir: tempConfigDir,
      workspaceDir: tempWorkspaceDir,
    });
    const result = await detectPlatforms(ctx);
    for (const p of result.platforms) {
      expect(['supported', 'unsupported', 'unknown']).toContain(p.mcpSupport);
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
