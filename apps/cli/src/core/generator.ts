import * as path from 'path';
import { FsUtils } from '../infrastructure/fs-utils';
import { TemplateLoader } from '../infrastructure/template-loader';
import type { OvertureConfig, McpJson, GeneratorResult } from '../domain/types';
import {
  MCP_JSON_FILE,
  CLAUDE_MD_FILE,
  CLAUDE_MD_START_MARKER,
  CLAUDE_MD_END_MARKER,
  CLAUDE_MD_USER_INSTRUCTION,
} from '../domain/constants';
import { Logger } from '../utils/logger';

/**
 * Generator service for creating .mcp.json and CLAUDE.md files.
 * Implements the configuration file generation logic with custom section preservation.
 */
export class Generator {
  /**
   * Generate .mcp.json from configuration.
   * Only includes enabled MCP servers with project or global scope.
   *
   * @param config - Overture configuration
   * @returns McpJson object containing server definitions
   */
  static generateMcpJson(config: OvertureConfig): McpJson {
    const mcpServers: Record<string, any> = {};

    // Include only enabled MCP servers with project or global scope
    for (const [name, mcp] of Object.entries(config.mcp)) {
      if (mcp.enabled !== false && mcp.command) {
        mcpServers[name] = {
          command: mcp.command,
          ...(mcp.args && { args: mcp.args }),
          ...(mcp.env && { env: mcp.env }),
        };
      }
    }

    return { mcpServers };
  }

  /**
   * Generate CLAUDE.md content from configuration using templates.
   *
   * @param config - Overture configuration
   * @returns Rendered CLAUDE.md content
   */
  static async generateClaudeMd(config: OvertureConfig): Promise<string> {
    const templateData = {
      projectName: config.project?.name || 'Project',
      projectType: config.project?.type,
      projectDescription: config.project?.description,
      plugins: Object.entries(config.plugins).map(([name, plugin]) => ({
        name,
        marketplace: plugin.marketplace,
        enabled: plugin.enabled !== false,
        mcps: plugin.mcps,
      })),
      mcps: Object.entries(config.mcp).map(([name, mcp]) => ({
        name,
        enabled: mcp.enabled !== false,
        scope: mcp.scope,
        command: mcp.command,
      })),
    };

    return await TemplateLoader.render('claude-md.hbs', templateData);
  }

  /**
   * Update the Overture-managed section in CLAUDE.md using paired boundary markers.
   * Follows the Nx MCP pattern for safe, non-destructive updates.
   *
   * This method:
   * - Creates a new managed section if none exists (appends to end)
   * - Replaces existing managed section if found
   * - Preserves all user content outside the markers
   * - Never modifies content written by users or other tools
   *
   * @param managedContent - Newly generated content for the managed section
   * @param existingPath - Path to existing CLAUDE.md file
   * @returns Complete CLAUDE.md content with updated managed section
   */
  static async updateManagedSection(
    managedContent: string,
    existingPath: string
  ): Promise<string> {
    // Wrap managed content with markers
    const wrappedContent =
      `${CLAUDE_MD_START_MARKER}\n` +
      `${CLAUDE_MD_USER_INSTRUCTION}\n\n` +
      `${managedContent}\n\n` +
      `${CLAUDE_MD_END_MARKER}\n`;

    // If no existing file, return just the wrapped managed section
    if (!(await FsUtils.exists(existingPath))) {
      return wrappedContent;
    }

    const existingContent = await FsUtils.readFile(existingPath);

    // Find existing managed section
    const startIdx = existingContent.indexOf(CLAUDE_MD_START_MARKER);
    const endIdx = existingContent.indexOf(CLAUDE_MD_END_MARKER);

    // If no managed section exists, append to end
    if (startIdx === -1 || endIdx === -1) {
      // Add spacing before appending
      const separator = existingContent.trim() ? '\n\n' : '';
      return existingContent.trim() + separator + wrappedContent;
    }

    // Replace existing managed section
    const before = existingContent.substring(0, startIdx);
    const after = existingContent.substring(endIdx + CLAUDE_MD_END_MARKER.length);

    return before + wrappedContent + after;
  }

  /**
   * Generate all configuration files (.mcp.json and CLAUDE.md).
   * Updates the Overture-managed section in CLAUDE.md using paired markers.
   *
   * @param config - Overture configuration
   * @param outputDir - Directory to write files to (defaults to current working directory)
   * @returns Generation result with file paths and content
   */
  static async generateFiles(
    config: OvertureConfig,
    outputDir: string = process.cwd()
  ): Promise<GeneratorResult> {
    Logger.info('Generating configuration files...');

    // Generate .mcp.json
    const mcpJson = this.generateMcpJson(config);
    const mcpJsonPath = path.join(outputDir, MCP_JSON_FILE);
    await FsUtils.writeFile(
      mcpJsonPath,
      JSON.stringify(mcpJson, null, 2)
    );
    Logger.success(`Generated ${MCP_JSON_FILE}`);

    // Generate CLAUDE.md (managed section only)
    const managedContent = await this.generateClaudeMd(config);
    const claudeMdPath = path.join(outputDir, CLAUDE_MD_FILE);
    const claudeMd = await this.updateManagedSection(managedContent, claudeMdPath);
    await FsUtils.writeFile(claudeMdPath, claudeMd);
    Logger.success(`Generated ${CLAUDE_MD_FILE}`);

    return {
      mcpJson,
      claudeMd,
      filesWritten: [mcpJsonPath, claudeMdPath],
    };
  }
}
