/**
 * Compatibility shim: legacy `platformRegistry` name preserved.
 *
 * The data now lives in per-agent files under `./agents/`. This shim
 * re-exports the static aggregate under the legacy name so existing
 * imports (`import { platformRegistry } from './registry.js'`) keep
 * working unchanged. Do not add new consumers of `platformRegistry` —
 * import `agentRegistry` from `./agents/index.js` directly.
 */
export { agentRegistry as platformRegistry } from './agents/index.js';
export type { AgentDefinition } from './agents/index.js';
