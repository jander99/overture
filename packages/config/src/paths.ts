import { join } from 'node:path';
import { platform as nodePlatform } from 'node:os';

/**
 * Hosts that `overture` supports in v1. Linux covers native Linux, WSL1, and
 * WSL2 — the WSL case is indistinguishable from native Linux at the XDG
 * resolver level (both use the same filesystem layout).
 */
export type SupportedHostPlatform = 'linux' | 'darwin';

export const SUPPORTED_HOST_PLATFORMS: readonly SupportedHostPlatform[] = [
  'linux',
  'darwin',
] as const;

/**
 * Mirrors the `HostPlatform` type from `@overture/os`. Defined locally
 * (instead of imported) to keep `@overture/config` decoupled from the OS
 * detection library — the caller is responsible for normalizing the input
 * to one of these three values.
 */
export type HostPlatform = SupportedHostPlatform | 'win32';

/**
 * All on-disk locations that `@overture/config` and consumers need to find
 * or write. Resolved by {@link defaultOverturePaths} from the XDG base
 * directories and the current process environment.
 */
export interface OverturePaths {
  /** Absolute path to the user-level `overture.jsonc` config file. */
  readonly configFile: string;
  /** Parent directory of {@link configFile}; also where state/cache siblings live. */
  readonly configDir: string;
  /** Directory for machine-managed state files (sync-state, last-apply, etc.). */
  readonly stateDir: string;
  /** Directory for regeneratable caches (installed-skills-cache, etc.). */
  readonly cacheDir: string;
  /** `$HOME` on linux/darwin (or equivalent). */
  readonly homeDir: string;
  /** Current working directory at the time of resolution. */
  readonly workspaceDir: string;
  /** Narrowed to supported host platforms only. */
  readonly platform: SupportedHostPlatform;
}

export interface ResolvePathsOptions {
  /** Override the host platform; defaults to `process.platform`. */
  readonly platform?: HostPlatform;
  /** Override the working directory; defaults to `process.cwd()`. */
  readonly workspaceDir?: string;
}

/**
 * Thrown when a caller asks for paths on a host that `overture` does not
 * support in v1 (currently only Windows). The CLI catches this and prints
 * a human-readable message.
 */
export class UnsupportedPlatformError extends Error {
  public readonly platform: HostPlatform;
  public constructor(platform: HostPlatform) {
    super(
      `Windows is not supported in this version of overture. ` +
        `Support is planned for a future release. ` +
        `(requested platform: ${platform})`,
    );
    this.name = 'UnsupportedPlatformError';
    this.platform = platform;
  }
}

/**
 * Returns true iff `platform` is one of {@link SUPPORTED_HOST_PLATFORMS}.
 */
export function isSupportedPlatform(
  platform: HostPlatform,
): platform is SupportedHostPlatform {
  return (SUPPORTED_HOST_PLATFORMS as readonly string[]).includes(platform);
}

/**
 * Resolve the XDG base directory for `key`, falling back to `home + fallback`
 * when the env var is unset. Mirrors the behavior of the XDG Base Directory
 * Specification, with macOS following the same convention (we do not
 * translate to `~/Library/Application Support`).
 */
function xdgBase(
  env: NodeJS.ProcessEnv,
  key:
    | 'XDG_CONFIG_HOME'
    | 'XDG_DATA_HOME'
    | 'XDG_STATE_HOME'
    | 'XDG_CACHE_HOME',
  home: string,
  fallback: string,
): string {
  const value = env[key];
  if (typeof value === 'string' && value.length > 0) return value;
  return join(home, fallback);
}

/**
 * Compute the on-disk paths used by `overture` for the requested platform.
 * Linux (including WSL1/WSL2) and macOS use the same XDG layout. Windows is
 * rejected with {@link UnsupportedPlatformError}.
 *
 * Pure function — no filesystem access, safe to call from tests.
 */
export function defaultOverturePaths(
  options: ResolvePathsOptions = {},
  env: NodeJS.ProcessEnv = process.env,
): OverturePaths {
  // `nodePlatform()` may return more values than our HostPlatform union
  // (e.g. 'aix', 'freebsd'); we collapse any non-{linux,darwin,win32}
  // value to 'win32' so the unsupported-platform gate treats them all
  // the same way. In practice this only matters if someone runs the CLI
  // on an exotic host; on linux/darwin/win32 it's a no-op.
  const rawPlatform = options.platform ?? (nodePlatform() as HostPlatform);
  const platform: HostPlatform =
    rawPlatform === 'linux' ||
    rawPlatform === 'darwin' ||
    rawPlatform === 'win32'
      ? rawPlatform
      : 'win32';

  if (!isSupportedPlatform(platform)) {
    throw new UnsupportedPlatformError(platform);
  }

  const homeDir =
    (typeof env.HOME === 'string' && env.HOME.length > 0 && env.HOME) ||
    (typeof env.USERPROFILE === 'string' && env.USERPROFILE.length > 0
      ? env.USERPROFILE
      : '/');

  const configBase = xdgBase(env, 'XDG_CONFIG_HOME', homeDir, '.config');
  const stateBase = xdgBase(env, 'XDG_STATE_HOME', homeDir, '.local/state');
  const cacheBase = xdgBase(env, 'XDG_CACHE_HOME', homeDir, '.cache');

  const configDir = join(configBase, 'overture');
  const stateDir = join(stateBase, 'overture');
  const cacheDir = join(cacheBase, 'overture');

  return {
    configFile: join(configDir, 'overture.jsonc'),
    configDir,
    stateDir,
    cacheDir,
    homeDir,
    workspaceDir: options.workspaceDir ?? process.cwd(),
    platform,
  };
}
