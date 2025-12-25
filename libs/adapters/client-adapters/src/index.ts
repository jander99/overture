/**
 * @overture/client-adapters
 *
 * Client adapters for AI development clients (Claude Code, VS Code, Cursor, etc.).
 * Implements hexagonal architecture with dependency injection for filesystem operations.
 *
 * @module @overture/client-adapters
 * @version 3.0
 *
 * @example
 * ```typescript
 * import { createAdapterRegistry } from '@overture/client-adapters';
 * import { createFilesystemAdapter } from '@overture/adapters-filesystem';
 *
 * // Create filesystem adapter
 * const filesystem = createFilesystemAdapter();
 *
 * // Create adapter registry with all adapters
 * const registry = createAdapterRegistry(filesystem);
 *
 * // Get specific adapter
 * const adapter = registry.get('claude-code');
 * if (adapter) {
 *   const config = await adapter.readConfig('/path/to/config.json');
 *   console.log(config);
 * }
 *
 * // Detect installed clients
 * const installed = registry.detectInstalledClients('linux');
 * console.log('Installed clients:', installed);
 * ```
 */

// Core interfaces and types
export type {
  ClientAdapter,
  ClientMcpConfig,
  ClientMcpServerDef,
  ConfigPathResult,
} from './lib/client-adapter.interface.js';
export { BaseClientAdapter } from './lib/client-adapter.interface.js';

// Registry
export {
  AdapterRegistry,
  getAdapterForClient,
} from './lib/adapter-registry.js';

// Factory
export { createAdapterRegistry, createAdapter } from './lib/adapter-factory.js';

// Individual adapters (for specialized use cases)
export { ClaudeCodeAdapter } from './lib/adapters/claude-code.adapter.js';
export { CopilotCliAdapter } from './lib/adapters/copilot-cli.adapter.js';
export { OpenCodeAdapter } from './lib/adapters/opencode.adapter.js';

// Skill paths
export {
  getSkillPaths,
  getSkillPath,
  getSkillDirectoryPath,
  type SkillPaths,
} from './lib/skill-paths.js';
