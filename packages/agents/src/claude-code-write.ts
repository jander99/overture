/**
 * Claude Code MCP writer (E3 slice).
 *
 * Self-contained writer: it carries its own path resolution via
 * `ctx` (the first argument), resolves the on-disk target via
 * `pickClaudeCodeTarget`, and refuses to create missing files,
 * missing containers, or missing server entries.
 *
 * Uses `editJsoncMap` as the byte-splice primitive to surgically
 * replace only the touched server-entry value nodes, preserving
 * surrounding comments, formatting, key order, and unrelated content.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import {
  parse as parseJsonc,
  type ParseError,
} from 'jsonc-parser/lib/esm/main.js';
import type { OvertureMcpServer } from '@overture/config';
import type {
  AgentMcpWriteInput,
  AgentMcpWriteResult,
  McpLocationFormat,
  PathResolutionContext,
  StringMap,
  TargetPath,
} from './types.js';
import {
  pickClaudeCodeTarget,
  type ClaudeCodeWriteTarget,
} from './claude-code-write-helpers.js';
import type { JsonValue } from './types.js';
import { editJsoncMap } from './jsonc-map-write.js';

// ---------------------------------------------------------------------------
// Canonical-to-native conversion
// ---------------------------------------------------------------------------

export type ClaudeCodeWritableStdioServer = {
  // `type` is optional in the native shape: Claude Code treats `type: 'stdio'`
  // as the implicit default and existing entries in the wild commonly omit it.
  // toClaudeCodeMcpServer preserves byte-equivalence with the existing entry,
  // so the emitted `type` is conditional on whether the existing entry had one.
  readonly type?: 'stdio';
  readonly command: string;
  readonly args?: readonly string[];
  readonly env?: StringMap;
  readonly [key: string]: JsonValue | undefined;
};

export type ClaudeCodeWritableRemoteServer = {
  readonly type: 'http';
  readonly url: string;
  readonly headers?: StringMap;
  readonly [key: string]: JsonValue | undefined;
};

export type ClaudeCodeWritableMcpServer =
  | ClaudeCodeWritableStdioServer
  | ClaudeCodeWritableRemoteServer;

const CLAUDE_CODE_CANONICAL_FIELD_NAMES = new Set<string>([
  'type',
  'command',
  'args',
  'env',
  'url',
  'headers',
]);

function collectExtensions(
  existing: ClaudeCodeWritableMcpServer | undefined,
): Record<string, JsonValue> {
  const extensions: Record<string, JsonValue> = {};
  if (existing === undefined) {
    return extensions;
  }

  for (const key of Object.keys(existing)) {
    if (CLAUDE_CODE_CANONICAL_FIELD_NAMES.has(key)) {
      continue;
    }
    const value = existing[key];
    if (value !== undefined) {
      extensions[key] = value;
    }
  }

  return extensions;
}

/**
 * Convert a canonical `OvertureMcpServer` to a Claude Code native server.
 *
 * - stdio → `{ type: 'stdio', command: string, args?: string[], env?: StringMap }`
 * - remote → `{ type: 'http', url: string, headers?: StringMap }`
 *
 * Preserves non-canonical extension fields from `existing` (e.g. any custom
 * keys the user may have added to their config).
 */
export function toClaudeCodeMcpServer(
  server: OvertureMcpServer,
  existing?: ClaudeCodeWritableMcpServer,
): ClaudeCodeWritableMcpServer {
  const extensions = collectExtensions(existing);
  // Claude Code treats `type: 'stdio'` as the implicit default — fixtures in the wild
  // commonly omit it. Preserve byte-equivalence with the existing entry on update:
  // when existing is provided AND lacks `type`, omit `type` from the new value.
  const shouldEmitType =
    existing === undefined || 'type' in (existing as Record<string, unknown>);

  if (server.type === 'stdio') {
    return {
      ...extensions,
      ...(shouldEmitType ? { type: 'stdio' as const } : {}),
      command: server.command,
      ...(server.args === undefined ? {} : { args: server.args }),
      ...(server.env === undefined ? {} : { env: server.env }),
    };
  }

  return {
    ...extensions,
    type: 'http',
    url: server.url,
    ...(server.headers === undefined ? {} : { headers: server.headers }),
  };
}

// ---------------------------------------------------------------------------
// Writer helpers
// ---------------------------------------------------------------------------

function targetPathFor(
  target: Exclude<ClaudeCodeWriteTarget, { kind: 'none' }>,
): TargetPath {
  switch (target.kind) {
    case 'project':
      return { scope: 'project', base: 'workspace', path: target.path };
    case 'user-top':
      return { scope: 'user', base: 'home', path: target.path };
    case 'user-projects':
      return { scope: 'user', base: 'home', path: target.path };
  }
}

/**
 * Returns the JSON pointer path segments to the mcpServers container
 * (excluding the server-name leaf, which is passed separately to
 * editJsoncMap as the map key to patch).
 */
function targetPathSegmentsFor(
  target: Exclude<ClaudeCodeWriteTarget, { kind: 'none' }>,
): readonly string[] {
  switch (target.kind) {
    case 'project':
    case 'user-top':
      return ['mcpServers'];
    case 'user-projects':
      return ['projects', target.workspaceKey, 'mcpServers'];
  }
}

async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    if (
      typeof err === 'object' &&
      err !== null &&
      typeof (err as Record<string, unknown>)['code'] === 'string' &&
      ['ENOENT', 'EACCES', 'EPERM', 'EISDIR'].includes(
        (err as Record<string, unknown>)['code'] as string,
      )
    ) {
      return null;
    }
    throw err;
  }
}

async function atomicWrite(
  targetPath: string,
  contents: string,
): Promise<void> {
  await mkdir(dirname(targetPath), { recursive: true });
  const tempPath = join(
    dirname(targetPath),
    `.${basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(tempPath, contents, 'utf8');
    await rename(tempPath, targetPath);
  } catch (err) {
    try {
      await rm(tempPath, { force: true });
    } catch {
      /* best-effort cleanup */
    }
    throw err;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateContainer(
  parsed: unknown,
  segments: readonly string[],
): 'unsupported-shape' | null {
  let container: unknown = parsed;
  for (const seg of segments) {
    if (container === null || typeof container !== 'object') {
      return 'unsupported-shape';
    }
    container = (container as Record<string, unknown>)[seg];
  }
  if (container === undefined || !isObject(container)) {
    return 'unsupported-shape';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

export async function writeClaudeCodeMcpConfig(
  ctx: PathResolutionContext,
  input: AgentMcpWriteInput,
): Promise<AgentMcpWriteResult> {
  const dryRun = input.dryRun === true;

  // pathContext is always provided by the orchestrator — no early-return needed.

  // Discover target. pickClaudeCodeTarget re-throws parse errors so we can
  // surface 'parse-error' instead of silently treating them as not-targetable.
  let target: Exclude<ClaudeCodeWriteTarget, { kind: 'none' }>;
  try {
    const picked = await pickClaudeCodeTarget(ctx);
    if (picked.kind === 'none') {
      // No applicable target found. Try to read the file to detect parse errors.
      if (picked.path.length > 0) {
        const existing = await readIfExists(picked.path);
        if (existing !== null) {
          const parseErrors: ParseError[] = [];
          parseJsonc(existing, parseErrors, {
            allowTrailingComma: true,
            disallowComments: false,
          });
          if (parseErrors.length > 0) {
            return {
              written: 0,
              changed: false,
              dryRun,
              serversWritten: [],
              targetPaths: [{ scope: 'user', base: 'home', path: picked.path }],
              resolvedPath: picked.path,
              format: 'jsonc' as McpLocationFormat,
              reason: 'parse-error',
            };
          }
        }
      }
      return {
        written: 0,
        changed: false,
        dryRun,
        serversWritten: [],
        targetPaths: [],
        reason: 'not-targetable',
      };
    }
    target = picked;
  } catch {
    return {
      written: 0,
      changed: false,
      dryRun,
      serversWritten: [],
      targetPaths: [],
      reason: 'parse-error',
    };
  }

  const resolvedPath = target.path;

  // Read the target file defensively.
  const original = await readIfExists(resolvedPath);
  if (original === null) {
    return {
      written: 0,
      changed: false,
      dryRun,
      serversWritten: [],
      targetPaths: [targetPathFor(target)],
      resolvedPath,
      format: 'jsonc' as McpLocationFormat,
      reason: 'not-targetable',
    };
  }

  // Parse the file to validate it and locate the container.
  const parseErrors: ParseError[] = [];
  const parsed = parseJsonc(original, parseErrors, {
    allowTrailingComma: true,
    disallowComments: false,
  }) as unknown;

  if (parseErrors.length > 0 || parsed === undefined || !isObject(parsed)) {
    return {
      written: 0,
      changed: false,
      dryRun,
      serversWritten: [],
      targetPaths: [targetPathFor(target)],
      resolvedPath,
      format: 'jsonc' as McpLocationFormat,
      reason: 'parse-error',
    };
  }

  // Walk into the correct container based on target kind.
  const segments = targetPathSegmentsFor(target);
  const shapeErr = validateContainer(parsed, segments);
  if (shapeErr === 'unsupported-shape') {
    return {
      written: 0,
      changed: false,
      dryRun,
      serversWritten: [],
      targetPaths: [targetPathFor(target)],
      resolvedPath,
      format: 'jsonc' as McpLocationFormat,
      reason: 'unsupported-shape',
    };
  }

  let container: unknown = parsed;
  for (const seg of segments) {
    container = (container as Record<string, unknown>)[seg];
  }

  // Build per-server patches: check existence and read existing native entries.
  type ServerPatch = {
    name: string;
    native: ClaudeCodeWritableMcpServer;
  };
  const patches: ServerPatch[] = [];

  for (const entry of input.servers) {
    // Server must exist in container (update-only policy).
    if (
      !isObject(container) ||
      !(entry.name in (container as Record<string, unknown>))
    ) {
      return {
        written: 0,
        changed: false,
        dryRun,
        serversWritten: [],
        targetPaths: [targetPathFor(target)],
        resolvedPath,
        format: 'jsonc' as McpLocationFormat,
        reason: 'not-targetable',
      };
    }

    // Read existing native entry for extension preservation.
    const existingEntry = (container as Record<string, unknown>)[entry.name];
    const existingNative = isObject(existingEntry)
      ? (existingEntry as unknown as ClaudeCodeWritableMcpServer)
      : undefined;
    const native = toClaudeCodeMcpServer(entry.server, existingNative);
    // Skip no-op patches byte-equivalent to the existing entry (Claude Code
    // canonical writers add fields like `type: 'stdio'` that some existing
    // entries may already omit; byte-equivalence is the source of truth).
    if (JSON.stringify(native) === JSON.stringify(existingEntry)) {
      continue;
    }
    patches.push({ name: entry.name, native });
  }

  // Apply each patch via editJsoncMap using the container path only.
  // editJsoncMap returns 'unsupported-path' when the server key is absent
  // from the container — treat that as 'not-targetable' (update-only policy).
  const originalBytes = new TextEncoder().encode(original);
  let accumulated = originalBytes;
  let anyChanged = false;
  let finalBytesLength = originalBytes.length;

  for (const patch of patches) {
    const result = editJsoncMap({
      original: accumulated,
      targetPath: segments,
      patch: { [patch.name]: patch.native },
    });

    if (result.kind === 'error') {
      if (result.reason === 'parse-error') {
        return {
          written: 0,
          changed: false,
          dryRun,
          serversWritten: [],
          targetPaths: [targetPathFor(target)],
          resolvedPath,
          format: 'jsonc' as McpLocationFormat,
          reason: 'parse-error',
        };
      }
      if (result.reason === 'unsupported-shape') {
        return {
          written: 0,
          changed: false,
          dryRun,
          serversWritten: [],
          targetPaths: [targetPathFor(target)],
          resolvedPath,
          format: 'jsonc' as McpLocationFormat,
          reason: 'unsupported-shape',
        };
      }
      // unsupported-path: server absent — update-only refusal
      return {
        written: 0,
        changed: false,
        dryRun,
        serversWritten: [],
        targetPaths: [targetPathFor(target)],
        resolvedPath,
        format: 'jsonc' as McpLocationFormat,
        reason: 'not-targetable',
      };
    }

    if (result.changed) {
      anyChanged = true;
      finalBytesLength = result.nextBytes.length;
      accumulated = result.nextBytes as Uint8Array<ArrayBuffer>;
    }
  }

  // Dry-run: return planned metadata without writing.
  if (dryRun) {
    // Dry-run reports zero actual disk writes; planned targets + names
    // are surfaced via serversWritten/targetPaths.
    return {
      written: 0,
      changed: false,
      dryRun,
      serversWritten: anyChanged ? patches.map((p) => p.name) : [],
      targetPaths: [targetPathFor(target)],
      resolvedPath,
      format: 'jsonc' as McpLocationFormat,
      bytesChanged: anyChanged
        ? Math.abs(finalBytesLength - originalBytes.length)
        : 0,
    };
  }

  // No-change check.
  const newContent = new TextDecoder('utf-8').decode(accumulated);
  if (!anyChanged || newContent === original) {
    return {
      written: 0,
      changed: false,
      dryRun,
      serversWritten: [],
      targetPaths: [targetPathFor(target)],
      resolvedPath,
      format: 'jsonc' as McpLocationFormat,
      bytesChanged: 0,
      reason: 'no-change',
    };
  }

  // Atomic write: temp file + rename.
  await atomicWrite(resolvedPath, newContent);

  return {
    written: patches.length,
    changed: true,
    dryRun,
    serversWritten: patches.map((p) => p.name),
    targetPaths: [targetPathFor(target)],
    resolvedPath,
    format: 'jsonc' as McpLocationFormat,
    bytesChanged: Math.abs(finalBytesLength - originalBytes.length),
  };
}
