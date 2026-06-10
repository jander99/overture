// Continue agent definition.
import { notImplementedMcpHandlers } from './types.js';
import type { AgentDefinition, AgentMcpReadResult } from './types.js';
import type { RequestInitConfig, StringList, StringMap } from './types.js';
import type { ClaudeCodeMcpConfig } from './claude-code.js';
import type { CursorMcpConfig } from './cursor.js';
import type { ClineMcpConfig } from './cline.js';

import { readAgentMcpConfig } from './read-mcp-config.js';
import type { PathResolutionContext } from './types.js';
/**
 * Native Continue MCP server entry inside a standalone YAML config.
 * The `name` field is required because Continue identifies servers by
 * name within the YAML `mcpServers` list, not by map key.
 */
export interface ContinueMcpServer {
  name: string;
  type?: string;

  command?: string;
  args?: StringList;
  env?: StringMap;
  cwd?: string;
  url?: string;
  requestOptions?: RequestInitConfig;
  connectionTimeout?: number;
}

/**
 * Standalone YAML MCP config written under
 * `<workspace>/.continue/mcpServers/*.yaml`. Per the Continue docs the
 * top-level `mcpServers` key holds an ordered list of server entries
 * (not a map), and the file is identified by `name`/`version`/`schema`
 * metadata. This is the canonical Continue native shape.
 */
export interface ContinueYamlMcpConfig {
  name: string;
  version: string;
  schema: string;

  mcpServers: readonly ContinueMcpServer[];
}

/**
 * Imported JSON MCP config Continue can read from
 * `<workspace>/.continue/mcpServers/*.json`. Continue accepts files
 * copied verbatim from supported clients (Claude Code, Cursor, Cline,
 * and friends), so the imported shape is a union of those native types.
 */
export type ContinueImportedJsonMcpConfig =
  | ClaudeCodeMcpConfig
  | CursorMcpConfig
  | ClineMcpConfig;

/**
 * Native Continue MCP config shape. Continue supports two layouts:
 * - standalone YAML files (see {@link ContinueYamlMcpConfig})
 * - imported JSON files copied from other clients
 *   (see {@link ContinueImportedJsonMcpConfig})
 * Detection metadata in {@link continueDef} still points at
 * `.continue/config.json`; the YAML/imported-JSON layout is the
 * forward-looking read target documented in
 * `docs/coding-platform-mcp-configurations.md`.
 */
export type ContinueMcpConfig =
  | ContinueYamlMcpConfig
  | ContinueImportedJsonMcpConfig;

export const continueDef: AgentDefinition = {
  id: 'continue',
  displayName: 'Continue',
  installMarkers: [
    {
      id: 'continue-1-home-config',
      kind: 'file',
      base: 'home',
      relativePath: '.continue/config.json',
      confidence: 'medium',
      reason: 'User-global Continue configuration file',
    },
  ],
  mcpLocations: [
    {
      scope: 'project',
      base: 'workspace',
      relativePath: '.continue/mcpServers/mcp.json',
      format: 'json',
      topLevelKey: 'mcpServers',
      notes:
        "Continue imports MCP config files from this directory; the canonical imported filename is mcp.json. Continue also accepts standalone YAML files at <workspace>/.continue/mcpServers/*.yaml with a top-level mcpServers list, but overture's reader does not yet support YAML parsing (future PR).",
    },
  ],
  defaultConfidence: 'medium',
  detectionStrategy: 'marker-only',
  mcpSupport: 'supported',
  executableNames: [],
  mcp: {
    read: (ctx) => readAgentMcpConfig(continueDef, ctx),
    write: notImplementedMcpHandlers('continue').write,
  },
};

/**
 * Read the agent's MCP config into the typed `ContinueMcpConfig` shape.
 * Thin wrapper over `readAgentMcpConfig` that casts the unknown document
 * to the agent's typed config. Returns the same `AgentMcpReadResult` shape
 * as `continueDef.mcp.read`, but with the generic `config` field
 * narrowed to `ContinueMcpConfig | null`.
 */
export async function readContinueMcpConfig(
  ctx: PathResolutionContext,
): Promise<AgentMcpReadResult<ContinueMcpConfig>> {
  return readAgentMcpConfig(continueDef, ctx) as Promise<
    AgentMcpReadResult<ContinueMcpConfig>
  >;
}
