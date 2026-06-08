import type {
  PathResolutionContext,
  PlatformId,
  PlatformRegistryEntry,
} from '../types.js';

/** Read result for a per-agent MCP read. Placeholder for now. */
export interface AgentMcpReadResult {
  servers: readonly unknown[];
}

/** Write input for a per-agent MCP write. Placeholder for now. */
export interface AgentMcpWriteInput {
  servers: readonly unknown[];
}

/** Write result. Placeholder for now. */
export interface AgentMcpWriteResult {
  written: number;
}

/** Read handler signature. */
export type AgentMcpReadHandler = (
  ctx: PathResolutionContext,
) => Promise<AgentMcpReadResult>;

/** Write handler signature. */
export type AgentMcpWriteHandler = (
  ctx: PathResolutionContext,
  input: AgentMcpWriteInput,
) => Promise<AgentMcpWriteResult>;

/** Bundled MCP handlers exposed by an agent. */
export interface AgentMcpHandlers {
  read: AgentMcpReadHandler;
  write: AgentMcpWriteHandler;
}

/**
 * Per-agent definition. Currently a structural extension of
 * `PlatformRegistryEntry` with a bundled `mcp` placeholder object that
 * will eventually carry the agent's MCP read/write implementation.
 */
export interface AgentDefinition extends PlatformRegistryEntry {
  readonly mcp: AgentMcpHandlers;
}

/**
 * Builds a paired set of placeholder MCP handlers that always reject
 * with an explicit "not implemented" error. Used by every migrated
 * agent in this PR; subsequent PRs will replace individual callsites
 * with real implementations.
 */
export function notImplementedMcpHandlers(
  agentId: PlatformId,
): AgentMcpHandlers {
  const message = (op: 'read' | 'write'): Error =>
    new Error(`MCP ${op} for agent '${agentId}' is not implemented yet`);
  return {
    read: () => Promise.reject(message('read')),
    write: () => Promise.reject(message('write')),
  };
}
