// OpenCode agent definition.
import { readFileSync } from 'node:fs';
import { parse as parseJsonc } from 'jsonc-parser/lib/esm/main.js';
import { defaultMcpWriteHandler, notImplementedMcpHandlers } from './types.js';
import type {
  AgentDefinition,
  AgentMcpParseServersHandler,
  OAuthConfig,
  McpServerEntry,
  StringMap,
  AgentMcpReadResult,
} from './types.js';

import { readAgentMcpConfig } from './read-mcp-config.js';
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
) => {
  try {
    const contents = readFileSync(resolvedPath, 'utf8');
    const parsed: unknown = parseJsonc(contents, undefined, {
      allowTrailingComma: true,
    });
    const mcp = (parsed as Record<string, unknown> | undefined)?.mcp;
    if (!mcp || typeof mcp !== 'object') return [];
    const servers: McpServerEntry[] = [];
    for (const [name, entry] of Object.entries(mcp)) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      const url = typeof e.url === 'string' ? e.url : undefined;
      const command = Array.isArray(e.command)
        ? (e.command as readonly string[])
        : typeof e.command === 'string'
          ? [e.command]
          : undefined;
      servers.push({
        name,
        transport: url ? 'remote' : 'local',
        url,
        command,
      });
    }
    return servers;
  } catch {
    return [];
  }
};

/**
 * Native OpenCode MCP config shape. The top-level `mcp` key holds a
 * read-only map of server name to {@link OpenCodeMcpServer} entries.
 */
export interface OpenCodeMcpConfig {
  readonly mcp?: Readonly<Record<string, OpenCodeMcpServer>>;
}

export const opencode: AgentDefinition = {
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
    read: (ctx) => readAgentMcpConfig(opencode, ctx),
    write: defaultMcpWriteHandler('opencode'),
    parseServers: parseOpenCodeMcpServers,
  },
};

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
