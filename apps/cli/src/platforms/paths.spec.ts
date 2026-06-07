import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdir,
  mkdtemp,
  writeFile,
  symlink,
  chmod,
  unlink,
  rm,
  realpath,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  resolveMarkerPath,
  markerExists,
  findExecutablesInPath,
} from './paths.js';
import type {
  InstallMarker,
  PathResolutionContext,
  HostPlatform,
} from './types.js';

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

describe('findExecutablesInPath', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'overture-path-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns empty array for empty names', async () => {
    const result = await findExecutablesInPath([], {
      pathString: tempDir,
      platform: 'linux',
    });
    expect(result).toEqual([]);
  });

  it('returns empty array for empty pathString', async () => {
    const result = await findExecutablesInPath(['x'], {
      pathString: '',
      platform: 'linux',
    });
    expect(result).toEqual([]);
  });

  it('POSIX: matches executable file (mode 0o755)', async () => {
    const filePath = join(tempDir, 'x');
    await writeFile(filePath, 'binary');
    await chmod(filePath, 0o755);
    const result = await findExecutablesInPath(['x'], {
      pathString: tempDir,
      platform: 'linux',
    });
    expect(result).toEqual([
      { name: 'x', resolvedPath: filePath, source: 'path' },
    ]);
  });

  it('POSIX: skips non-executable file (mode 0o644)', async () => {
    const filePath = join(tempDir, 'x');
    await writeFile(filePath, 'binary');
    await chmod(filePath, 0o644);
    const result = await findExecutablesInPath(['x'], {
      pathString: tempDir,
      platform: 'linux',
    });
    expect(result).toEqual([]);
  });

  it('POSIX: skips directories named like the binary', async () => {
    const dirPath = join(tempDir, 'x');
    await mkdir(dirPath);
    await chmod(dirPath, 0o755);
    const result = await findExecutablesInPath(['x'], {
      pathString: tempDir,
      platform: 'linux',
    });
    expect(result).toEqual([]);
  });

  it('POSIX: matches symlink to executable via realpath', async () => {
    const realPath = join(tempDir, 'real');
    const linkPath = join(tempDir, 'link');
    await writeFile(realPath, 'binary');
    await chmod(realPath, 0o755);
    await symlink(realPath, linkPath);
    const expectedResolved = await realpath(realPath);
    const result = await findExecutablesInPath(['link'], {
      pathString: tempDir,
      platform: 'linux',
    });
    expect(result).toEqual([
      { name: 'link', resolvedPath: expectedResolved, source: 'path' },
    ]);
  });

  it('POSIX: does not match broken symlink', async () => {
    const linkPath = join(tempDir, 'link');
    await symlink(join(tempDir, 'does-not-exist'), linkPath);
    const result = await findExecutablesInPath(['link'], {
      pathString: tempDir,
      platform: 'linux',
    });
    expect(result).toEqual([]);
  });

  it('Windows: matches file with .EXE extension (case-insensitive)', async () => {
    const filePath = join(tempDir, 'x.EXE');
    await writeFile(filePath, 'binary');
    const result = await findExecutablesInPath(['x'], {
      pathString: tempDir,
      platform: 'win32',
    });
    expect(result).toEqual([
      { name: 'x', resolvedPath: filePath, source: 'windows' },
    ]);
  });

  it('Windows: matches file with .cmd when PATHEXT includes it', async () => {
    const filePath = join(tempDir, 'x.cmd');
    await writeFile(filePath, 'binary');
    const result = await findExecutablesInPath(['x'], {
      pathString: tempDir,
      platform: 'win32',
      pathext: '.CMD',
    });
    expect(result).toEqual([
      { name: 'x', resolvedPath: filePath, source: 'windows' },
    ]);
  });

  it('Windows: ignores extension not in PATHEXT', async () => {
    const filePath = join(tempDir, 'x.sh');
    await writeFile(filePath, 'binary');
    const result = await findExecutablesInPath(['x'], {
      pathString: tempDir,
      platform: 'win32',
    });
    expect(result).toEqual([]);
  });

  it('WSL: matches both tool and tool.exe when on wslWindowsPath', async () => {
    const linuxBin = join(tempDir, 'usr-bin', 'z');
    await mkdir(join(tempDir, 'usr-bin'), { recursive: true });
    await writeFile(linuxBin, 'linux');
    await chmod(linuxBin, 0o755);

    const windowsDir = await mkdtemp(join(tmpdir(), 'overture-wsl-'));
    const windowsExe = join(windowsDir, 'z.exe');
    await writeFile(windowsExe, 'windows');
    try {
      const result = await findExecutablesInPath(['z'], {
        pathString: join(tempDir, 'usr-bin'),
        platform: 'linux',
        wslWindowsPath: windowsDir,
      });
      const sources = result.map((m) => m.source).sort();
      expect(sources).toEqual(['path', 'wsl']);
      expect(result).toContainEqual({
        name: 'z',
        resolvedPath: linuxBin,
        source: 'path',
      });
      expect(result).toContainEqual({
        name: 'z',
        resolvedPath: windowsExe,
        source: 'wsl',
      });
    } finally {
      await rm(windowsDir, { recursive: true, force: true });
    }
  });
  it('Windows: skips directory named like the binary (e.g. tool.exe)', async () => {
    const dirPath = join(tempDir, 'tool.exe');
    await mkdir(dirPath);
    const result = await findExecutablesInPath(['tool'], {
      pathString: tempDir,
      platform: 'win32',
    });
    expect(result).toEqual([]);
  });

  it('does not throw on non-existent PATH entry', async () => {
    const filePath = join(tempDir, 'x');
    await writeFile(filePath, 'binary');
    await chmod(filePath, 0o755);
    const result = await findExecutablesInPath(['x'], {
      pathString: '/does/not/exist:' + tempDir,
      platform: 'linux',
    });
    expect(result).toEqual([
      { name: 'x', resolvedPath: filePath, source: 'path' },
    ]);
  });
});
