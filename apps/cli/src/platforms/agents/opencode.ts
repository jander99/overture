// OpenCode agent definition.
import { notImplementedMcpHandlers } from './types.js';
import type { AgentDefinition, OAuthConfig, StringMap } from './types.js';

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
      notes: 'User-global MCP configuration under mcp key',
    },
    {
      scope: 'user',
      base: 'home',
      relativePath: '.opencode.json',
      format: 'json',
      topLevelKey: 'mcp',
      notes: 'Alternative user-global MCP configuration under mcp key',
    },
  ],
  defaultConfidence: 'high',
  detectionStrategy: 'binary-first',
  mcpSupport: 'supported',
  executableNames: ['opencode'],
  mcp: notImplementedMcpHandlers('opencode'),
};
