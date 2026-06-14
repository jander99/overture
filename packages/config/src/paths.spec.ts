import { describe, expect, it } from 'vitest';
import {
  defaultOverturePaths,
  isSupportedPlatform,
  UnsupportedPlatformError,
  type OverturePaths,
} from './paths.js';

describe('defaultOverturePaths', () => {
  it('returns XDG paths on linux when XDG_CONFIG_HOME is unset', () => {
    const paths = defaultOverturePaths({ platform: 'linux' }, {
      HOME: '/home/test' /* no XDG_* */,
    } as NodeJS.ProcessEnv);
    expect(paths.configFile).toBe('/home/test/.config/overture/overture.jsonc');
    expect(paths.configDir).toBe('/home/test/.config/overture');
    expect(paths.stateDir).toBe('/home/test/.local/state/overture');
    expect(paths.cacheDir).toBe('/home/test/.cache/overture');
    expect(paths.platform).toBe('linux');
  });

  it('honors XDG_CONFIG_HOME on linux', () => {
    const paths = defaultOverturePaths({ platform: 'linux' }, {
      HOME: '/home/test',
      XDG_CONFIG_HOME: '/srv/config',
    } as NodeJS.ProcessEnv);
    expect(paths.configDir).toBe('/srv/config/overture');
    expect(paths.configFile).toBe('/srv/config/overture/overture.jsonc');
  });

  it('honors XDG_STATE_HOME and XDG_CACHE_HOME', () => {
    const paths = defaultOverturePaths({ platform: 'linux' }, {
      HOME: '/home/test',
      XDG_STATE_HOME: '/srv/state',
      XDG_CACHE_HOME: '/srv/cache',
    } as NodeJS.ProcessEnv);
    expect(paths.stateDir).toBe('/srv/state/overture');
    expect(paths.cacheDir).toBe('/srv/cache/overture');
  });

  it('returns XDG paths on darwin (NOT ~/Library/Application Support)', () => {
    const paths = defaultOverturePaths({ platform: 'darwin' }, {
      HOME: '/Users/test',
    } as NodeJS.ProcessEnv);
    expect(paths.configDir).toBe('/Users/test/.config/overture');
    expect(paths.stateDir).toBe('/Users/test/.local/state/overture');
    expect(paths.cacheDir).toBe('/Users/test/.cache/overture');
    expect(paths.platform).toBe('darwin');
    // Sanity: should NOT be macOS-native Application Support
    expect(paths.configDir).not.toContain('Application Support');
  });

  it('throws UnsupportedPlatformError for win32', () => {
    expect(() =>
      defaultOverturePaths({ platform: 'win32' }, {
        USERPROFILE: 'C:/Users/test',
      } as NodeJS.ProcessEnv),
    ).toThrow(UnsupportedPlatformError);
  });

  it('UnsupportedPlatformError message names Windows and points to v2', () => {
    let caught: unknown;
    try {
      defaultOverturePaths({ platform: 'win32' }, {
        USERPROFILE: 'C:/Users/test',
      } as NodeJS.ProcessEnv);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(UnsupportedPlatformError);
    const msg = (caught as Error).message;
    expect(msg.toLowerCase()).toContain('windows');
    expect(msg).toMatch(/v2|future|plan/i);
  });

  it('exposes the same shape regardless of platform (linux vs darwin)', () => {
    const linux = defaultOverturePaths({ platform: 'linux' }, {
      HOME: '/home/x',
    } as NodeJS.ProcessEnv);
    const darwin = defaultOverturePaths({ platform: 'darwin' }, {
      HOME: '/Users/x',
    } as NodeJS.ProcessEnv);
    const linuxKeys = Object.keys(linux).sort();
    const darwinKeys = Object.keys(darwin).sort();
    expect(linuxKeys).toEqual(darwinKeys);
  });
});

describe('isSupportedPlatform', () => {
  it('returns true for linux', () => {
    expect(isSupportedPlatform('linux')).toBe(true);
  });
  it('returns true for darwin', () => {
    expect(isSupportedPlatform('darwin')).toBe(true);
  });
  it('returns false for win32', () => {
    expect(isSupportedPlatform('win32')).toBe(false);
  });
});

describe('OverturePaths shape', () => {
  it('exposes configFile, configDir, stateDir, cacheDir, homeDir, platform, workspaceDir', () => {
    const paths: OverturePaths = defaultOverturePaths({ platform: 'linux' }, {
      HOME: '/home/x',
    } as NodeJS.ProcessEnv);
    expect(typeof paths.configFile).toBe('string');
    expect(typeof paths.configDir).toBe('string');
    expect(typeof paths.stateDir).toBe('string');
    expect(typeof paths.cacheDir).toBe('string');
    expect(typeof paths.homeDir).toBe('string');
    expect(typeof paths.workspaceDir).toBe('string');
    expect(['linux', 'darwin']).toContain(paths.platform);
  });
});
