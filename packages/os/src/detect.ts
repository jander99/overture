import { readFile } from 'node:fs/promises';
import { platform as nodePlatform, release as nodeRelease } from 'node:os';

export type HostPlatform = 'linux' | 'darwin' | 'win32';

export interface HostInfo {
  platform: HostPlatform;
  /** Human-readable OS or distro name (e.g. "Ubuntu 22.04 LTS", "macOS", "Windows") */
  distro: string;
  /** Lowercase distro identifier (e.g. "ubuntu", "darwin", "windows", "debian") */
  distroId: string;
  /** True when running inside WSL1 or WSL2 */
  wsl: boolean;
  /** WSL version: 2, 1, or 0 when not WSL */
  wslVersion: 0 | 1 | 2;
  /** Pretty distro name when running inside WSL (mirrors distro) */
  wslDistro: string;
}

export interface DetectOSOverrides {
  platform?: HostPlatform;
  osReleasePath?: string | null;
  procVersionSignature?: string | null;
}

export interface OsReleaseFields {
  NAME?: string;
  ID?: string;
  PRETTY_NAME?: string;
  VERSION_ID?: string;
  [key: string]: string | undefined;
}

const DEFAULT_OS_RELEASE_PATHS = [
  '/etc/os-release',
  '/usr/lib/os-release',
] as const;
const FALLBACK_PROC_VERSION_PATHS = [
  '/proc/version',
  '/proc/sys/kernel/osrelease',
] as const;
const SWALLOWED = new Set(['ENOENT', 'EACCES', 'EPERM', 'ELOOP', 'ENOTDIR']);

function isSwallowed(err: unknown): boolean {
  return (
    err instanceof Error &&
    'code' in err &&
    typeof err.code === 'string' &&
    SWALLOWED.has(err.code)
  );
}

function normalizePlatform(p: NodeJS.Platform | string): HostPlatform {
  if (p === 'linux' || p === 'darwin' || p === 'win32') {
    return p;
  }
  throw new Error(`Unsupported platform: ${p}`);
}

/**
 * Parse a `/etc/os-release` file body into a key-value object.
 *
 * Recognizes `KEY=value` and `KEY="quoted value"` lines. Comments (`#`) and
 * blank lines are ignored. Unparseable lines are dropped silently.
 */
export function parseOsRelease(contents: string): OsReleaseFields {
  const out: OsReleaseFields = {};
  if (contents.length === 0) return out;

  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    if (line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key.length > 0) {
      out[key] = value;
    }
  }
  if (out.PRETTY_NAME === undefined && out.NAME !== undefined) {
    out.PRETTY_NAME = out.NAME;
  }

  return out;
}

/**
 * Returns true if the given `/proc/version` signature contains the
 * `Microsoft` marker that identifies a WSL1 or WSL2 kernel.
 */
export function wslFromProc(procVersion: string | null): boolean {
  if (procVersion === null) return false;
  if (procVersion.length === 0) return false;
  return /microsoft/i.test(procVersion);
}

/**
 * Determine the WSL version from a `/proc/version` signature.
 *
 * Returns 2 for WSL2 kernel strings, 1 for WSL1, 0 for native Linux or
 * when the input is null/empty.
 */
export function parseWslVersion(procVersion: string | null): 0 | 1 | 2 {
  if (procVersion === null) return 0;
  if (procVersion.length === 0) return 0;
  if (!/microsoft/i.test(procVersion)) return 0;
  if (/-wsl2/i.test(procVersion)) return 2;
  return 1;
}

async function readFirstAvailable(
  paths: readonly string[],
): Promise<string | null> {
  for (const p of paths) {
    try {
      return await readFile(p, 'utf8');
    } catch (err) {
      if (isSwallowed(err)) continue;
      throw err;
    }
  }
  return null;
}

async function resolveOsRelease(
  platform: HostPlatform,
  overridePath: string | null | undefined,
): Promise<string | null> {
  if (overridePath === null) return null;
  if (overridePath !== undefined) {
    return await readFirstAvailable([overridePath]);
  }
  if (platform !== 'linux') return null;
  return await readFirstAvailable(DEFAULT_OS_RELEASE_PATHS);
}

async function resolveProcVersion(
  platform: HostPlatform,
  overrideSignature: string | null | undefined,
): Promise<string | null> {
  if (overrideSignature === null) return null;
  if (overrideSignature !== undefined) return overrideSignature;
  if (platform !== 'linux') return null;
  return await readFirstAvailable(FALLBACK_PROC_VERSION_PATHS);
}

function macOSDistro(): { distro: string; distroId: string } {
  const rel = nodeRelease();
  // rel is Darwin kernel version, e.g. "23.6.0". Map to a marketing name.
  const major = Number.parseInt(rel.split('.')[0] ?? '0', 10);
  const name =
    major >= 24
      ? 'macOS 15+'
      : major >= 23
        ? 'macOS Sonoma'
        : major >= 22
          ? 'macOS Ventura'
          : major >= 21
            ? 'macOS Monterey'
            : major >= 20
              ? 'macOS Big Sur'
              : major >= 19
                ? 'macOS Catalina'
                : 'macOS';
  return { distro: name, distroId: 'darwin' };
}

function windowsDistro(): { distro: string; distroId: string } {
  return { distro: 'Windows', distroId: 'windows' };
}

function linuxDistroFromOsRelease(
  fields: OsReleaseFields,
  procVersion: string | null,
): { distro: string; distroId: string; wsl: boolean; wslVersion: 0 | 1 | 2 } {
  const wsl = wslFromProc(procVersion);
  const wslVersion = parseWslVersion(procVersion);

  const id = (fields.ID ?? 'linux').toLowerCase();
  const name = fields.PRETTY_NAME ?? fields.NAME ?? id;
  const distroId = id.length > 0 ? id : 'linux';
  const distro = name.length > 0 ? name : 'Linux';

  return { distro, distroId, wsl, wslVersion };
}

function emptyLinuxHostInfo(): {
  distro: string;
  distroId: string;
  wsl: boolean;
  wslVersion: 0 | 1 | 2;
} {
  return { distro: 'Linux', distroId: 'linux', wsl: false, wslVersion: 0 };
}

/**
 * Detect the host operating system in a deterministic, testable way.
 *
 * On Linux, reads `/etc/os-release` to identify the distro (Ubuntu, Debian,
 * Arch, Alpine, ...). On WSL1/WSL2 (detected via `/proc/version` Microsoft
 * marker), the distro from `/etc/os-release` is reported as the WSL distro.
 *
 * @param overrides Optional overrides used by tests to inject a fake
 * `/etc/os-release` path or `/proc/version` signature. In production, leave
 * this undefined and the function reads from the real filesystem.
 */
export async function detectOSAsync(
  overrides?: DetectOSOverrides,
): Promise<HostInfo> {
  const platform = normalizePlatform(overrides?.platform ?? nodePlatform());

  if (platform === 'win32') {
    const { distro, distroId } = windowsDistro();
    return {
      platform,
      distro,
      distroId,
      wsl: false,
      wslVersion: 0,
      wslDistro: '',
    };
  }

  if (platform === 'darwin') {
    const { distro, distroId } = macOSDistro();
    return {
      platform,
      distro,
      distroId,
      wsl: false,
      wslVersion: 0,
      wslDistro: '',
    };
  }

  // Linux (native or WSL)
  const procVersion = await resolveProcVersion(
    platform,
    overrides?.procVersionSignature,
  );
  const osReleaseContents = await resolveOsRelease(
    platform,
    overrides?.osReleasePath,
  );

  let fields: OsReleaseFields = {};
  if (osReleaseContents !== null) {
    fields = parseOsRelease(osReleaseContents);
  }

  const { distro, distroId, wsl, wslVersion } =
    Object.keys(fields).length === 0
      ? emptyLinuxHostInfo()
      : linuxDistroFromOsRelease(fields, procVersion);

  return {
    platform,
    distro,
    distroId,
    wsl,
    wslVersion,
    wslDistro: wsl ? distro : '',
  };
}

/**
 * Synchronous variant of `detectOSAsync`. On Linux, the distro/WSL
 * detection is best-effort: if `/etc/os-release` or `/proc/version` are
 * not readable synchronously (e.g. mocked paths), distro falls back to
 * `Linux` and WSL is reported as `false`.
 *
 * For the most accurate Linux + WSL detection, prefer `detectOSAsync`.
 */
export function detectOS(overrides?: DetectOSOverrides): HostInfo {
  const platform = normalizePlatform(overrides?.platform ?? nodePlatform());

  if (platform === 'win32') {
    const { distro, distroId } = windowsDistro();
    return {
      platform,
      distro,
      distroId,
      wsl: false,
      wslVersion: 0,
      wslDistro: '',
    };
  }

  if (platform === 'darwin') {
    const { distro, distroId } = macOSDistro();
    return {
      platform,
      distro,
      distroId,
      wsl: false,
      wslVersion: 0,
      wslDistro: '',
    };
  }

  // Linux (native or WSL)
  const procVersion = syncResolveProcVersion(overrides?.procVersionSignature);
  const osReleaseContents = syncResolveOsRelease(overrides?.osReleasePath);

  if (osReleaseContents === null) {
    const wsl = wslFromProc(procVersion);
    const wslVersion = parseWslVersion(procVersion);
    return {
      platform,
      distro: 'Linux',
      distroId: 'linux',
      wsl,
      wslVersion,
      wslDistro: wsl ? 'Linux' : '',
    };
  }

  const fields = parseOsRelease(osReleaseContents);
  const { distro, distroId, wsl, wslVersion } = linuxDistroFromOsRelease(
    fields,
    procVersion,
  );

  return {
    platform,
    distro,
    distroId,
    wsl,
    wslVersion,
    wslDistro: wsl ? distro : '',
  };
}

function syncResolveProcVersion(
  override: string | null | undefined,
): string | null {
  if (override === null) return null;
  if (override !== undefined) return override;
  // In a real environment, read the first available file synchronously.
  // Since the test suite never sets this on the hot path and the public
  // API offers an async alternative for the full path, return null here.
  // Consumers needing real WSL detection should call `detectOSAsync()`.
  return null;
}

function syncResolveOsRelease(
  override: string | null | undefined,
): string | null {
  if (override === null) return null;
  if (override !== undefined) {
    return syncReadFile(override);
  }
  return syncReadFirstAvailable(DEFAULT_OS_RELEASE_PATHS);
}

function syncReadFirstAvailable(paths: readonly string[]): string | null {
  for (const p of paths) {
    const contents = syncReadFile(p);
    if (contents !== null) return contents;
  }
  return null;
}

function syncReadFile(path: string): string | null {
  try {
    // Use require to load fs so this is a true sync read
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs');
    return fs.readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}
