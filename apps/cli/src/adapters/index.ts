/**
 * Adapter Module - Central exports and initialization
 *
 * This module exports all client adapters and provides initialization
 * functionality to register adapters with the global registry.
 *
 * @module adapters
 */

import { adapterRegistry } from './adapter-registry';
import { ClaudeCodeAdapter } from './claude-code-adapter';
import { ClaudeDesktopAdapter } from './claude-desktop-adapter';
import { VSCodeAdapter } from './vscode-adapter';
import { CursorAdapter } from './cursor-adapter';
import { WindsurfAdapter } from './windsurf-adapter';
import { CopilotCliAdapter } from './copilot-cli-adapter';
import { JetBrainsCopilotAdapter } from './jetbrains-copilot-adapter';
import { CodexAdapter } from './codex-adapter';
import { GeminiCliAdapter } from './gemini-cli-adapter';

/**
 * Initialize all client adapters
 *
 * Registers all available client adapters with the global adapter registry.
 * This should be called once during CLI initialization.
 *
 * @example
 * ```typescript
 * import { initializeAdapters } from './adapters';
 *
 * // In main.ts or CLI initialization
 * initializeAdapters();
 * ```
 */
export function initializeAdapters(): void {
  // Register all client adapters
  adapterRegistry.register(new ClaudeCodeAdapter());
  adapterRegistry.register(new ClaudeDesktopAdapter());
  adapterRegistry.register(new VSCodeAdapter());
  adapterRegistry.register(new CursorAdapter());
  adapterRegistry.register(new WindsurfAdapter());
  adapterRegistry.register(new CopilotCliAdapter());
  adapterRegistry.register(new JetBrainsCopilotAdapter());
  adapterRegistry.register(new CodexAdapter());
  adapterRegistry.register(new GeminiCliAdapter());
}

// Export adapters for direct use if needed
export {
  ClaudeCodeAdapter,
  ClaudeDesktopAdapter,
  VSCodeAdapter,
  CursorAdapter,
  WindsurfAdapter,
  CopilotCliAdapter,
  JetBrainsCopilotAdapter,
  CodexAdapter,
  GeminiCliAdapter,
};

// Export adapter registry utilities
export { adapterRegistry, getAdapterForClient } from './adapter-registry';
export type { ClientAdapter } from './client-adapter.interface';
