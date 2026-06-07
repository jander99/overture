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
import { resolveMarkerPath, markerExists } from './paths.js';
import type { InstallMarker, PathResolutionContext } from './types.js';

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

function makeMarker(overrides?: Partial<InstallMarker>): InstallMarker {
  return {
    id: 'test-marker',
    kind: 'file',
    base: 'home',
    relativePath: '.cursor/mcp.json',
    confidence: 'high',
    reason: 'Test marker',
    ...overrides,
  };
}

describe('resolveMarkerPath', () => {
  it('expands home base to homeDir + relativePath', () => {
    const marker = makeMarker({
      base: 'home',
      relativePath: '.cursor/mcp.json',
    });
    const ctx = makeCtx();
    expect(resolveMarkerPath(marker, ctx)).toBe(
      '/home/testuser/.cursor/mcp.json',
    );
  });

  it('expands config base to configDir + relativePath', () => {
    const marker = makeMarker({
      base: 'config',
      relativePath: 'Code/User/mcp.json',
    });
    const ctx = makeCtx();
    expect(resolveMarkerPath(marker, ctx)).toBe(
      '/home/testuser/.config/Code/User/mcp.json',
    );
  });

  it('expands workspace base to workspaceDir + relativePath', () => {
    const marker = makeMarker({ base: 'workspace', relativePath: '.mcp.json' });
    const ctx = makeCtx();
    expect(resolveMarkerPath(marker, ctx)).toBe('/workspace/.mcp.json');
  });

  it('returns absolute path verbatim', () => {
    const marker = makeMarker({
      base: 'absolute',
      relativePath: '/etc/codex/config.toml',
    });
    const ctx = makeCtx();
    expect(resolveMarkerPath(marker, ctx)).toBe('/etc/codex/config.toml');
  });
});

describe('markerExists', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'overture-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns true for an existing regular file with kind=file', async () => {
    const filePath = join(tempDir, 'marker.txt');
    await writeFile(filePath, 'hello');
    const marker = makeMarker({
      base: 'absolute',
      relativePath: filePath,
      kind: 'file',
    });
    const ctx = makeCtx();
    expect(await markerExists(marker, ctx)).toBe(true);
  });

  it('returns false when path is a directory but marker is kind=file', async () => {
    const dirPath = join(tempDir, 'marker-dir');
    await mkdir(dirPath);
    const marker = makeMarker({
      base: 'absolute',
      relativePath: dirPath,
      kind: 'file',
    });
    const ctx = makeCtx();
    expect(await markerExists(marker, ctx)).toBe(false);
  });

  it('returns true for a directory with kind=directory', async () => {
    const dirPath = join(tempDir, 'marker-dir');
    await mkdir(dirPath);
    const marker = makeMarker({
      base: 'absolute',
      relativePath: dirPath,
      kind: 'directory',
    });
    const ctx = makeCtx();
    expect(await markerExists(marker, ctx)).toBe(true);
  });

  it('returns true for either file or directory with kind=file-or-directory', async () => {
    const filePath = join(tempDir, 'marker-file');
    const dirPath = join(tempDir, 'marker-dir');
    await writeFile(filePath, 'hello');
    await mkdir(dirPath);

    const fileMarker = makeMarker({
      base: 'absolute',
      relativePath: filePath,
      kind: 'file-or-directory',
    });
    const dirMarker = makeMarker({
      base: 'absolute',
      relativePath: dirPath,
      kind: 'file-or-directory',
    });
    const ctx = makeCtx();

    expect(await markerExists(fileMarker, ctx)).toBe(true);
    expect(await markerExists(dirMarker, ctx)).toBe(true);
  });

  it('returns false for a missing path and does not throw', async () => {
    const missingPath = join(tempDir, 'does-not-exist');
    const marker = makeMarker({
      base: 'absolute',
      relativePath: missingPath,
      kind: 'file',
    });
    const ctx = makeCtx();
    expect(await markerExists(marker, ctx)).toBe(false);
  });

  it('returns false for a broken symlink', async () => {
    const targetPath = join(tempDir, 'real-file');
    const linkPath = join(tempDir, 'broken-link');
    await writeFile(targetPath, 'hello');
    await symlink(targetPath, linkPath);
    await unlink(targetPath);

    const marker = makeMarker({
      base: 'absolute',
      relativePath: linkPath,
      kind: 'file',
    });
    const ctx = makeCtx();
    expect(await markerExists(marker, ctx)).toBe(false);
  });

  it('returns false for permission-denied path (skipped if root)', async () => {
    if (process.getuid && process.getuid() === 0) {
      console.warn('Skipping permission-denied test because running as root');
      return;
    }

    const restrictedDir = join(tempDir, 'restricted');
    await mkdir(restrictedDir);
    const filePath = join(restrictedDir, 'secret.txt');
    await writeFile(filePath, 'secret');
    await chmod(restrictedDir, 0o000);

    try {
      const marker = makeMarker({
        base: 'absolute',
        relativePath: filePath,
        kind: 'file',
      });
      const ctx = makeCtx();
      expect(await markerExists(marker, ctx)).toBe(false);
    } finally {
      await chmod(restrictedDir, 0o755);
    }
  });
});
