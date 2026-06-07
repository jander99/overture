import { readdir, realpath, stat } from 'node:fs/promises';
import type {
  HostPlatform,
  InstallMarker,
  MatchedExecutable,
  PathResolutionContext,
} from './types.js';

const DEFAULT_PATHEXT = '.COM;.EXE;.BAT;.CMD;.VBS;.JS;.WS;.MSC';
const SWALLOWED_CODES = new Set([
  'ENOENT',
  'EACCES',
  'EPERM',
  'ELOOP',
  'ENOTDIR',
]);

function isSwallowed(err: unknown): boolean {
  return (
    err instanceof Error &&
    'code' in err &&
    typeof err.code === 'string' &&
    SWALLOWED_CODES.has(err.code)
  );
}

export function resolveMarkerPath(
  marker: InstallMarker,
  ctx: PathResolutionContext,
): string {
  switch (marker.base) {
    case 'home':
      return `${ctx.homeDir}/${marker.relativePath}`;
    case 'config':
      return `${ctx.configDir}/${marker.relativePath}`;
    case 'workspace':
      return `${ctx.workspaceDir}/${marker.relativePath}`;
    case 'absolute':
      return marker.relativePath;
    default: {
      const _exhaustive: never = marker.base;
      throw new Error(`Unsupported path base: ${_exhaustive}`);
    }
  }
}

export async function markerExists(
  marker: InstallMarker,
  ctx: PathResolutionContext,
): Promise<boolean> {
  const resolved = resolveMarkerPath(marker, ctx);

  try {
    const s = await stat(resolved);

    switch (marker.kind) {
      case 'file':
        return s.isFile();
      case 'directory':
        return s.isDirectory();
      case 'file-or-directory':
        return s.isFile() || s.isDirectory();
      default: {
        const _exhaustive: never = marker.kind;
        throw new Error(`Unsupported marker kind: ${_exhaustive}`);
      }
    }
  } catch (err) {
    if (isSwallowed(err)) {
      return false;
    }
    throw err;
  }
}

export interface FindExecutablesOptions {
  pathString: string;
  platform: HostPlatform;
  pathext?: string;
  wslWindowsPath?: string;
}

function splitPath(pathString: string, platform: HostPlatform): string[] {
  const sep = platform === 'win32' ? ';' : ':';
  return pathString
    .split(sep)
    .map((d) => d.trim())
    .filter((d) => d.length > 0);
}

function parsePathext(pathext: string): string[] {
  return pathext
    .split(';')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

async function matchPosix(
  dir: string,
  name: string,
): Promise<MatchedExecutable | null> {
  const candidate = `${dir}/${name}`;
  try {
    const s = await stat(candidate);
    if (!s.isFile() || (s.mode & 0o111) === 0) {
      return null;
    }
    return {
      name,
      resolvedPath: await realpath(candidate),
      source: 'path',
    };
  } catch (err) {
    if (isSwallowed(err)) return null;
    throw err;
  }
}

async function matchWindows(
  dir: string,
  name: string,
  pathext: string,
): Promise<MatchedExecutable | null> {
  const lowerName = name.toLowerCase();
  const exts = parsePathext(pathext);
  if (exts.length === 0) return null;
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (err) {
    if (isSwallowed(err)) return null;
    throw err;
  }
  for (const entry of entries) {
    const lower = entry.toLowerCase();
    if (!lower.startsWith(lowerName)) continue;
    for (const ext of exts) {
      if (lower === `${lowerName}${ext}`) {
        const candidate = `${dir}/${entry}`;
        try {
          const s = await stat(candidate);
          if (!s.isFile()) break;
        } catch (err) {
          if (isSwallowed(err)) break;
          throw err;
        }
        return {
          name,
          resolvedPath: await realpath(candidate),
          source: 'windows',
        };
      }
    }
  }
  return null;
}

async function matchWsl(
  dir: string,
  name: string,
): Promise<MatchedExecutable | null> {
  const candidates = [`${dir}/${name}`, `${dir}/${name}.exe`];
  for (const candidate of candidates) {
    try {
      const s = await stat(candidate);
      if (s.isFile()) {
        return {
          name,
          resolvedPath: await realpath(candidate),
          source: 'wsl',
        };
      }
    } catch (err) {
      if (isSwallowed(err)) continue;
      throw err;
    }
  }
  return null;
}

const SOURCE_ORDER: Record<MatchedExecutable['source'], number> = {
  path: 0,
  wsl: 1,
  windows: 2,
};

function compareMatches(a: MatchedExecutable, b: MatchedExecutable): number {
  if (a.name < b.name) return -1;
  if (a.name > b.name) return 1;
  return SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
}

export async function findExecutablesInPath(
  names: readonly string[],
  options: FindExecutablesOptions,
): Promise<MatchedExecutable[]> {
  if (names.length === 0) return [];
  if (options.pathString.length === 0) return [];

  const dirs = splitPath(options.pathString, options.platform);
  const pathext = options.pathext ?? DEFAULT_PATHEXT;
  const matches: MatchedExecutable[] = [];

  for (const dir of dirs) {
    for (const name of names) {
      const m =
        options.platform === 'win32'
          ? await matchWindows(dir, name, pathext)
          : await matchPosix(dir, name);
      if (m !== null) {
        matches.push(m);
      }
    }
  }

  if (
    options.platform === 'linux' &&
    options.wslWindowsPath !== undefined &&
    options.wslWindowsPath.length > 0
  ) {
    const wslDirs = splitPath(options.wslWindowsPath, options.platform);
    for (const dir of wslDirs) {
      for (const name of names) {
        const m = await matchWsl(dir, name);
        if (m === null) continue;
        const duplicate = matches.some(
          (existing) =>
            existing.name === m.name &&
            existing.resolvedPath === m.resolvedPath,
        );
        if (!duplicate) {
          matches.push(m);
        }
      }
    }
  }

  matches.sort(compareMatches);
  return matches;
}
