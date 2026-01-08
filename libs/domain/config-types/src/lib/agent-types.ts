/**
 * @module @overture/config-types/agent-types
 */

import type { ClientName, Scope } from './base-types.js';

/**
 * Logical model name mapping to client-specific model IDs
 *
 * @example
 * {
 *   "smart": {
 *     "claude-code": "sonnet",
 *     "opencode": "anthropic/claude-3-5-sonnet-latest",
 *     "copilot-cli": "gpt-4o"
 *   }
 * }
 */
export type ModelMapping = Record<string, Partial<Record<ClientName, string>>>;

/**
 * Universal Agent Configuration (YAML)
 */
export interface AgentConfig {
  /**
   * Unique identifier for the agent
   */
  name: string;

  /**
   * Description of what the agent does and when to use it
   */
  description: string;

  /**
   * Logical model name (e.g., "smart", "fast") or direct model ID
   */
  model?: string;

  /**
   * List of tools the agent is allowed to use
   */
  tools?: string[];

  /**
   * Tool permissions (Standardized, initially '*')
   */
  permissions?: Record<string, unknown>;

  /**
   * Optional LLM settings
   */
  settings?: {
    temperature?: number;
    maxSteps?: number;
    [key: string]: unknown;
  };

  /**
   * Client-specific overrides
   */
  overrides?: Partial<Record<ClientName, Partial<AgentConfig>>>;
}

/**
 * Full Agent Definition (YAML + MD)
 */
export interface AgentDefinition {
  /**
   * Agent metadata and configuration from YAML
   */
  config: AgentConfig;

  /**
   * System prompt body from Markdown
   */
  body: string;

  /**
   * Scope of the agent (global or project)
   */
  scope: Scope;

  /**
   * Source directory path
   */
  sourceDir: string;
}

/**
 * Result of an agent sync operation for a single agent
 */
export interface AgentSyncResult {
  /**
   * Name of the agent
   */
  agent: string;

  /**
   * Whether the agent was successfully synced across all requested clients
   */
  success: boolean;

  /**
   * Results per client
   */
  clientResults: Record<
    ClientName,
    {
      /**
       * Whether the sync succeeded for this client
       */
      success: boolean;
      /**
       * Path where the agent file was written
       */
      path?: string;
      /**
       * Error message if sync failed
       */
      error?: string;
    }
  >;
}

/**
 * Summary of the agent synchronization operation
 */
export interface AgentSyncSummary {
  /**
   * Total number of agents discovered
   */
  total: number;

  /**
   * Number of agents successfully synced
   */
  synced: number;

  /**
   * Number of agents that failed to sync (partially or fully)
   */
  failed: number;

  /**
   * Detailed results for each agent
   */
  results: AgentSyncResult[];
}
