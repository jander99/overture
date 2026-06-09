import { readFile } from 'node:fs/promises';
import { parseMcpConfig, type McpConfigParseResult } from '../mcp-config.js';
import type { AgentDefinition, AgentMcpReadResult } from './types.js';
import type { McpLocation, PathResolutionContext } from '../types.js';

const SWALLOWED_CODES = new Set([
  'ENOENT',
  'EACCES',
  'EPERM',
  'ELOOP',
  'ENOTDIR',
]);

function isSwallowed(err: unknown): boolean {
  return (
    err instanceof Error &&
    'code' in err &&
    typeof err.code === 'string' &&
    SWALLOWED_CODES.has(err.code)
  );
}

/**
 * Resolves an `McpLocation` against a `PathResolutionContext`. Mirrors the
 * private `resolveMcpLocationPath` inside `detect.ts`; duplicated here so
 * this module is self-contained and does not require `detect.ts` to
 * export any helper. The two implementations are intentionally kept in
 * lockstep; if `detect.ts`'s resolution rules ever change, this helper
 * must change too.
 */
function resolveMcpLocationPath(
  loc: McpLocation,
  ctx: PathResolutionContext,
): string {
  switch (loc.base) {
    case 'home':
      return `${ctx.homeDir}/${loc.relativePath}`;
    case 'config':
      return `${ctx.configDir}/${loc.relativePath}`;
    case 'workspace':
      return `${ctx.workspaceDir}/${loc.relativePath}`;
    case 'absolute':
      return loc.relativePath;
    default: {
      const _exhaustive: never = loc.base;
      throw new Error(`Unsupported path base: ${String(_exhaustive)}`);
    }
  }
}

function locationIsApplicable(
  loc: McpLocation,
  ctx: PathResolutionContext,
): boolean {
  return loc.platforms === undefined || loc.platforms.includes(ctx.platform);
}

function nonEmptyContainer(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (value !== null && typeof value === 'object') {
    return Object.keys(value).length > 0;
  }
  return false;
}

function toReadResultFromParse(
  parse: McpConfigParseResult,
  resolvedPath: string,
  loc: McpLocation,
): AgentMcpReadResult<unknown> {
  const baseLocation = {
    resolvedPath,
    format: loc.format,
    ...(loc.topLevelKey !== undefined ? { topLevelKey: loc.topLevelKey } : {}),
  } as const;

  if (!parse.parsed) {
    return {
      config: null,
      nonEmpty: false,
      parseError: parse.parseError ?? 'parse error',
      location: baseLocation,
    };
  }

  if (!parse.configured) {
    return {
      config: null,
      nonEmpty: false,
      location: baseLocation,
    };
  }

  return {
    config: parse.document ?? null,
    nonEmpty: nonEmptyContainer(parse.document),
    location: baseLocation,
  };
}

/**
 * Iterates the entry's `mcpLocations` filtered by `ctx.platform`, reads
 * and parses each applicable file, and returns the first non-empty
 * result. Missing files (`ENOENT`) are silently skipped; a missing
 * top-level key or empty section is reported as `nonEmpty: false` with
 * no `parseError`. A parse error on any location short-circuits and is
 * surfaced immediately (preserving the first error encountered).
 *
 * Returns the typed `config` view that the per-agent reader casts to
 * its own `*McpConfig` shape.
 */
export async function readAgentMcpConfig(
  entry: AgentDefinition,
  ctx: PathResolutionContext,
): Promise<AgentMcpReadResult<unknown>> {
  const applicable = entry.mcpLocations.filter((loc) =>
    locationIsApplicable(loc, ctx),
  );

  if (applicable.length === 0) {
    return { config: null, nonEmpty: false };
  }

  for (const loc of applicable) {
    const resolvedPath = resolveMcpLocationPath(loc, ctx);
    let contents: string;
    try {
      contents = await readFile(resolvedPath, 'utf8');
    } catch (err) {
      if (isSwallowed(err)) {
        continue;
      }
      return {
        config: null,
        nonEmpty: false,
        parseError: `read failed: ${err instanceof Error ? err.message : String(err)}`,
        location: { resolvedPath, format: loc.format },
      };
    }
    const parse = parseMcpConfig({
      contents,
      format: loc.format,
      topLevelKey: loc.topLevelKey ?? '',
    });
    if (!parse.parsed) {
      return toReadResultFromParse(parse, resolvedPath, loc);
    }
    // The file exists at this location; report its result even if empty.
    // We do NOT fall through to the next location because that would
    // overwrite a present-but-empty file with a missing-file result,
    // which contradicts the user's "I have a config but it is empty"
    // intent.
    return toReadResultFromParse(parse, resolvedPath, loc);
  }

  return { config: null, nonEmpty: false };
}
