/**
 * OpenAI Codex MCP writer helpers (E4 slice).
 *
 * Pure helpers: no I/O, no FS. The actual `writeOpenAICodexMcpConfig`
 * function lives in this file too per the plan, but Todo 5 will add
 * the FS orchestration (path resolution, splice mechanics, registry
 * wiring). For this todo the module only exports the deterministic
 * conversion + render helpers and their types.
 *
 * Two public surfaces:
 *
 *  - `toOpenAICodexMcpServer(canonical, existing?)` converts a canonical
 *    `OvertureMcpServer` into the native Codex entry shape, preserving
 *    compatible extension fields from `existing`. It is total over
 *    valid native entries: unsupported extension shapes throw
 *    `UnsupportedCodexExtensionShapeError`, which the writer (Todo 5)
 *    catches and surfaces as `reason: 'unsupported-shape'`.
 *
 *  - `renderCodexServerBlock(name, server)` produces a deterministic
 *    TOML block for the rewritten server subtree. The output ends with
 *    a single trailing newline so it can be dropped into the byte
 *    range the splice helper computes.
 */
import type { OvertureMcpServer } from '@overture/config';
import {
  normalizeOpenAICodexMcpServers,
  type OpenAICodexMcpConfig,
} from './openai-codex.js';
import { normalized } from './normalize-mcp-config.js';
import { detectCanonicalSettingsDrift } from './parse-mcp-servers.js';
import { parseTomlHeaderPath as parseCodexHeaderPath } from './toml/header-path.js';

// ---------------------------------------------------------------------------
// Sentinel for unsupported extension shapes
// ---------------------------------------------------------------------------

/**
 * Thrown by `toOpenAICodexMcpServer` when an existing native entry
 * contains a value whose shape is not part of the supported Codex
 * extension set, and by `renderCodexServerBlock` when a value cannot
 * be emitted deterministically.
 *
 * The writer (Todo 5) catches this and surfaces it as
 * `reason: 'unsupported-shape'` in the `AgentMcpWriteResult`.
 *
 * Per the E4 spec, the rejection cases are:
 *  - arrays on non-known fields (only `args`, `env_vars`,
 *    `enabled_tools`, `disabled_tools`, `scopes` are accepted as arrays)
 *  - arrays containing non-string elements
 *  - maps on non-known fields (only `env`, `http_headers`,
 *    `env_http_headers` are accepted as maps)
 *  - maps containing non-string values
 *  - explicit `null`
 *  - any value the renderer cannot emit deterministically
 */
export class UnsupportedCodexExtensionShapeError extends Error {
  readonly #key: string;
  readonly #value: unknown;

  constructor(message: string, key: string, value: unknown) {
    super(message);
    this.name = 'UnsupportedCodexExtensionShapeError';
    this.#key = key;
    this.#value = value;
  }

  /** The offending extension key (or canonical key, in the render path). */
  get key(): string {
    return this.#key;
  }

  /** The offending value, captured for the writer's diagnostic context. */
  get value(): unknown {
    return this.#value;
  }
}

// ---------------------------------------------------------------------------
// Public type: native Codex writable server entry
// ---------------------------------------------------------------------------

/**
 * Native OpenAI Codex server entry that `toOpenAICodexMcpServer`
 * produces and `renderCodexServerBlock` accepts.
 *
 * Field names mirror the documented TOML keys (`env_vars`,
 * `startup_timeout_sec`, `tool_timeout_sec`, `enabled_tools`,
 * `disabled_tools`, `oauth_resource`, `required`, `enabled`,
 * `bearer_token_env_var`, `http_headers`, `env_http_headers`).
 * All fields are optional; the transport is implied by the presence
 * of `command` (stdio) or `url` (remote).
 *
 * The open index signature allows transport-agnostic scalar extension
 * fields the user may have added to their config (for example, an
 * undocumented flag Codex recognizes). Arrays and maps are restricted
 * to the known field set; everything else throws
 * `UnsupportedCodexExtensionShapeError` at conversion time.
 */
export type OpenAICodexWritableMcpServer = {
  /** Stdio: command to spawn. Remote servers omit this. */
  command?: string;
  /** Stdio: command-line arguments. */
  args?: string[];
  /** Stdio: inline environment variables as a string map. */
  env?: Record<string, string>;
  /** Stdio: names of environment variables to forward from the parent process. */
  env_vars?: string[];
  /** Stdio: working directory for the server process. */
  cwd?: string;
  /** Stdio: startup timeout in seconds. */
  startup_timeout_sec?: number;
  /** Per-tool invocation timeout in seconds. */
  tool_timeout_sec?: number;
  /** Allowlist of tool names this server exposes. */
  enabled_tools?: string[];
  /** Blocklist of tool names this server exposes. */
  disabled_tools?: string[];
  /** OAuth scopes to request for this server. */
  scopes?: string[];
  /** OAuth resource URL the client should target. */
  oauth_resource?: string;
  /** Whether this server is required by the agent. */
  required?: boolean;
  /** Whether this server is enabled. */
  enabled?: boolean;
  /** Remote: URL the MCP client connects to. */
  url?: string;
  /** Remote: environment variable name holding the bearer token. */
  bearer_token_env_var?: string;
  /** Remote: static HTTP headers attached to requests. */
  http_headers?: Record<string, string>;
  /** Remote: HTTP headers sourced from environment variables. */
  env_http_headers?: Record<string, string>;
  /** Index signature for transport-agnostic scalar extension fields. */
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Field classification sets
// ---------------------------------------------------------------------------

/** Canonical stdio fields populated from the OvertureMcpServer stdio shape. */
const STDIO_CANONICAL_FIELDS: ReadonlySet<string> = new Set([
  'command',
  'args',
  'env',
]);

/** Canonical remote fields populated from the OvertureMcpServer remote shape. */
const REMOTE_CANONICAL_FIELDS: ReadonlySet<string> = new Set([
  'url',
  'http_headers',
]);

/**
 * Stdio-only fields dropped on a stdio→remote transport switch.
 * Includes the canonical stdio fields plus stdio-only extensions.
 */
const STDIO_ONLY_FIELDS: ReadonlySet<string> = new Set([
  'command',
  'args',
  'env',
  'env_vars',
  'cwd',
]);

/**
 * Remote-only fields dropped on a remote→stdio transport switch.
 * Includes the canonical remote fields plus remote-only extensions.
 */
const REMOTE_ONLY_FIELDS: ReadonlySet<string> = new Set([
  'url',
  'bearer_token_env_var',
  'http_headers',
  'env_http_headers',
]);

/** Known Codex fields that accept an inline array of strings. */
const KNOWN_STRING_ARRAY_FIELDS: ReadonlySet<string> = new Set([
  'args',
  'env_vars',
  'enabled_tools',
  'disabled_tools',
  'scopes',
]);

/** Known Codex fields that accept an inline map of string→string. */
const KNOWN_STRING_MAP_FIELDS: ReadonlySet<string> = new Set([
  'env',
  'http_headers',
  'env_http_headers',
]);

// ---------------------------------------------------------------------------
// Conversion: canonical OvertureMcpServer → native Codex entry
// ---------------------------------------------------------------------------

/**
 * Convert a canonical `OvertureMcpServer` into a native Codex entry.
 *
 *  - stdio canonical → `{ command, args?, env? }` plus stdio-compatible
 *    extension fields preserved from `existing`.
 *  - remote canonical → `{ url, http_headers? }` plus remote-compatible
 *    extension fields preserved from `existing`.
 *
 * Transport switch cleanup (per the E4 spec):
 *  - stdio → remote drops `command`, `args`, `env`, `env_vars`, `cwd`.
 *  - remote → stdio drops `url`, `bearer_token_env_var`, `http_headers`,
 *    `env_http_headers`.
 *
 * Extension validation:
 *  - Scalar values (string / number / boolean) on any key pass through.
 *  - Arrays are accepted only on known string-array fields (`args`,
 *    `env_vars`, `enabled_tools`, `disabled_tools`, `scopes`) when
 *    every element is a string.
 *  - Maps are accepted only on known string-map fields (`env`,
 *    `http_headers`, `env_http_headers`) when every value is a string.
 *  - Anything else throws `UnsupportedCodexExtensionShapeError`.
 *
 * The output preserves canonical field order first (always:
 * `command, [args], [env]` for stdio; `url, [http_headers]` for
 * remote) followed by extension fields in the order they appear on
 * `existing`. That ordering is what lets the writer's no-change
 * detection use a stable `JSON.stringify` equality check.
 */
export function toOpenAICodexMcpServer(
  server: OvertureMcpServer,
  existing?: OpenAICodexWritableMcpServer,
): OpenAICodexWritableMcpServer {
  const base: Record<string, unknown> = {};
  if (server.type === 'stdio') {
    base['command'] = server.command;
    if (server.args !== undefined) {
      base['args'] = server.args;
    }
    if (server.env !== undefined) {
      base['env'] = server.env;
    }
  } else {
    base['url'] = server.url;
    if (server.headers !== undefined) {
      base['http_headers'] = server.headers;
    }
  }

  const extensions: Record<string, unknown> = {};
  if (existing !== undefined) {
    for (const key of Object.keys(existing)) {
      const value = existing[key];
      if (value === undefined) {
        continue;
      }
      // Skip canonical fields: they are sourced from the canonical
      // input and must not be duplicated as extensions. Skipping them
      // also means transport-switch cleanup of `command`/`url`/etc. is
      // implicit — the canonical fields only appear when the target
      // transport is the same as the canonical's `type`.
      const isCanonical =
        server.type === 'stdio'
          ? STDIO_CANONICAL_FIELDS.has(key)
          : REMOTE_CANONICAL_FIELDS.has(key);
      if (isCanonical) {
        continue;
      }
      // Transport switch cleanup: drop incompatible transport fields.
      if (server.type === 'remote' && STDIO_ONLY_FIELDS.has(key)) {
        continue;
      }
      if (server.type === 'stdio' && REMOTE_ONLY_FIELDS.has(key)) {
        continue;
      }
      // Validate and add extension.
      validateCodexExtensionValue(key, value);
      extensions[key] = value;
    }
  }

  return { ...base, ...extensions };
}

function validateCodexExtensionValue(key: string, value: unknown): void {
  if (value === null) {
    throw new UnsupportedCodexExtensionShapeError(
      `OpenAI Codex extension "${key}" is null; null values are not supported`,
      key,
      value,
    );
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return;
  }
  if (Array.isArray(value)) {
    if (!KNOWN_STRING_ARRAY_FIELDS.has(key)) {
      throw new UnsupportedCodexExtensionShapeError(
        `OpenAI Codex extension "${key}" is an array but is not a known Codex string-array field`,
        key,
        value,
      );
    }
    for (let i = 0; i < value.length; i++) {
      if (typeof value[i] !== 'string') {
        throw new UnsupportedCodexExtensionShapeError(
          `OpenAI Codex extension "${key}" contains a non-string array element at index ${i}`,
          key,
          value,
        );
      }
    }
    return;
  }
  if (typeof value === 'object') {
    if (!KNOWN_STRING_MAP_FIELDS.has(key)) {
      throw new UnsupportedCodexExtensionShapeError(
        `OpenAI Codex extension "${key}" is a map but is not a known Codex string-map field`,
        key,
        value,
      );
    }
    for (const [subKey, subValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (typeof subValue !== 'string') {
        throw new UnsupportedCodexExtensionShapeError(
          `OpenAI Codex extension "${key}" contains a non-string inline-table value at "${subKey}"`,
          key,
          value,
        );
      }
    }
    return;
  }
  throw new UnsupportedCodexExtensionShapeError(
    `OpenAI Codex extension "${key}" has unsupported value type: ${typeof value}`,
    key,
    value,
  );
}

// ---------------------------------------------------------------------------
// Render: native Codex entry → deterministic TOML block
// ---------------------------------------------------------------------------

/**
 * Render a native Codex server entry as a deterministic TOML block.
 *
 * Output shape:
 *  - One `[mcp_servers.<name>]` header.
 *  - One `key = value` line per non-undefined key, in the order keys
 *    appear on `server`.
 *  - Strings: double-quoted with TOML basic escaping (`\\`, `\"`).
 *  - Booleans: literal `true` / `false`.
 *  - Numbers: emitted as-is via `String(value)`.
 *  - String arrays: TOML inline arrays `["a", "b"]`.
 *  - String maps (`env`, `http_headers`, `env_http_headers`): TOML
 *    inline tables `{ KEY = "value" }`.
 *  - Extension scalar values (number / bool / string) on any other
 *    key: emitted as-is.
 *  - Arrays or maps on unknown fields throw
 *    `UnsupportedCodexExtensionShapeError`.
 *
 * The returned string ends with exactly one trailing newline so the
 * writer can splice it directly into the target line range.
 */
export function renderCodexServerBlock(
  name: string,
  server: OpenAICodexWritableMcpServer,
): string {
  const lines: string[] = [];
  lines.push(`[mcp_servers.${name}]`);
  for (const key of Object.keys(server)) {
    const value = server[key];
    if (value === undefined) {
      continue;
    }
    lines.push(`${key} = ${renderCodexValue(key, value)}`);
  }
  return `${lines.join('\n')}\n`;
}

function renderCodexValue(key: string, value: unknown): string {
  if (typeof value === 'string') {
    return renderCodexString(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return renderCodexInlineArray(key, value);
  }
  if (typeof value === 'object' && value !== null) {
    return renderCodexInlineTable(key, value as Record<string, unknown>);
  }
  throw new UnsupportedCodexExtensionShapeError(
    `OpenAI Codex value for "${key}" cannot be rendered as TOML (type: ${typeof value})`,
    key,
    value,
  );
}

function renderCodexString(value: string): string {
  // TOML basic string escaping covers the universal escapes; for the
  // minimal contract the E4 spec calls out (`\\` and `\"`), we only
  // emit those. Control characters and Unicode escapes are out of
  // scope for this helper; the writer surfaces upstream refusal if
  // such values appear in canonical or extension inputs.
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function renderCodexInlineArray(
  key: string,
  items: readonly unknown[],
): string {
  const rendered: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (typeof item !== 'string') {
      throw new UnsupportedCodexExtensionShapeError(
        `OpenAI Codex value for "${key}" contains a non-string array element at index ${i}`,
        key,
        items,
      );
    }
    rendered.push(renderCodexString(item));
  }
  return `[${rendered.join(', ')}]`;
}

function renderCodexInlineTable(
  key: string,
  obj: Record<string, unknown>,
): string {
  const rendered: string[] = [];
  for (const subKey of Object.keys(obj)) {
    const subValue = obj[subKey];
    if (typeof subValue !== 'string') {
      throw new UnsupportedCodexExtensionShapeError(
        `OpenAI Codex value for "${key}" contains a non-string inline-table value at "${subKey}"`,
        key,
        obj,
      );
    }
    rendered.push(`${subKey} = ${renderCodexString(subValue)}`);
  }
  return `{ ${rendered.join(', ')} }`;
}

// ---------------------------------------------------------------------------
// Writer: file orchestration + byte-level splice
// ---------------------------------------------------------------------------

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { atomicWrite } from './writers/lib/atomic-write.js';
import {
  pickCodexWriteTarget,
  targetPathFor,
  type CodexWriteTarget,
} from './openai-codex-write-helpers.js';
import type {
  AgentMcpReadResult,
  AgentMcpWriteInput,
  AgentMcpWriteResult,
  AgentNormalizedMcpServer,
  McpLocationFormat,
  PathResolutionContext,
  WriteReason,
} from './types.js';

/**
 * smol-toml loaded at module-init time via `createRequire` so the
 * bundle can resolve the dependency the same way `parse-mcp-servers.ts`
 * and `writer-preservation/checks.ts` already do. Consumers running
 * `npm install @jander99/overture` get `smol-toml` alongside as a
 * declared runtime dependency.
 */
const smolTomlCjsModule = createRequire(__filename)('smol-toml') as {
  parse: (text: string) => unknown;
};

/**
 * Pattern that detects any textual reference to `mcp_servers` outside
 * of a top-level `[mcp_servers]` table header. Matches:
 *  - descendant headers: `[mcp_servers.foo]`, `[mcp_servers."q"]`,
 *    `[mcp_servers.foo.env]`
 *  - inline assignments: `mcp_servers = "x"`, `mcp_servers = {...}`,
 *    `mcp_servers = [...]`
 *
 * Used to distinguish "no MCP servers block in this file"
 * (`not-targetable`) from "mcp_servers exists but in the wrong
 * shape/position" (`unsupported-shape`).
 */
const NON_TOP_LEVEL_MCP_SERVERS_REFERENCE =
  /^\s*(?:\[\s*mcp_servers(?:\.[^\]]*)?\s*\]|mcp_servers\s*=)/m;

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isEnoent(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as Record<string, unknown>)['code'] === 'string' &&
    (err as Record<string, string>)['code'] === 'ENOENT'
  );
}

type Target = Exclude<CodexWriteTarget, { kind: 'none' }>;

function notTargetableResult(
  dryRun: boolean,
  target: Target,
): AgentMcpWriteResult {
  return {
    written: 0,
    changed: false,
    dryRun,
    serversWritten: [],
    targetPaths: [targetPathFor(target)],
    resolvedPath: target.path,
    format: 'toml' as McpLocationFormat,
    reason: 'not-targetable' as WriteReason,
  };
}

function parseErrorResult(
  dryRun: boolean,
  target: Target,
): AgentMcpWriteResult {
  return {
    written: 0,
    changed: false,
    dryRun,
    serversWritten: [],
    targetPaths: [targetPathFor(target)],
    resolvedPath: target.path,
    format: 'toml' as McpLocationFormat,
    reason: 'parse-error' as WriteReason,
  };
}

function unsupportedShapeResult(
  dryRun: boolean,
  target: Target,
): AgentMcpWriteResult {
  return {
    written: 0,
    changed: false,
    dryRun,
    serversWritten: [],
    targetPaths: [targetPathFor(target)],
    resolvedPath: target.path,
    format: 'toml' as McpLocationFormat,
    reason: 'unsupported-shape' as WriteReason,
  };
}

function noChangeResult(dryRun: boolean, target: Target): AgentMcpWriteResult {
  return {
    written: 0,
    changed: false,
    dryRun,
    serversWritten: [],
    targetPaths: [targetPathFor(target)],
    resolvedPath: target.path,
    format: 'toml' as McpLocationFormat,
    bytesChanged: 0,
    reason: 'no-change' as WriteReason,
  };
}

/**
 * Compute the byte range `[startByte, endByte)` for a half-open
 * line range in `text`. Splits on `\n` and treats the last segment
 * as a (possibly empty) trailing fragment that has no newline.
 */
function lineRangeToByteRange(
  text: string,
  startLine: number,
  endLine: number,
): readonly [number, number] {
  const lines = text.split('\n');
  if (startLine < 0 || endLine > lines.length || startLine > endLine) {
    throw new Error(`Invalid line range [${startLine}, ${endLine})`);
  }
  let startByte = startLine;
  for (let i = 0; i < startLine; i++) {
    startByte += lines[i]!.length;
  }
  let endByte = endLine;
  for (let i = 0; i < endLine; i++) {
    endByte += lines[i]!.length;
  }
  return [startByte, endByte] as const;
}

/**
 * Find the contiguous line range covering the table whose header
 * segments are exactly `[parent, child]`, plus any descendant
 * subtables whose first two segments also match. Returns
 * `[startLine, endLine)` (half-open), or `null` if no matching
 * header was found.
 *
 * Mirrors the semantics of `findTomlTargetPathLineRange` from
 * `writer-preservation/checks.ts` so the writer's splice math stays
 * consistent with the preservation harness's view of the same
 * subtree.
 */
function findCodexServerLineRange(
  text: string,
  serverName: string,
): readonly [number, number] | null {
  const lines = text.split('\n');
  const parent = 'mcp_servers';
  let startLine = -1;
  let endLine = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (startLine === -1) {
      const path = parseCodexHeaderPath(line);
      if (
        path !== null &&
        path.length >= 2 &&
        path[0] === parent &&
        path[1] === serverName
      ) {
        startLine = i;
        continue;
      }
    } else {
      const path = parseCodexHeaderPath(line);
      if (path === null) continue; // non-header line, include in range
      const isDescendant =
        path.length > 2 && path[0] === parent && path[1] === serverName;
      if (!isDescendant) {
        endLine = i;
        break;
      }
    }
  }
  if (startLine === -1) return null;
  return [startLine, endLine] as const;
}

/**
 * Self-contained Codex MCP writer.
 *
 * Carries its own path resolution via `pickCodexWriteTarget`, refuses
 * to create missing files, parses the target TOML with `smol-toml`
 * for shape validation only (the byte-level splice happens on the
 * original text), and writes via same-directory temp file + rename
 * to keep the on-disk swap atomic.
 *
 * The writer is update-only: every requested server name must
 * already exist under `mcp_servers` in the target document. New
 * servers, deletions, and shape changes that create non-contiguous
 * descendant layouts are all rejected.
 */
export async function writeOpenAICodexMcpConfig(
  ctx: PathResolutionContext,
  input: AgentMcpWriteInput,
): Promise<AgentMcpWriteResult> {
  const dryRun = input.dryRun ?? false;

  const target = await pickCodexWriteTarget(ctx);
  if (target.kind === 'none') {
    return {
      written: 0,
      changed: false,
      dryRun,
      serversWritten: [],
      targetPaths: [],
      reason: 'not-targetable' as WriteReason,
    };
  }

  // Read the target file (UTF-8). Surface ENOENT as not-targetable.
  let originalText: string;
  try {
    originalText = await readFile(target.path, 'utf-8');
  } catch (err) {
    if (isEnoent(err)) {
      return notTargetableResult(dryRun, target);
    }
    throw err;
  }

  if (originalText.length === 0 || originalText.trim() === '') {
    return notTargetableResult(dryRun, target);
  }

  // Parse for shape validation only. The actual splice runs on the
  // original bytes so comments, key order, and unrelated top-level
  // keys survive unchanged.
  let parsed: unknown;
  try {
    parsed = smolTomlCjsModule.parse(originalText);
  } catch {
    return parseErrorResult(dryRun, target);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return unsupportedShapeResult(dryRun, target);
  }

  const doc = parsed as Record<string, unknown>;
  const mcpServers = doc['mcp_servers'];
  if (mcpServers === undefined) {
    // Distinguish "no mcp_servers block anywhere" (not-targetable)
    // from "mcp_servers present but in the wrong shape/position"
    // (unsupported-shape). The non-top-level reference scan covers
    // inline-table assignments, scalar assignments, and nested
    // `[mcp_servers.X]` headers that smol-toml parses under a
    // parent section instead of at the document root.
    if (NON_TOP_LEVEL_MCP_SERVERS_REFERENCE.test(originalText)) {
      return unsupportedShapeResult(dryRun, target);
    }
    return notTargetableResult(dryRun, target);
  }
  if (
    typeof mcpServers !== 'object' ||
    mcpServers === null ||
    Array.isArray(mcpServers)
  ) {
    return unsupportedShapeResult(dryRun, target);
  }

  const mcpServersObj = mcpServers as Record<string, unknown>;

  // F3 conflict detection: build the existing normalized map from
  // the parsed `[mcp_servers.<name>]` TOML tables, compare against
  // the canonical input, and refuse when any same-name pair differs
  // in normalized shape. Detector invocation order is fixed per the
  // F3 design contract: read → parse / shape-validate → normalize →
  // compare → refuse-or-proceed. Runs AFTER TOML parse + shape
  // validation and the update-only existence check, BEFORE any
  // per-server patch building so the writer never reads-then-rewrites
  // a divergent entry.
  const existingRead: AgentMcpReadResult<OpenAICodexMcpConfig> = {
    config: {
      mcp_servers: mcpServersObj as OpenAICodexMcpConfig['mcp_servers'],
    },
    nonEmpty: Object.keys(mcpServersObj).length > 0,
  };
  const existingNormalizedRecord = normalizeOpenAICodexMcpServers(existingRead);
  const existingMap = new Map<string, AgentNormalizedMcpServer>(
    Object.entries(existingNormalizedRecord),
  );
  const canonicalMap = new Map<string, AgentNormalizedMcpServer>(
    input.servers.map((s) => [s.name, normalized(s.server)]),
  );
  const conflicts = detectCanonicalSettingsDrift(existingMap, canonicalMap);
  if (conflicts.length > 0) {
    return {
      written: 0,
      changed: false,
      dryRun,
      serversWritten: [],
      targetPaths: [targetPathFor(target)],
      resolvedPath: target.path,
      format: 'toml' as McpLocationFormat,
      conflicts,
    };
  }

  // Update-only: every requested server must already exist in the
  // target document. Missing names are rejected with not-targetable
  // so callers do not silently create new server tables.
  for (const entry of input.servers) {
    if (!Object.prototype.hasOwnProperty.call(mcpServersObj, entry.name)) {
      return notTargetableResult(dryRun, target);
    }
  }

  // Non-contiguous descendant check: any `[mcp_servers.<serverName>.<X>]` header
  // that lies outside the server's contiguous range would be orphaned by a
  // splice, so reject the entire write as unsupported-shape.
  for (const entry of input.servers) {
    const range = findCodexServerLineRange(originalText, entry.name);
    if (range === null) continue;
    const [startLine, endLine] = range;
    const lines = originalText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (i >= startLine && i < endLine) continue;
      const path = parseCodexHeaderPath(lines[i]!);
      if (
        path !== null &&
        path.length > 2 &&
        path[0] === 'mcp_servers' &&
        path[1] === entry.name
      ) {
        return unsupportedShapeResult(dryRun, target);
      }
    }
  }

  // Build the native entries for each requested server, preserving
  // compatible extension fields from the existing native entry.
  // Track only the entries that actually change so unchanged
  // writes do not bump the `written` counter.
  // compatible extension fields from the existing native entry.
  // Track only the entries that actually change so unchanged
  // writes do not bump the `written` counter.
  const patches = new Map<string, OpenAICodexWritableMcpServer>();
  const touched: string[] = [];
  for (const entry of input.servers) {
    const existing = mcpServersObj[entry.name] as
      | OpenAICodexWritableMcpServer
      | undefined;
    let native: OpenAICodexWritableMcpServer;
    try {
      native = toOpenAICodexMcpServer(entry.server, existing);
    } catch (err) {
      if (err instanceof UnsupportedCodexExtensionShapeError) {
        return unsupportedShapeResult(dryRun, target);
      }
      throw err;
    }
    if (existing !== undefined && deepEqual(existing, native)) {
      continue;
    }
    patches.set(entry.name, native);
    touched.push(entry.name);
  }

  if (touched.length === 0) {
    return noChangeResult(dryRun, target);
  }

  // Splice each touched server subtree. Process in descending source
  // order so an earlier splice cannot invalidate the line indices
  // a later splice depends on.
  let workingText = originalText;
  const spliceJobs: { name: string; startLine: number; endLine: number }[] = [];
  for (const name of touched) {
    const range = findCodexServerLineRange(workingText, name);
    if (range === null) {
      // Should not happen: we confirmed the server exists above.
      // Surface as not-targetable so we never silently drop a patch.
      return notTargetableResult(dryRun, target);
    }
    spliceJobs.push({ name, startLine: range[0], endLine: range[1] });
  }
  spliceJobs.sort((a, b) => b.startLine - a.startLine);

  for (const job of spliceJobs) {
    const native = patches.get(job.name);
    if (native === undefined) {
      // Defensive: every job has a patch above.
      return notTargetableResult(dryRun, target);
    }
    const newBlock = renderCodexServerBlock(job.name, native);
    const [startByte, endByte] = lineRangeToByteRange(
      workingText,
      job.startLine,
      job.endLine,
    );
    workingText =
      workingText.slice(0, startByte) + newBlock + workingText.slice(endByte);
  }

  if (workingText === originalText) {
    return noChangeResult(dryRun, target);
  }

  if (!dryRun) {
    await atomicWrite(target.path, workingText);
  }

  const originalByteLength = Buffer.byteLength(originalText, 'utf-8');
  const nextByteLength = Buffer.byteLength(workingText, 'utf-8');
  return {
    written: touched.length,
    changed: true,
    dryRun,
    serversWritten: touched,
    targetPaths: [targetPathFor(target)],
    resolvedPath: target.path,
    format: 'toml' as McpLocationFormat,
    bytesChanged: Math.abs(nextByteLength - originalByteLength),
  };
}
