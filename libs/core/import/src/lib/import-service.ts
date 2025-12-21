/**
 * Import Service
 *
 * Discovers and imports unmanaged MCP configurations from AI clients.
 *
 * @module @overture/import-core/import-service
 */

import type {
  Platform,
  OvertureConfig,
  DiscoveredMcp,
  ImportDiscoveryResult,
  ImportResult,
} from '@overture/config-types';
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { OutputPort } from '@overture/ports-output';
import { detectConflicts } from './conflict-detector.js';

/**
 * Service for importing MCP configurations from client configs
 *
 * TODO: Full implementation requires concrete adapter classes with readConfig methods.
 * This is a skeleton implementation that will be completed in subsequent commits.
 */
export class ImportService {
  constructor(_filesystem: FilesystemPort, _output: OutputPort) {
    // TODO: Store these for use in implementation
  }

  /**
   * Discover all unmanaged MCPs across specified clients
   *
   * TODO: Implement full discovery logic
   */
  async discoverUnmanagedMcps(
    _platform: Platform,
    overtureConfig: OvertureConfig,
    _projectRoot?: string,
  ): Promise<ImportDiscoveryResult> {
    // Placeholder implementation
    const discovered: DiscoveredMcp[] = [];
    const conflicts = detectConflicts(discovered);
    const alreadyManaged = Object.keys(overtureConfig.mcp);

    return {
      discovered,
      conflicts,
      alreadyManaged,
    };
  }

  /**
   * Import selected MCPs to Overture config
   *
   * TODO: Implement YAML writing logic
   */
  async importMcps(
    _mcps: DiscoveredMcp[],
    _globalConfigPath: string,
    _projectConfigPath: string,
    _dryRun = false,
  ): Promise<ImportResult> {
    const imported: DiscoveredMcp[] = [];
    const skipped: DiscoveredMcp[] = [];
    const envVarsToSet = new Set<string>();
    const scopesModified = new Set<'global' | 'project'>();

    // TODO: Implement import logic

    return {
      imported,
      skipped,
      envVarsToSet: Array.from(envVarsToSet),
      scopesModified: Array.from(scopesModified),
    };
  }
}
