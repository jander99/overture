import { readFile } from 'node:fs/promises';
// Deep import from the ESM subpath. The package root re-exports
// through a UMD wrapper that uses relative `require()` calls, which
// break once esbuild inlines the package into the CJS bundle that
// lives outside `node_modules/jsonc-parser/`. Mirrors the pattern in
// `apps/cli/src/platforms/mcp-config.ts` and the repo's AGENTS.md.
import { parse as parseJsonc } from 'jsonc-parser/lib/esm/main.js';

import { OvertureConfigSchema, type OvertureConfig } from './schema.js';
import type { OverturePaths } from './paths.js';

/**
 * Read and validate the user-level overture config at the resolved path.
 *
 * Returns `null` when the file does not exist (ENOENT) — this is the
 * "no config yet" state, not an error. All other filesystem and parse
 * errors are propagated.
 *
 * JSONC (comments + trailing commas) is tolerated because the canonical
 * `overture.jsonc` file name advertises that the file may contain them.
 */
export async function loadOvertureConfig(
  paths: OverturePaths,
): Promise<OvertureConfig | null> {
  let raw: string;
  try {
    raw = await readFile(paths.configFile, 'utf8');
  } catch (err) {
    if (
      err instanceof Error &&
      'code' in err &&
      typeof err.code === 'string' &&
      err.code === 'ENOENT'
    ) {
      return null;
    }
    throw err;
  }

  // jsonc-parser returns the same value as JSON.parse for valid JSON, but
  // it also accepts comments and trailing commas. We pass the `disallowComments`
  // option as `false` (the default) to allow them.
  const errors: import('jsonc-parser/lib/esm/main.js').ParseError[] = [];

  const parsed: unknown = parseJsonc(raw, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  if (errors.length > 0) {
    const first = errors[0];
    throw new Error(
      `Failed to parse overture config at ${paths.configFile}: jsonc-parser error #${String(first)}`,
    );
  }

  const result = OvertureConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Invalid overture config at ${paths.configFile}:\n${issues}`,
    );
  }
  return result.data;
}
