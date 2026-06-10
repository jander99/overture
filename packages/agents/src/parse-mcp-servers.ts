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
import type { McpServerEntry } from './types.js';

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
 * defaults; windsurf needs `serverUrl` accepted as a remote URL
 * (it appears in older doc versions), and the copilot CLI family
 * uses `local`/`http` (already in defaults).
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
   * carry its own `name` field). Continue's YAML configs use this
   * shape; JSON and TOML configs are always map-shaped. Default: `false`.
   * The YAML helper forces this to `true` regardless of caller input.
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
    // YAML-list shape (continue): each item has its own `name` field.
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
 * Parse a YAML MCP config file. Used by Continue, which stores
 * server entries as a YAML list (not a map). The list shape is
 * handled by `iterateServerMap` when it sees an array at the
 * top-level key — this helper forces `allowListShape: true` so
 * the list shape is accepted (JSON and TOML helpers default to false).
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
