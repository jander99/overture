/**
 * Compatibility shim: legacy `platformRegistry` name preserved.
 *
 * The data now lives in `@overture/agents`. This shim re-exports the
 * static aggregate under the legacy name so existing CLI-local imports
 * (`import { platformRegistry } from './registry.js'`) keep working
 * unchanged. Do not add new consumers of `platformRegistry` — import
 * `agentRegistry` from `@overture/agents` directly.
 */
export { agentRegistry as platformRegistry } from '@overture/agents';
export type { AgentDefinition } from '@overture/agents';
