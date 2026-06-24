/**
 * Test plan for the safe JSONC writer in `writer.ts`. We follow the same
 * style as `loader.spec.ts`: real `mkdtempSync` directories, no `vi.mock`
 * of `node:fs/promises`, and direct filesystem assertions.
 */
import { describe, expect, it } from 'vitest';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { join, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
// Deep import: the package root re-exports through a UMD wrapper that breaks
// in CJS bundles. Mirrors the pattern in `loader.ts` and the repo AGENTS.md.
import { parse as parseJsonc } from 'jsonc-parser/lib/esm/main.js';

import { defaultOverturePaths } from './paths.js';
import {
  OvertureConfigSchema,
  parseOvertureConfig,
  type OvertureConfig,
} from './schema.js';
import {
  InvalidOvertureConfigError,
  renderOvertureConfigJsonc,
  writeOvertureConfig,
} from './writer.js';

/**
 * A baseline valid OvertureConfig that the writer can render and that the
 * loader can re-parse. Mirrors the shape bootstrap.ts:189-205 produces.
 */
// Use `OvertureConfig` so the literal is mutable and structurally conforms
// to what the schema expects (e.g. `string[]` not `readonly string[]`).
// `as const` would be a type error against the schema's `z.string().array()`
// which produces `string[]` (mutable).
const baselineConfig: OvertureConfig = {
  $schema:
    'https://raw.githubusercontent.com/jander99/overture/main/schemas/overture.config.schema.json',
  version: 1,
  settings: {
    defaultProfile: 'default',
    dryRunByDefault: true,
    backupBeforeWrite: true,
    conflictPolicy: 'refuse',
  },
  profiles: {
    default: {
      mcpServers: {},
      sync: { targets: [], disabledServers: [] },
      skills: [],
    },
  },
};

function withTempDir<T>(fn: (dir: string) => T | Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'overture-writer-'));
  return Promise.resolve()
    .then(() => fn(dir))
    .finally(() => {
      rmSync(dir, { recursive: true, force: true });
    });
}

function makePaths(dir: string) {
  return defaultOverturePaths({ platform: 'linux', workspaceDir: dir }, {
    HOME: dir,
  } as NodeJS.ProcessEnv);
}

describe('renderOvertureConfigJsonc', () => {
  it('returns a string that ends with a single trailing newline', () => {
    const rendered = renderOvertureConfigJsonc(baselineConfig);
    expect(rendered.endsWith('\n')).toBe(true);
    // exactly one trailing newline
    expect(rendered.endsWith('\n\n')).toBe(false);
  });

  it('preserves the $schema field at the top of the document', () => {
    const rendered = renderOvertureConfigJsonc(baselineConfig);
    expect(rendered).toContain('"$schema"');
    expect(rendered).toContain(baselineConfig.$schema);
  });

  it('embeds generated explanatory comments for mcpServers, disabledServers, and skills', () => {
    const rendered = renderOvertureConfigJsonc(baselineConfig);
    // mcpServers and disabledServers explanatory comments
    expect(rendered).toMatch(/mcpServers/);
    expect(rendered).toContain('disabledServers');
    // skills reserved/inert comment
    expect(rendered).toMatch(/skills/);
    // The skills comment must include a "reserved" marker, mirroring
    // docs/overture-config.md line 81: "reserved; inert in v1"
    expect(rendered).toMatch(/reserved/i);
  });

  it('is deterministic — two calls produce byte-identical output', () => {
    const a = renderOvertureConfigJsonc(baselineConfig);
    const b = renderOvertureConfigJsonc(baselineConfig);
    expect(a).toBe(b);
  });

  it('produces output that parses with jsonc-parser and validates against OvertureConfigSchema', () => {
    const rendered = renderOvertureConfigJsonc(baselineConfig);
    const errors: import('jsonc-parser/lib/esm/main.js').ParseError[] = [];
    const parsed: unknown = parseJsonc(rendered, errors, {
      allowTrailingComma: true,
      disallowComments: false,
    });
    expect(errors).toEqual([]);
    const validated = OvertureConfigSchema.safeParse(parsed);
    expect(validated.success).toBe(true);
  });
});

describe('writeOvertureConfig', () => {
  it('creates the parent configDir when it does not exist', async () => {
    await withTempDir(async (dir) => {
      const paths = makePaths(dir);
      expect(existsSync(paths.configDir)).toBe(false);
      await writeOvertureConfig({ paths, config: baselineConfig });
      expect(existsSync(paths.configDir)).toBe(true);
      expect(statSync(paths.configDir).isDirectory()).toBe(true);
    });
  });

  it('writes the canonical config file at paths.configFile', async () => {
    await withTempDir(async (dir) => {
      const paths = makePaths(dir);
      await writeOvertureConfig({ paths, config: baselineConfig });
      expect(existsSync(paths.configFile)).toBe(true);
      const contents = readFileSync(paths.configFile, 'utf8');
      expect(contents.length).toBeGreaterThan(0);
    });
  });

  it('emits generated comments and $schema in the written file', async () => {
    await withTempDir(async (dir) => {
      const paths = makePaths(dir);
      await writeOvertureConfig({ paths, config: baselineConfig });
      const contents = readFileSync(paths.configFile, 'utf8');
      expect(contents).toContain('"$schema"');
      expect(contents).toContain(baselineConfig.$schema);
      // explanatory comment for the mcpServers key
      expect(contents).toMatch(/mcpServers/);
    });
  });

  it('produces a file whose parsed contents pass parseOvertureConfig', async () => {
    await withTempDir(async (dir) => {
      const paths = makePaths(dir);
      await writeOvertureConfig({ paths, config: baselineConfig });
      const contents = readFileSync(paths.configFile, 'utf8');
      const errors: import('jsonc-parser/lib/esm/main.js').ParseError[] = [];
      const parsed: unknown = parseJsonc(contents, errors, {
        allowTrailingComma: true,
        disallowComments: false,
      });
      expect(errors).toEqual([]);
      const validated = parseOvertureConfig(parsed);
      expect(validated.version).toBe(1);
    });
  });

  it('refuses invalid input with InvalidOvertureConfigError and creates no final file', async () => {
    await withTempDir(async (dir) => {
      const paths = makePaths(dir);
      const invalid = {
        $schema: 'https://example/x.json',
        version: 1,
        // missing required `profiles`
      };
      let caught: unknown;
      try {
        await writeOvertureConfig({
          paths,
          // Cast to a value the signature accepts; the writer must still
          // catch the validation failure and reject.
          config: invalid as never,
        });
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(InvalidOvertureConfigError);
      const message = (caught as Error).message;
      expect(message.toLowerCase()).toContain('config');
      // No final file written.
      expect(existsSync(paths.configFile)).toBe(false);
      // No config dir created on validation failure (we never start I/O).
      expect(existsSync(paths.configDir)).toBe(false);
    });
  });

  it('cleans up the current temp file when the rename fails and creates no final file', async () => {
    await withTempDir(async (dir) => {
      const paths = makePaths(dir);
      // Pre-create a directory at the final configFile path so the
      // temp-file rename must fail (EISDIR/ENOTDIR). The writer must:
      //  1. leave the pre-existing directory in place (we did not own it),
      //  2. unlink its own temp file,
      //  3. surface a typed error with the original cause preserved.
      mkdirSync(paths.configFile, { recursive: true });
      const configDirBefore = readdirSync(paths.configDir);
      const tempsBefore = configDirBefore.filter((name) =>
        name.endsWith('.tmp'),
      );
      expect(tempsBefore).toEqual([]);

      let caught: unknown;
      try {
        await writeOvertureConfig({ paths, config: baselineConfig });
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(Error);
      const err = caught as Error & { cause?: unknown };
      // The cause should be the original filesystem error, not a swallowed
      // null/undefined. We do not require a specific error class here; the
      // contract is "preserve the original cause" which is observable as a
      // non-empty .cause on the wrapper error.
      expect(err.cause).toBeDefined();
      // The pre-existing directory must still be there.
      expect(existsSync(paths.configFile)).toBe(true);
      expect(statSync(paths.configFile).isDirectory()).toBe(true);
      // No temp files left behind in configDir from this write.
      const configDirAfter = readdirSync(paths.configDir);
      const tempsAfter = configDirAfter.filter((name) => name.endsWith('.tmp'));
      expect(tempsAfter).toEqual([]);
    });
  });

  it('does not touch any file outside paths.configDir', async () => {
    await withTempDir(async (dir) => {
      // Snapshot the temp dir before the write. The writer may only add
      // the new configDir subtree (`.config/overture/...`); no files may be
      // created or removed at the top level.
      const paths = makePaths(dir);
      const topLevelBefore = readdirSync(dir);
      await writeOvertureConfig({ paths, config: baselineConfig });
      const topLevelAfter = readdirSync(dir);
      const added = topLevelAfter.filter(
        (name) => !topLevelBefore.includes(name),
      );
      // The only added top-level entry should be the first segment of the
      // configDir path relative to the temp dir (e.g. `.config`). Nothing else.
      const rel = relative(dir, paths.configDir);
      const expectedFirstSegment = rel.split(sep)[0];
      expect(added).toEqual([expectedFirstSegment]);
    });
  });

  it('round-trips a richer config (mcpServers + sync targets + skills)', async () => {
    await withTempDir(async (dir) => {
      const paths = makePaths(dir);
      const rich: OvertureConfig = {
        $schema:
          'https://raw.githubusercontent.com/jander99/overture/main/schemas/overture.config.schema.json',
        version: 1,
        settings: {
          defaultProfile: 'default',
          dryRunByDefault: true,
          backupBeforeWrite: true,
          conflictPolicy: 'refuse',
        },
        profiles: {
          default: {
            mcpServers: {
              filesystem: {
                type: 'stdio',
                command: 'npx',
                args: [
                  '-y',
                  '@modelcontextprotocol/server-filesystem',
                  '/home',
                ],
              },
              context7: {
                type: 'stdio',
                command: 'npx',
                args: ['-y', '@upstash/context7-mcp@latest'],
                env: { CONTEXT7_API_KEY: '${CONTEXT7_API_KEY}' },
              },
            },
            sync: {
              targets: ['claude-code', 'opencode'],
              disabledServers: ['filesystem'],
            },
            skills: [
              {
                source: 'vercel-labs/agent-skills',
                include: ['frontend-design', 'skill-creator'],
              },
            ],
          },
        },
      };
      await writeOvertureConfig({ paths, config: rich });
      const contents = readFileSync(paths.configFile, 'utf8');
      // The written content should contain a stable marker for every
      // server name and skill source we passed in.
      expect(contents).toContain('filesystem');
      expect(contents).toContain('context7');
      expect(contents).toContain('vercel-labs/agent-skills');
      const errors: import('jsonc-parser/lib/esm/main.js').ParseError[] = [];
      const parsed: unknown = parseJsonc(contents, errors, {
        allowTrailingComma: true,
        disallowComments: false,
      });
      expect(errors).toEqual([]);
      const revalidated = parseOvertureConfig(parsed);
      expect(revalidated.profiles.default.mcpServers.filesystem?.type).toBe(
        'stdio',
      );
      expect(revalidated.profiles.default.sync.targets).toEqual([
        'claude-code',
        'opencode',
      ]);
    });
  });
});
