// Factory for `AgentDefinition`. Collapses the per-agent `mcp: { ... }`
// scaffolding (read, write, parseServers) into a single call, and
// applies sensible defaults for read (delegates to `readAgentMcpConfig`)
// and write (the shared "not implemented" rejecting handler).
//
// Per-agent files can still override any of the three MCP handlers via
// the optional `mcp` field. Unsupported agents (aider,
// github-copilot-cloud-agent) pass a complete
// `notImplementedMcpHandlers('<id>')` to keep read rejecting too.

import { defaultMcpWriteHandler, notImplementedMcpHandlers } from './types.js';
import type {
  AgentDefinition,
  AgentMcpHandlers,
  CompleteAgentMcpHandlers,
  PlatformRegistryEntry,
} from './types.js';
import { readAgentMcpConfig } from './read-mcp-config.js';

/**
 * Input shape for `defineAgent()`. Same as `AgentDefinition` minus the
 * `mcp` field — the factory fills in sensible defaults.
 */
export type DefineAgentInput = PlatformRegistryEntry & {
  /**
   * Optional MCP handler overrides. Omit to use the defaults
   * (read → readAgentMcpConfig, write → defaultMcpWriteHandler).
   * Pass `notImplementedMcpHandlers(id)` for unsupported agents
   * whose read should also reject.
   */
  readonly mcp?: AgentMcpHandlers;
};

/**
 * Build an `AgentDefinition` from the agent's static metadata
 * (id, displayName, installMarkers, mcpLocations, ...).
 *
 * The `mcp` slot is filled in with the shared defaults unless the
 * caller provides explicit handlers. The resulting `agent` is captured
 * in a closure for the default `read` handler so that
 * `readAgentMcpConfig(agent, ctx)` uses the constructed object.
 */
export function defineAgent(input: DefineAgentInput): AgentDefinition {
  // If the caller supplied a complete `mcp` (e.g.
  // `notImplementedMcpHandlers(id)` for an unsupported agent), spread
  // it and only fill in the default write if missing. We do NOT
  // overwrite the caller-provided read.
  if (input.mcp && 'read' in input.mcp) {
    const write = input.mcp.write ?? defaultMcpWriteHandler(input.id);
    return {
      ...input,
      mcp: {
        read: input.mcp.read,
        write,
        ...(input.mcp.parseServers
          ? { parseServers: input.mcp.parseServers }
          : {}),
      },
    };
  }

  // No caller-provided read: build a default read that closes over
  // the constructed agent so `readAgentMcpConfig(agent, ctx)` sees
  // the final object (including mcpLocations, etc.).
  const agent: AgentDefinition = {
    ...input,
    mcp: {
      read: () => Promise.reject(new Error('unreachable: read filled below')),
      write: input.mcp?.write ?? defaultMcpWriteHandler(input.id),
      ...(input.mcp?.parseServers
        ? { parseServers: input.mcp.parseServers }
        : {}),
    },
  };
  (agent.mcp as CompleteAgentMcpHandlers).read = (ctx) =>
    readAgentMcpConfig(agent, ctx);
  return agent;
}

// Re-export for callers that want to construct unsupported agents.
export { notImplementedMcpHandlers };
