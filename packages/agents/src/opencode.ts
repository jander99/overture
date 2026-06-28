// OpenCode agent definition.
import { parseOpenCodeMcpServerMap } from './parse-mcp-servers.js';
import { opencodeWriteMcpConfig } from './opencode-write.js';
import { readAgentMcpConfig } from './read-mcp-config.js';
import { defineAgent } from './define-agent.js';
import {
  asRegistryNormalizeHandler,
  isRecord,
  normalizeOptionalArgs,
  normalizeOptionalEnv,
  normalizeOptionalHeaders,
  normalized,
  shapeConflict,
} from './normalize-mcp-config.js';
import type { OvertureMcpServer } from '@overture/config';
import type {
  AgentDefinition,
  AgentMcpNormalizeHandler,
  AgentMcpParseServersHandler,
  AgentNormalizedMcpServer,
  OAuthConfig,
  StringMap,
  AgentMcpReadResult,
} from './types.js';

import type { PathResolutionContext } from './types.js';
/**
 * Discriminated union of MCP server entries supported by OpenCode's
 * `mcp` config. The `type` field selects the transport:
 * - `'local'`  - command spawned as a subprocess; `command` is an argv vector.
 * - `'remote'` - URL-based transport (HTTP, SSE, etc.).
 */
export type OpenCodeMcpServer =
  | {
      type: 'local';
      command: readonly string[];
      environment?: StringMap;
      enabled?: boolean;
      timeout?: number;
      oauth?: OAuthConfig;
    }
  | {
      type: 'remote';
      url: string;
      headers?: StringMap;
      enabled?: boolean;
      timeout?: number;
      oauth?: OAuthConfig;
    };

/**
 * Parse an opencode MCP config file and return structured server entries.
 * Used by the CLI to render the server list under the `mcp:` path line.
 * Returns an empty array on any read or parse failure (silent
 * degradation — the CLI just omits the server list).
 */
export const parseOpenCodeMcpServers: AgentMcpParseServersHandler = (
  resolvedPath,
) => parseOpenCodeMcpServerMap(resolvedPath);

/**
 * Normalize an OpenCode MCP config read result into the canonical
 * `OvertureMcpServer` shape the scan matrix consumes.
 *
 * OpenCode is discriminator-driven: each server entry's `type` selects
 * the transport. `'local'` requires a non-empty `command` array
 * (argv[0] becomes the canonical `command`, argv[1..] becomes the
 * optional canonical `args`); `'remote'` requires a non-empty `url`
 * plus an optional `headers` map. OpenCode extension fields
 * (`enabled`, `timeout`, `oauth`) are intentionally ignored because
 * the canonical `OvertureMcpServer` union does not have a slot for
 * them. Any other `type` value (including a missing `type` key)
 * produces the canonical `'Unsupported MCP server transport type.'`
 * reason.
 *
 * Returns `{}` when the read result is `null`, has a `parseError`, is
 * missing the top-level `mcp` map, or has a non-object `mcp` value
 * (the registry uses the empty object to mean "no normalized entries
 * to surface" — there is no implicit error to render in that case).
 */
export const normalizeOpenCodeMcpServers: AgentMcpNormalizeHandler<
  OpenCodeMcpConfig
> = (input) => {
  if (input.parseError !== undefined) {
    return {};
  }
  if (input.config === null) {
    return {};
  }
  const mcp = input.config.mcp;
  if (mcp === undefined) {
    return {};
  }
  if (!isRecord(mcp)) {
    return {};
  }

  const out: Record<string, AgentNormalizedMcpServer> = {};
  for (const name of Object.keys(mcp)) {
    const entry = mcp[name];
    if (!isRecord(entry)) {
      out[name] = shapeConflict('Expected server entry to be an object.');
      continue;
    }

    const entryType = entry['type'];

    if (entryType === 'local') {
      const command = entry['command'];
      if (!Array.isArray(command) || command.length === 0) {
        out[name] = shapeConflict('Stdio command is missing or empty.');
        continue;
      }
      const canonical: OvertureMcpServer = {
        type: 'stdio',
        command: command[0] as string,
      };
      if (command.length > 1) {
        const args = normalizeOptionalArgs(command.slice(1));
        if (typeof args === 'string') {
          out[name] = shapeConflict(args);
          continue;
        }
        // `args` is a non-empty `string[]` here: `command.length > 1`
        // guarantees `command.slice(1)` is non-empty, and the helper
        // preserves non-empty arrays as `string[]` (not `undefined`).
        canonical.args = args;
      }
      const env = normalizeOptionalEnv(entry['environment']);
      if (typeof env === 'string') {
        out[name] = shapeConflict(env);
        continue;
      }
      if (env !== undefined) {
        canonical.env = env;
      }
      out[name] = normalized(canonical);
      continue;
    }

    if (entryType === 'remote') {
      const url = entry['url'];
      if (typeof url !== 'string' || url.length === 0) {
        out[name] = shapeConflict('Remote url is missing or empty.');
        continue;
      }
      const canonical: OvertureMcpServer = { type: 'remote', url };
      const headers = normalizeOptionalHeaders(entry['headers']);
      if (typeof headers === 'string') {
        out[name] = shapeConflict(headers);
        continue;
      }
      if (headers !== undefined) {
        canonical.headers = headers;
      }
      out[name] = normalized(canonical);
      continue;
    }

    out[name] = shapeConflict('Unsupported MCP server transport type.');
  }
  return out;
};

/**
 * Native OpenCode MCP config shape. The top-level `mcp` key holds a
 * read-only map of server name to {@link OpenCodeMcpServer} entries.
 */
export interface OpenCodeMcpConfig {
  readonly mcp?: Readonly<Record<string, OpenCodeMcpServer>>;
}

export const opencode: AgentDefinition = defineAgent({
  id: 'opencode',
  displayName: 'OpenCode',
  installMarkers: [
    {
      id: 'opencode-1-config-json',
      kind: 'file',
      base: 'config',
      relativePath: 'opencode/opencode.json',
      confidence: 'high',
      reason: 'Primary OpenCode configuration file under XDG config',
    },
    {
      id: 'opencode-2-home-json',
      kind: 'file',
      base: 'home',
      relativePath: '.opencode.json',
      confidence: 'high',
      reason: 'Alternative OpenCode configuration file in home directory',
    },
  ],
  mcpLocations: [
    {
      scope: 'user',
      base: 'config',
      relativePath: 'opencode/opencode.json',
      format: 'json',
      topLevelKey: 'mcp',
      notes:
        'User-global, matching opencode runtime V1() lookup order. First existing file wins.',
    },
    {
      scope: 'user',
      base: 'config',
      relativePath: 'opencode/opencode.jsonc',
      format: 'jsonc',
      topLevelKey: 'mcp',
      notes:
        'User-global, matching opencode runtime V1() lookup order. First existing file wins.',
    },
    {
      scope: 'user',
      base: 'config',
      relativePath: '.opencode/opencode.json',
      format: 'json',
      topLevelKey: 'mcp',
      notes:
        'User-global, matching opencode runtime V1() lookup order. First existing file wins.',
    },
    {
      scope: 'user',
      base: 'config',
      relativePath: '.opencode/opencode.jsonc',
      format: 'jsonc',
      topLevelKey: 'mcp',
      notes:
        'User-global, matching opencode runtime V1() lookup order. First existing file wins.',
    },
    {
      scope: 'project',
      base: 'workspace',
      relativePath: 'opencode/opencode.json',
      format: 'json',
      topLevelKey: 'mcp',
      notes:
        'Project-local, matching opencode runtime V1() lookup order. First existing file wins.',
    },
    {
      scope: 'project',
      base: 'workspace',
      relativePath: 'opencode/opencode.jsonc',
      format: 'jsonc',
      topLevelKey: 'mcp',
      notes:
        'Project-local, matching opencode runtime V1() lookup order. First existing file wins.',
    },
    {
      scope: 'project',
      base: 'workspace',
      relativePath: '.opencode/opencode.json',
      format: 'json',
      topLevelKey: 'mcp',
      notes:
        'Project-local, matching opencode runtime V1() lookup order. First existing file wins.',
    },
    {
      scope: 'project',
      base: 'workspace',
      relativePath: '.opencode/opencode.jsonc',
      format: 'jsonc',
      topLevelKey: 'mcp',
      notes:
        'Project-local, matching opencode runtime V1() lookup order. First existing file wins.',
    },
  ],
  defaultConfidence: 'high',
  detectionStrategy: 'binary-first',
  mcpSupport: 'supported',
  executableNames: ['opencode'],
  mcp: {
    parseServers: parseOpenCodeMcpServers,
    normalize: asRegistryNormalizeHandler(normalizeOpenCodeMcpServers),
    write: opencodeWriteMcpConfig,
  },
});

/**
 * Read the agent's MCP config into the typed `OpenCodeMcpConfig` shape.
 * Thin wrapper over `readAgentMcpConfig` that casts the unknown document
 * to the agent's typed config. Returns the same `AgentMcpReadResult` shape
 * as `opencode.mcp.read`, but with the generic `config` field
 * narrowed to `OpenCodeMcpConfig | null`.
 */
export async function readOpenCodeMcpConfig(
  ctx: PathResolutionContext,
): Promise<AgentMcpReadResult<OpenCodeMcpConfig>> {
  return readAgentMcpConfig(opencode, ctx) as Promise<
    AgentMcpReadResult<OpenCodeMcpConfig>
  >;
}
