/**
 * Cleanup Service
 *
 * Removes Overture-managed MCPs from Claude Code's directory-based configs.
 *
 * @module @overture/import-core/cleanup-service
 */

import type {
  Platform,
  OvertureConfig,
  CleanupTarget,
  CleanupResult,
} from '@overture/config-types';
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { OutputPort } from '@overture/ports-output';

/**
 * Service for cleaning up directory-based MCP configs
 *
 * TODO: Full implementation requires integration with ClaudeCodeAdapter.
 * This is a skeleton implementation that will be completed in subsequent commits.
 */
export class CleanupService {
  constructor(_filesystem: FilesystemPort, _output: OutputPort) {
    // TODO: Store these for use in implementation
  }

  /**
   * Find directories in ~/.claude.json that have Overture configs
   *
   * TODO: Implement directory scanning logic
   */
  async findCleanupTargets(
    _platform: Platform,
    _overtureConfig: OvertureConfig,
    _projectRoot?: string,
  ): Promise<CleanupTarget[]> {
    // Placeholder
    return [];
  }

  /**
   * Execute the cleanup operation
   *
   * TODO: Implement cleanup logic using ClaudeCodeAdapter.cleanupDirectoryMcps
   */
  async executeCleanup(
    _targets: CleanupTarget[],
    _dryRun = false,
  ): Promise<CleanupResult> {
    // Placeholder
    return {
      directoriesCleaned: [],
      mcpsRemoved: 0,
      mcpsPreserved: [],
      backupPath: '',
    };
  }
}
