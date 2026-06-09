// Windsurf agent definition.
import { notImplementedMcpHandlers } from './types.js';
import type {
  AgentDefinition,
  McpServerMap,
  PermissiveConfigObject,
  RemoteServerBase,
  StdioServerBase,
} from './types.js';

export const windsurf: AgentDefinition = {
  id: 'windsurf',
  displayName: 'Windsurf',
  installMarkers: [],
  mcpLocations: [
    {
      scope: 'user',
      base: 'home',
      relativePath: '.codeium/windsurf/mcp_config.json',
      format: 'json',
      topLevelKey: 'mcpServers',
      notes: 'User-global MCP servers',
    },
  ],
  defaultConfidence: 'high',
  detectionStrategy: 'binary-first',
  mcpSupport: 'supported',
  executableNames: ['windsurf'],
  mcp: notImplementedMcpHandlers('windsurf'),
};

/** Native Windsurf MCP config: `mcpServers` map; servers may be stdio (`command`/`args`/`env`) or remote. Per docs the remote URL may appear as either `url` or `serverUrl` depending on doc version. */

export interface WindsurfMcpConfig {
  readonly mcpServers?: McpServerMap<WindsurfMcpServer>;
}

/** Windsurf server: union of stdio and remote transports with permissive extension fields. */

export type WindsurfMcpServer = (WindsurfStdioServer | WindsurfRemoteServer) &
  PermissiveConfigObject;

/** Stdio transport: local process invocation. */

export type WindsurfStdioServer = StdioServerBase;

/** Remote transport. Windsurf docs note the URL may surface as `url` or `serverUrl`; both are accepted. */

export interface WindsurfRemoteServer extends RemoteServerBase {
  /** Alias for `url`; present in some Windsurf doc versions. */

  readonly serverUrl?: string;
}
