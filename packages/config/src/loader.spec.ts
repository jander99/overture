import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadOvertureConfig } from './loader.js';
import { defaultOverturePaths } from './paths.js';

function writeConfigAt(paths: { configFile: string }, contents: string): void {
  mkdirSync(join(paths.configFile, '..'), { recursive: true });
  writeFileSync(paths.configFile, contents, 'utf8');
}

function withTempDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'overture-cfg-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('loadOvertureConfig', () => {
  it('returns null when the config file does not exist', async () => {
    await withTempDir(async (dir) => {
      const paths = defaultOverturePaths(
        { platform: 'linux', workspaceDir: dir },
        { HOME: dir } as NodeJS.ProcessEnv,
      );
      const result = await loadOvertureConfig(paths);
      expect(result).toBeNull();
    });
  });

  it('parses a valid config and returns the typed object', async () => {
    await withTempDir(async (dir) => {
      const paths = defaultOverturePaths(
        { platform: 'linux', workspaceDir: dir },
        { HOME: dir } as NodeJS.ProcessEnv,
      );
      writeConfigAt(
        paths,
        JSON.stringify({
          $schema: 'https://example/x.json',
          version: 1,
          profiles: {
            default: {
              mcpServers: {
                fs: { type: 'stdio', command: 'npx', args: ['-y', 'mcp-fs'] },
              },
              sync: { targets: ['claude-code'] },
              skills: [{ source: 'foo/bar', include: ['baz'] }],
            },
          },
        }),
      );
      const result = await loadOvertureConfig(paths);
      expect(result).not.toBeNull();
      expect(result?.version).toBe(1);
      expect(result?.profiles.default.mcpServers.fs.type).toBe('stdio');
    });
  });

  it('tolerates JSONC (trailing commas + line comments)', async () => {
    await withTempDir(async (dir) => {
      const paths = defaultOverturePaths(
        { platform: 'linux', workspaceDir: dir },
        { HOME: dir } as NodeJS.ProcessEnv,
      );
      const jsonc = `{
        // a leading comment
        "$schema": "https://example/x.json",
        "version": 1,
        "profiles": {
          "default": {
            "mcpServers": {
              "fs": { "type": "stdio", "command": "npx" },
            },
            "sync": { "targets": ["claude-code"], },
            "skills": [],
          },
        },
      }`;
      writeConfigAt(paths, jsonc);
      const result = await loadOvertureConfig(paths);
      expect(result).not.toBeNull();
      expect(result?.profiles.default.sync.targets).toEqual(['claude-code']);
    });
  });

  it('throws a clear error when the file exists but is invalid', async () => {
    await withTempDir(async (dir) => {
      const paths = defaultOverturePaths(
        { platform: 'linux', workspaceDir: dir },
        { HOME: dir } as NodeJS.ProcessEnv,
      );
      writeConfigAt(
        paths,
        JSON.stringify({ version: 1 /* missing profiles */ }),
      );
      await expect(loadOvertureConfig(paths)).rejects.toThrow(/config/i);
    });
  });

  it('propagates filesystem errors other than ENOENT', async () => {
    await withTempDir(async (dir) => {
      const paths = defaultOverturePaths(
        { platform: 'linux', workspaceDir: dir },
        { HOME: dir } as NodeJS.ProcessEnv,
      );
      // Replace the (non-existent) configFile with a directory so readFile
      // throws EISDIR instead of ENOENT — loader must not swallow this.
      mkdirSync(paths.configFile, { recursive: true });
      await expect(loadOvertureConfig(paths)).rejects.toThrow();
    });
  });
});
