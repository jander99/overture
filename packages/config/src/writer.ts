/**
 * Safe JSONC writer for the canonical `overture.jsonc`.
 *
 * The output is deterministic JSONC (2-space indent, explanatory comments,
 * trailing newline) that round-trips through `loadOvertureConfig`. The
 * write primitive uses a same-directory temp file + `rename` to avoid
 * leaving a partial final file when a write or rename fails.
 *
 * The writer is the first place in the repo that *creates* the canonical
 * config on disk. It deliberately never touches any agent MCP config.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { OvertureConfigSchema, type OvertureConfig } from './schema.js';
import type { OverturePaths } from './paths.js';

/**
 * Inputs to {@link writeOvertureConfig}. The `config` field is intentionally
 * untyped at the boundary so we can produce a typed Zod error when the
 * caller passes something that does not match the schema.
 */
export interface WriteOvertureConfigInput {
  readonly paths: OverturePaths;
  readonly config: unknown;
}

/**
 * Thrown when the input to {@link writeOvertureConfig} does not validate
 * against {@link OvertureConfigSchema}. The error message lists every Zod
 * issue on its own line so the user can read it directly.
 *
 * No filesystem I/O is attempted when this error is thrown — the
 * validation gate runs before `mkdir`/`writeFile`/`rename`.
 */
export class InvalidOvertureConfigError extends Error {
  public readonly issues: readonly string[];

  public constructor(issues: readonly string[]) {
    super(`Invalid overture config:\n${issues.join('\n')}`);
    this.name = 'InvalidOvertureConfigError';
    this.issues = issues;
  }
}

/**
 * Thrown when the writer's filesystem step fails (mkdir, writeFile, or
 * rename). The original error is preserved on `.cause` so callers can
 * inspect the underlying failure (EACCES, EISDIR, ENOSPC, etc.).
 *
 * On this error path the writer has already best-effort-unlinked its own
 * current temp file; pre-existing files outside the writer's temp file
 * are never touched.
 */
export class OvertureConfigWriteError extends Error {
  public readonly targetPath: string;

  public constructor(
    targetPath: string,
    message: string,
    options: { cause: unknown },
  ) {
    super(message, options);
    this.name = 'OvertureConfigWriteError';
    this.targetPath = targetPath;
  }
}

/**
 * Pure renderer. Takes a fully-validated `OvertureConfig` and returns a
 * deterministic JSONC string with 2-space indent, explanatory comments
 * (top-of-file `$schema`/`version`, settings inline comments, an
 * `mcpServers` explanatory comment, a `disabledServers` explanatory
 * comment, and a `skills` reserved/inert comment), and a single trailing
 * newline.
 *
 * No I/O. No side effects. Safe to call from tests.
 */
export function renderOvertureConfigJsonc(config: OvertureConfig): string {
  const lines: string[] = [];
  lines.push('{');

  // Top-of-file $schema and version. $schema is optional in the schema but
  // the bootstrap layer always sets it; we render it whenever it is set.
  if (config.$schema !== undefined) {
    lines.push(`  "$schema": ${JSON.stringify(config.$schema)},`);
  }
  lines.push(`  "version": ${config.version},`);
  lines.push('');

  // settings: 4 optional keys, each with an inline comment matching
  // docs/overture-config.md lines 60-63.
  lines.push('  "settings": {');
  const settings = config.settings;
  const settingsLines: string[] = [];
  if (settings.defaultProfile !== undefined) {
    settingsLines.push(
      `    "defaultProfile": ${JSON.stringify(settings.defaultProfile)}, // optional, default "default"`,
    );
  }
  if (settings.dryRunByDefault !== undefined) {
    settingsLines.push(
      `    "dryRunByDefault": ${settings.dryRunByDefault}, // optional, default true`,
    );
  }
  if (settings.backupBeforeWrite !== undefined) {
    settingsLines.push(
      `    "backupBeforeWrite": ${settings.backupBeforeWrite}, // optional, default true`,
    );
  }
  if (settings.conflictPolicy !== undefined) {
    settingsLines.push(
      `    "conflictPolicy": ${JSON.stringify(settings.conflictPolicy)}, // optional: "refuse" | "prompt" | "overwrite"`,
    );
  }
  // The settings block is always emitted (the schema gives it a `{}` default)
  // but it may be empty when no key is set. Emit an empty body in that case.
  if (settingsLines.length === 0) {
    lines.push('');
  } else {
    lines.push(...settingsLines);
  }
  lines.push('  },');
  lines.push('');

  // profiles: hand-walk each profile so we can place the mcpServers /
  // disabledServers / skills explanatory comments in the right place.
  lines.push('  "profiles": {');
  const profileNames = Object.keys(config.profiles);
  profileNames.forEach((profileName, index) => {
    const profile = config.profiles[profileName];
    const trailing = index < profileNames.length - 1 ? ',' : '';
    lines.push(`    ${JSON.stringify(profileName)}: {`);

    // mcpServers: explanatory comment INSIDE the object (matches
    // docs/overture-config.md line 69). The comment is placed at the top
    // of the open `{`, before any server entries.
    lines.push('      "mcpServers": {');
    lines.push(
      '        // mcpServers key is canonical (matches Claude Code / OpenCode / etc.)',
    );
    const serverEntries = Object.entries(profile.mcpServers);
    if (serverEntries.length > 0) {
      // Re-indent the JSON.stringify output (which is at 2-space base)
      // to nest under the 6-space key. The body lines start at 8 spaces.
      const mcpJson = JSON.stringify(profile.mcpServers, null, 2);
      lines.push(reindentJsonBody(mcpJson, '      '));
    }
    lines.push('      },');
    lines.push('');

    // sync: targets first, then disabledServers with its comment.
    lines.push('      "sync": {');
    lines.push(`        "targets": ${JSON.stringify(profile.sync.targets)},`);
    lines.push('');
    if (profile.sync.disabledServers.length === 0) {
      lines.push('        "disabledServers": [');
      lines.push(
        '          // global exclusions: server names that are never synced anywhere',
      );
      lines.push('        ]');
    } else {
      lines.push('        "disabledServers": [');
      lines.push(
        '          // global exclusions: server names that are never synced anywhere',
      );
      const dsJson = JSON.stringify(profile.sync.disabledServers, null, 2);
      lines.push(reindentJsonBody(dsJson, '        '));
      lines.push('        ]');
    }
    lines.push('      },');
    lines.push('');

    // skills: reserved/inert comment at the top of the (possibly empty)
    // array. The comment mirrors docs/overture-config.md line 81.
    if (profile.skills.length === 0) {
      lines.push('      "skills": [');
      lines.push('        // reserved; inert in v1');
      lines.push('      ]');
    } else {
      lines.push('      "skills": [');
      lines.push('        // reserved; inert in v1');
      const skillsJson = JSON.stringify(profile.skills, null, 2);
      lines.push(reindentJsonBody(skillsJson, '      '));
      lines.push('      ]');
    }

    lines.push(`    }${trailing}`);
  });
  lines.push('  }');
  lines.push('}');

  return lines.join('\n') + '\n';
}

/**
 * Re-indent the inner content of a `JSON.stringify(..., null, 2)` body so it
 * nests under a parent key. Drops both the opening delimiter (`{` or `[`)
 * and the matching closing delimiter — the caller emits those. Re-indents
 * the remaining inner lines with `prefix`.
 */
function reindentJsonBody(jsonBody: string, prefix: string): string {
  const lines = jsonBody.split('\n');
  if (lines.length < 3) return '';
  // Skip the first line (opening delimiter) AND the last line (closing delimiter).
  return lines
    .slice(1, -1)
    .map((line) => prefix + line)
    .join('\n');
}

/**
 * Validate, render, and atomically write the canonical `overture.jsonc`
 * to `paths.configFile`. The write goes through a unique same-directory
 * temp file (`.<basename>.<pid>.<uuid>.tmp`) and `fs.promises.rename`,
 * so a failed write or rename never leaves a partial final file.
 *
 * On validation failure, throws {@link InvalidOvertureConfigError} and
 * does not touch the filesystem.
 * On filesystem failure, throws {@link OvertureConfigWriteError} with
 * the original error preserved on `.cause`, having best-effort-unlinked
 * the current temp file.
 *
 * Never touches any file outside `paths.configDir`.
 */
export async function writeOvertureConfig(
  input: WriteOvertureConfigInput,
): Promise<void> {
  // 1. Validate first, before any I/O.
  const result = OvertureConfigSchema.safeParse(input.config);
  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new InvalidOvertureConfigError(issues);
  }

  // 2. Render the deterministic JSONC body.
  const body = renderOvertureConfigJsonc(result.data);

  // 3. Create the parent config dir.
  const configDir = input.paths.configDir;
  const configFile = input.paths.configFile;
  try {
    await mkdir(configDir, { recursive: true });
  } catch (err) {
    throw new OvertureConfigWriteError(
      configFile,
      `Failed to create overture config dir at ${configDir}: ${
        err instanceof Error ? err.message : String(err)
      }`,
      { cause: err },
    );
  }

  // 4. Write to a unique same-directory temp file, then rename. The temp
  // file name starts with a dot so a stray `ls` on configDir does not
  // confuse the user; the suffix is process id + uuid for uniqueness even
  // when several processes race on the same dir.
  const baseName = basename(configFile);
  const tempFileName = `.${baseName}.${process.pid}.${randomUUID()}.tmp`;
  const tempPath = join(configDir, tempFileName);

  try {
    await writeFile(tempPath, body, 'utf8');
    await rename(tempPath, configFile);
  } catch (err) {
    // Best-effort cleanup of OUR temp file only. Do not unlink anything
    // else — the pre-existing path at `configFile` (e.g. a directory the
    // caller left there) is the caller's property.
    try {
      await unlink(tempPath);
    } catch {
      // If the temp file never existed (e.g. mkdir failure) or was already
      // unlinked, swallow the cleanup error. The user-facing error is the
      // original one; the cause is preserved below.
    }
    throw new OvertureConfigWriteError(
      configFile,
      `Failed to write overture config at ${configFile}: ${
        err instanceof Error ? err.message : String(err)
      }`,
      { cause: err },
    );
  }
}
