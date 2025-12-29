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
import type { ClaudeCodeAdapter } from '@overture/client-adapters';

/**
 * Service for cleaning up directory-based MCP configs
 */
export class CleanupService {
  constructor(
    private readonly filesystem: FilesystemPort,
    private readonly output: OutputPort,
  ) {}

  /**
   * Find directories in ~/.claude.json that have Overture configs
   */
  async findCleanupTargets(
    claudeCodeAdapter: ClaudeCodeAdapter,
    platform: Platform,
    overtureConfig: OvertureConfig,
    _projectRoot?: string,
  ): Promise<CleanupTarget[]> {
    const targets: CleanupTarget[] = [];

    try {
      const fullConfig = await claudeCodeAdapter.readFullConfig(platform);

      if (!fullConfig.projects) {
        return targets;
      }

      const configPaths = claudeCodeAdapter.detectConfigPath(platform);
      const userPath =
        typeof configPaths === 'string' ? configPaths : configPaths?.user || '';

      // Check each directory in the projects object
      for (const [dirPath, projectConfig] of Object.entries(
        fullConfig.projects,
      )) {
        const target = await this.analyzeDirectoryForCleanup(
          dirPath,
          projectConfig,
          overtureConfig,
          userPath,
        );

        if (target) {
          targets.push(target);
        }
      }
    } catch (error) {
      this.output.warn(
        `Failed to find cleanup targets: ${(error as Error).message}`,
      );
    }

    return targets;
  }

  /**
   * Analyze a directory to determine if it needs cleanup
   */
  private async analyzeDirectoryForCleanup(
    dirPath: string,
    projectConfig: { mcpServers?: Record<string, unknown> },
    overtureConfig: OvertureConfig,
    userPath: string,
  ): Promise<CleanupTarget | null> {
    // Check if this directory has an Overture config
    const overtureConfigPath = `${dirPath}/.overture/config.yaml`;
    const hasOvertureConfig = await this.filesystem.exists(overtureConfigPath);

    if (!hasOvertureConfig) {
      return null;
    }

    // Analyze MCPs in this directory's config
    const { mcpsToRemove, mcpsToPreserve } = this.categorizeDirectoryMcps(
      projectConfig,
      overtureConfig,
    );

    // Only return target if there are MCPs to remove
    if (mcpsToRemove.length === 0) {
      return null;
    }

    return {
      directory: dirPath,
      hasOvertureConfig: true,
      filePath: userPath,
      mcpsToRemove,
      mcpsToPreserve,
    };
  }

  /**
   * Categorize MCPs in directory config as managed or unmanaged
   */
  private categorizeDirectoryMcps(
    projectConfig: { mcpServers?: Record<string, unknown> },
    overtureConfig: OvertureConfig,
  ): { mcpsToRemove: string[]; mcpsToPreserve: string[] } {
    const mcpsToRemove: string[] = [];
    const mcpsToPreserve: string[] = [];

    if (!projectConfig.mcpServers) {
      return { mcpsToRemove, mcpsToPreserve };
    }

    for (const mcpName of Object.keys(projectConfig.mcpServers)) {
      // mcpName comes from Object.keys - safe to check in overtureConfig.mcp
      // eslint-disable-next-line security/detect-object-injection -- mcpName from Object.keys()
      if (Object.hasOwn(overtureConfig.mcp, mcpName)) {
        mcpsToRemove.push(mcpName);
      } else {
        mcpsToPreserve.push(mcpName);
      }
    }

    return { mcpsToRemove, mcpsToPreserve };
  }

  /**
   * Execute the cleanup operation
   */
  async executeCleanup(
    claudeCodeAdapter: ClaudeCodeAdapter,
    platform: Platform,
    targets: CleanupTarget[],
    dryRun = false,
  ): Promise<CleanupResult> {
    const directoriesCleaned: string[] = [];
    let mcpsRemoved = 0;
    const mcpsPreserved: Array<{ directory: string; mcpName: string }> = [];

    if (targets.length === 0) {
      return {
        directoriesCleaned: [],
        mcpsRemoved: 0,
        mcpsPreserved: [],
        backupPath: '',
      };
    }

    // Create backup path
    const configPaths = claudeCodeAdapter.detectConfigPath(platform);
    const userPath =
      typeof configPaths === 'string' ? configPaths : configPaths?.user || '';
    const backupPath = `${userPath}.backup-${Date.now()}`;

    try {
      if (!dryRun) {
        // Create backup before making changes
        const content = await this.filesystem.readFile(userPath);
        await this.filesystem.writeFile(backupPath, content);
      }

      // Execute cleanup using the adapter
      if (!dryRun) {
        await claudeCodeAdapter.cleanupDirectoryMcps(platform, targets);
      }

      // Collect results
      for (const target of targets) {
        directoriesCleaned.push(target.directory);
        mcpsRemoved += target.mcpsToRemove.length;

        for (const mcpName of target.mcpsToPreserve) {
          mcpsPreserved.push({
            directory: target.directory,
            mcpName,
          });
        }
      }

      if (mcpsPreserved.length > 0) {
        this.output.warn(
          `Preserved ${mcpsPreserved.length} unmanaged MCP(s) - these are not in your Overture config`,
        );
      }
    } catch (error) {
      this.output.error(`Cleanup failed: ${(error as Error).message}`);
      throw error;
    }

    return {
      directoriesCleaned,
      mcpsRemoved,
      mcpsPreserved,
      backupPath: dryRun ? '' : backupPath,
    };
  }
}
