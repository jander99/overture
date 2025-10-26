import * as path from 'path';
import { FsUtils } from '../infrastructure/fs-utils';
import { TemplateLoader } from '../infrastructure/template-loader';
import type { OvertureConfig, McpJson, GeneratorResult } from '../domain/types';
import { MCP_JSON_FILE, CLAUDE_MD_FILE } from '../domain/constants';
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
   * Preserve custom sections in existing CLAUDE.md.
   * Content after the custom marker is preserved and appended to new content.
   *
   * @param newContent - Newly generated CLAUDE.md content
   * @param existingPath - Path to existing CLAUDE.md file
   * @returns Combined content with preserved custom sections
   */
  static async preserveCustomSections(
    newContent: string,
    existingPath: string
  ): Promise<string> {
    if (!(await FsUtils.exists(existingPath))) {
      return newContent;
    }

    const existingContent = await FsUtils.readFile(existingPath);

    // Find custom section marker
    const customMarker = '<!-- Custom sections below this comment will be preserved -->';
    const markerIndex = existingContent.indexOf(customMarker);

    if (markerIndex === -1) {
      return newContent; // No custom sections to preserve
    }

    // Extract custom content
    const customContent = existingContent.substring(
      markerIndex + customMarker.length
    );

    // Append to new content
    return newContent + '\n\n' + customContent;
  }

  /**
   * Generate all configuration files (.mcp.json and CLAUDE.md).
   * Preserves custom sections in existing CLAUDE.md.
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

    // Generate CLAUDE.md
    let claudeMd = await this.generateClaudeMd(config);
    const claudeMdPath = path.join(outputDir, CLAUDE_MD_FILE);
    claudeMd = await this.preserveCustomSections(claudeMd, claudeMdPath);
    await FsUtils.writeFile(claudeMdPath, claudeMd);
    Logger.success(`Generated ${CLAUDE_MD_FILE}`);

    return {
      mcpJson,
      claudeMd,
      filesWritten: [mcpJsonPath, claudeMdPath],
    };
  }
}
