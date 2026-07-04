// Shared helpers used by every per-agent `parseServers` handler.
//
// Each helper reads an MCP config file at `resolvedPath`, extracts the
// server entries at the platform's top-level key/table, normalizes them
// into `McpServerEntry[]`, and returns `[]` on any read or parse failure
// (silent degradation — the CLI just omits the server list).
//
// All helpers are synchronous because the CLI's `parseServersForAgent`
// dispatches synchronously, and the underlying parsers (jsonc-parser,
// smol-toml, yaml) all support sync parse.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  parse as parseJsonc,
  type ParseError,
} from 'jsonc-parser/lib/esm/main.js';
import type { OvertureMcpServer } from '@overture/config';
import type {
  AgentNormalizedMcpServer,
  McpServerEntry,
  ServerConflict,
} from './types.js';

const localRequire = createRequire(__filename);
// Load yaml the same way smol-toml is loaded in mcp-config-parser.ts:
// as a runtime dep installed alongside @jander99/overture, loaded at
// module-init time via createRequire so the bundle stays a single file
// and consumers get the parser via `npm install`.
const yaml: { parse: (text: string) => unknown } = localRequire('yaml');
const smolToml: { parse: (text: string) => unknown } =
  localRequire('smol-toml');

/**
 * Per-agent overrides for transport inference. Most agents use the
 * defaults. The GitHub Copilot CLI uses `local`/`http` (already in
 * defaults). OpenAI Codex uses TOML with snake_case fields; that
 * is handled by the per-agent reader, not here.
 */
export interface ParseServerMapOptions {
  /** Field names that mark an entry as remote when present and string-shaped. Default: `['url']`. */
  readonly urlFields?: readonly string[];
  /** `type` values that mark an entry as remote. Default: HTTP/SSE/streamable/remote/ws. */
  readonly remoteTypes?: readonly string[];
  /** `type` values that mark an entry as local. Default: `['local', 'stdio']`. */
  readonly localTypes?: readonly string[];
  /**
   * Allow a list-shaped value at the top-level key (each item must
   * carry its own `name` field). JSON and TOML configs are always
   * map-shaped. Default: `false`. The YAML helper forces this to
   * `true` regardless of caller input.
   */
  readonly allowListShape?: boolean;
}

const DEFAULT_URL_FIELDS = ['url'] as const;
const DEFAULT_REMOTE_TYPES = [
  'http',
  'sse',
  'remote',
  'streamable-http',
  'ws',
] as const;
const DEFAULT_LOCAL_TYPES = ['local', 'stdio'] as const;

const UTF8_BOM = '\uFEFF';

function stripBom(text: string): string {
  return text.startsWith(UTF8_BOM) ? text.slice(1) : text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asStringArray(value: unknown): readonly string[] | undefined {
  if (Array.isArray(value)) {
    const strings = value.filter((v): v is string => typeof v === 'string');
    return strings.length === value.length ? strings : undefined;
  }
  return undefined;
}

function normalizeCommand(
  entry: Record<string, unknown>,
): readonly string[] | undefined {
  // OpenAI Codex uses bare `command` as a string + `args` array.
  const cmdStr = asString(entry.command);
  if (cmdStr) {
    const args = asStringArray(entry.args);
    return args ? [cmdStr, ...args] : [cmdStr];
  }
  // OpenCode uses `command` as an argv vector (no separate args).
  const cmdArr = asStringArray(entry.command);
  if (cmdArr) {
    const args = asStringArray(entry.args);
    return args ? [...cmdArr, ...args] : cmdArr;
  }
  return undefined;
}

function inferTransport(
  entry: Record<string, unknown>,
  options: Required<ParseServerMapOptions>,
): 'local' | 'remote' {
  const type = asString(entry.type);
  if (type) {
    if (options.remoteTypes.includes(type)) return 'remote';
    if (options.localTypes.includes(type)) return 'local';
    // Unknown type value: fall through to URL-field inference.
  }
  for (const field of options.urlFields) {
    if (asString(entry[field])) return 'remote';
  }
  return 'local';
}

function normalizeServerEntry(
  name: string,
  raw: unknown,
  options: Required<ParseServerMapOptions>,
): McpServerEntry | null {
  if (!isRecord(raw)) return null;
  const transport = inferTransport(raw, options);
  const urlField = options.urlFields
    .map((f) => asString(raw[f]))
    .find((v): v is string => Boolean(v));
  const command = transport === 'local' ? normalizeCommand(raw) : undefined;
  return {
    name,
    transport,
    ...(urlField ? { url: urlField } : {}),
    ...(command ? { command } : {}),
  };
}

function resolveOptions(
  options?: ParseServerMapOptions,
): Required<ParseServerMapOptions> {
  return {
    urlFields: options?.urlFields ?? DEFAULT_URL_FIELDS,
    remoteTypes: options?.remoteTypes ?? DEFAULT_REMOTE_TYPES,
    localTypes: options?.localTypes ?? DEFAULT_LOCAL_TYPES,
    allowListShape: options?.allowListShape ?? false,
  };
}

function iterateServerMap(
  document: unknown,
  topLevelKey: string,
  options: Required<ParseServerMapOptions>,
): readonly McpServerEntry[] {
  if (!isRecord(document)) return [];
  const map = document[topLevelKey];
  if (!isRecord(map) && !Array.isArray(map)) return [];

  if (Array.isArray(map)) {
    if (!options.allowListShape) {
      // JSON/TOML configs are always map-shaped; a list here is
      // almost certainly a malformed/empty config, not a YAML list.
      return [];
    }
    // YAML-list shape: each item has its own `name` field.
    const out: McpServerEntry[] = [];
    for (const item of map) {
      if (!isRecord(item)) continue;
      const itemName = asString(item.name);
      if (!itemName) continue;
      const entry = normalizeServerEntry(itemName, item, options);
      if (entry) out.push(entry);
    }
    return out;
  }

  const out: McpServerEntry[] = [];
  for (const [name, raw] of Object.entries(map)) {
    const entry = normalizeServerEntry(name, raw, options);
    if (entry) out.push(entry);
  }
  return out;
}

/**
 * Parse a JSON/JSONC MCP config file. Tolerates trailing commas,
 * line comments, and block comments. Strips a leading UTF-8 BOM.
 *
 * Returns `[]` on any read or parse failure. The top-level value is
 * always expected to be a map (not a list) — a list at the top-level
 * key returns `[]` (see `allowListShape` for the YAML-list shape).
 */
export function parseJsoncMcpServerMap(
  resolvedPath: string,
  topLevelKey: string,
  options?: ParseServerMapOptions,
): readonly McpServerEntry[] {
  const resolved = resolveOptions(options);
  try {
    const raw = readFileSync(resolvedPath, 'utf8');
    const cleaned = stripBom(raw);
    const errors: ParseError[] = [];
    const parsed: unknown = parseJsonc(cleaned, errors, {
      allowTrailingComma: true,
      disallowComments: false,
    });
    if (errors.length > 0) return [];
    return iterateServerMap(parsed, topLevelKey, resolved);
  } catch {
    return [];
  }
}

/**
 * Parse a TOML MCP config file. Strips a leading UTF-8 BOM.
 *
 * Returns `[]` on any read or parse failure. The top-level value is
 * always expected to be a map (not a list) — a list at the top-level
 * key returns `[]` (see `allowListShape` for the YAML-list shape).
 */
export function parseTomlMcpServerMap(
  resolvedPath: string,
  topLevelKey: string,
  options?: ParseServerMapOptions,
): readonly McpServerEntry[] {
  const resolved = resolveOptions(options);
  try {
    const raw = readFileSync(resolvedPath, 'utf8');
    const cleaned = stripBom(raw);
    const parsed: unknown = smolToml.parse(cleaned);
    return iterateServerMap(parsed, topLevelKey, resolved);
  } catch {
    return [];
  }
}

/**
 * Parse a YAML MCP config file. The list shape is handled by
 * `iterateServerMap` when it sees an array at the top-level key —
 * this helper forces `allowListShape: true` so the list shape is
 * accepted (JSON and TOML helpers default to false).
 *
 * Returns `[]` on any read or parse failure.
 */
export function parseYamlMcpServerList(
  resolvedPath: string,
  topLevelKey: string,
  options?: ParseServerMapOptions,
): readonly McpServerEntry[] {
  // YAML is the one format where the top-level value can be a list
  // (Continue's standalone config), so opt in to list handling here.
  const resolved = { ...resolveOptions(options), allowListShape: true };
  try {
    const raw = readFileSync(resolvedPath, 'utf8');
    const cleaned = stripBom(raw);
    const parsed: unknown = yaml.parse(cleaned);
    return iterateServerMap(parsed, topLevelKey, resolved);
  } catch {
    return [];
  }
}

/**
 * Parse an opencode MCP config file. Thin wrapper over
 * `parseJsoncMcpServerMap` that pins the top-level key to `'mcp'`
 * (opencode uses `mcp`, not the more common `mcpServers`).
 *
 * Opencode's config is JSON/JSONC. The shared helper already handles
 * the `command: string | readonly string[]` polymorphism opencode
 * expects, so no extra normalization is needed.
 *
 * Returns `[]` on any read or parse failure.
 */
export function parseOpenCodeMcpServerMap(
  resolvedPath: string,
): readonly McpServerEntry[] {
  return parseJsoncMcpServerMap(resolvedPath, 'mcp');
}

// ---------------------------------------------------------------------------
// F3 canonical settings drift detection.
//
// `detectCanonicalSettingsDrift` is the pure helper that lifts the B3
// 'canonical-settings-drift' classification into the write path. Each
// per-agent writer invokes it during Pass 1 (after the existing target
// read + B2 normalization completes, before byte-level planning) with
// two `ReadonlyMap<serverName, AgentNormalizedMcpServer>` arguments:
// - `existing`:  the existing target entries, already normalized
//                (B2 funnel output, keyed by server name)
// - `canonical`: the canonical intent entries, already normalized
//                (B2 funnel output, keyed by server name)
//
// The helper returns ONE `ServerConflict` per same-name pair where the
// normalized canonical fields differ. Missing entries (key present in
// only one map) are NOT conflicts — the writer handles new-entry paths.
// Entries with `state === 'shape-conflict'` are skipped here; their
// refusal surfaces via the writer's existing `WriteReason` path, not F3.
//
// `AgentNormalizedMcpServer` itself carries NO server-name field
// (memory 114), so the map key is the only authoritative identifier.
// The helper never relies on array index order to identify a server
// name (silent-pass risk per memory 113, F2 PR #133 retro).
//
// Pure: no fs, no async, no per-agent-specific imports.
// Deterministic: same inputs produce deeply equal output.
// JSON-serializable: no functions, no class instances in messages.
// ---------------------------------------------------------------------------

/**
 * Compare two normalized MCP server maps and emit one
 * `ServerConflict` per same-name pair whose canonical fields differ.
 *
 * Both arguments are `ReadonlyMap<serverName, AgentNormalizedMcpServer>`
 * — the map key is the authoritative server name (memory 114).
 * Output is sorted ascending by `serverName`; `diffKeys` is sorted
 * ascending within each conflict.
 *
 * Comparator semantics (anti-silent-pass per memory 113):
 * - `args` (string array): order is SIGNIFICANT.
 * - `env` / `headers` (Record<string, string>): key insertion order
 *   is INSIGNIFICANT — equivalent key→string maps compare equal.
 * - `undefined` vs `undefined`: NOT a diff.
 * - `undefined` vs `[]` / `{}`: IS a diff (missing vs empty).
 * - No implicit coercion: numbers vs numeric strings are distinct;
 *   `null` and `undefined` are distinct when both are legal.
 *
 * No `JSON.stringify` equality — would conflate `env` / `headers`
 * insertion order with content (F2 retro silent-pass risk).
 */
export function detectCanonicalSettingsDrift(
  existing: ReadonlyMap<string, AgentNormalizedMcpServer>,
  canonical: ReadonlyMap<string, AgentNormalizedMcpServer>,
): readonly ServerConflict[] {
  // Iterate the intersection of keys, sorted ascending. We pick
  // the smaller map's keys as the outer loop to avoid allocating
  // the full intersection array, then sort the resulting array.
  const intersectKeys: string[] = [];
  const [outer, inner] =
    existing.size <= canonical.size
      ? [existing, canonical]
      : [canonical, existing];
  for (const name of outer.keys()) {
    if (inner.has(name)) intersectKeys.push(name);
  }
  intersectKeys.sort();

  const out: ServerConflict[] = [];
  for (const serverName of intersectKeys) {
    const leftEntry = existing.get(serverName);
    const rightEntry = canonical.get(serverName);
    // Defensive: the intersection loop already filters on `inner.has`,
    // so both lookups must succeed. The `!` non-null assertion would
    // be flagged by the lint config; fall through silently instead.
    if (!leftEntry || !rightEntry) continue;
    // Skip non-normalized entries on either side — their refusal
    // surfaces via the writer's existing `WriteReason` path, not F3.
    if (leftEntry.state !== 'normalized' || rightEntry.state !== 'normalized') {
      continue;
    }
    const diffKeys = compareNormalizedServers(
      leftEntry.server,
      rightEntry.server,
    );
    if (diffKeys.length === 0) continue;
    out.push({
      serverName,
      message:
        `Refusing to continue for server "${serverName}": ` +
        `canonical and agent settings differ. ` +
        `Update the canonical config or the agent config and retry.`,
      diffKeys,
    });
  }
  return out;
}

/**
 * Walk the canonical fields of two normalized server entries and
 * return the sorted list of field names whose values differ. Order-
 * significant for arrays (`args`); order-insignificant for record
 * maps (`env`, `headers`).
 */
function compareNormalizedServers(
  left: OvertureMcpServer,
  right: OvertureMcpServer,
): readonly string[] {
  const diffs = new Set<string>();

  // Discriminator is always present on both branches.
  if (left.type !== right.type) diffs.add('type');

  // Branch-specific fields. When the two sides pick different
  // transports, the side that doesn't carry a branch-specific field
  // contributes `undefined`, and the comparator flags the mismatch
  // as a diff (a transport switch IS a multi-field drift).
  const leftCommand = left.type === 'stdio' ? left.command : undefined;
  const rightCommand = right.type === 'stdio' ? right.command : undefined;
  if (leftCommand !== rightCommand) diffs.add('command');

  const leftArgs = left.type === 'stdio' ? left.args : undefined;
  const rightArgs = right.type === 'stdio' ? right.args : undefined;
  if (!arraysEqualOrderSignificant(leftArgs, rightArgs)) diffs.add('args');

  const leftEnv = left.type === 'stdio' ? left.env : undefined;
  const rightEnv = right.type === 'stdio' ? right.env : undefined;
  if (!recordEqualOrderInsignificant(leftEnv, rightEnv)) diffs.add('env');

  const leftUrl = left.type === 'remote' ? left.url : undefined;
  const rightUrl = right.type === 'remote' ? right.url : undefined;
  if (leftUrl !== rightUrl) diffs.add('url');

  const leftHeaders = left.type === 'remote' ? left.headers : undefined;
  const rightHeaders = right.type === 'remote' ? right.headers : undefined;
  if (!recordEqualOrderInsignificant(leftHeaders, rightHeaders)) {
    diffs.add('headers');
  }

  return Array.from(diffs).sort();
}

/**
 * Order-significant array equality. Treats two `undefined` values
 * as equal (the canonical schema makes `args` optional). `null` and
 * `undefined` are distinct.
 */
function arraysEqualOrderSignificant(left: unknown, right: unknown): boolean {
  if (left === undefined && right === undefined) return true;
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

/**
 * Order-insignificant record equality. Treats two `undefined` values
 * as equal (the canonical schema makes `env`/`headers` optional).
 * Key insertion order does NOT affect equality.
 */
function recordEqualOrderInsignificant(left: unknown, right: unknown): boolean {
  if (left === undefined && right === undefined) return true;
  if (!isPlainRecord(left) || !isPlainRecord(right)) return false;
  const lKeys = Object.keys(left).sort();
  const rKeys = Object.keys(right).sort();
  if (lKeys.length !== rKeys.length) return false;
  for (let i = 0; i < lKeys.length; i++) {
    const k = lKeys[i];
    if (k === undefined || rKeys[i] === undefined) return false;
    if (k !== rKeys[i]) return false;
    if (left[k] !== right[k]) return false;
  }
  return true;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
