// Cursor agent definition.
import { notImplementedMcpHandlers } from './types.js';
import type {
  AgentDefinition,
  McpServerMap,
  PermissiveConfigObject,
  RemoteServerBase,
  StdioServerBase,
} from './types.js';

export const cursor: AgentDefinition = {
  id: 'cursor',
  displayName: 'Cursor',
  installMarkers: [
    {
      id: 'cursor-1-home-mcp',
      kind: 'file',
      base: 'home',
      relativePath: '.cursor/mcp.json',
      confidence: 'high',
      reason: 'User-global Cursor MCP configuration',
    },
    {
      id: 'cursor-2-project-mcp',
      kind: 'file',
      base: 'workspace',
      relativePath: '.cursor/mcp.json',
      confidence: 'high',
      reason: 'Project-level Cursor MCP configuration',
    },
  ],
  mcpLocations: [
    {
      scope: 'user',
      base: 'home',
      relativePath: '.cursor/mcp.json',
      format: 'json',
      topLevelKey: 'mcpServers',
      notes: 'User-global MCP servers',
    },
    {
      scope: 'project',
      base: 'workspace',
      relativePath: '.cursor/mcp.json',
      format: 'json',
      topLevelKey: 'mcpServers',
      notes: 'Project-level MCP servers',
    },
  ],
  defaultConfidence: 'high',
  detectionStrategy: 'marker-only',
  mcpSupport: 'supported',
  executableNames: ['cursor'],
  mcp: notImplementedMcpHandlers('cursor'),
};

/** Native Cursor MCP config: `mcpServers` map; servers may be stdio (with `command`/`args`/`env`) or remote (with `url`/`headers`). Per-server `envFile` overrides; static OAuth-like credentials live under `auth`. */

export interface CursorMcpConfig {
  readonly mcpServers?: McpServerMap<CursorMcpServer>;
}

/** Cursor server: union of stdio and remote transports with permissive extension fields. */

export type CursorMcpServer = (CursorStdioServer | CursorRemoteServer) &
  PermissiveConfigObject;

/** Stdio transport: local process invocation. */

export interface CursorStdioServer extends StdioServerBase {
  /** Path to a dotenv-style env file whose entries are merged into `env`. */

  readonly envFile?: string;

  /** Static OAuth-like credentials: `CLIENT_ID`, `CLIENT_SECRET`, optional `scopes`, plus an open index signature for forward-compatible fields. */

  readonly auth?: CursorAuth;
}

/** Remote transport: HTTP / SSE. */

export interface CursorRemoteServer extends RemoteServerBase {
  /** Static OAuth-like credentials. */

  readonly auth?: CursorAuth;
}

/** Permissive object that exposes the documented Cursor auth keys and permits arbitrary additional fields. */

export type CursorAuth = PermissiveConfigObject & {
  readonly CLIENT_ID?: string;

  readonly CLIENT_SECRET?: string;

  readonly scopes?: readonly string[];
};
