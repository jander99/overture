/**
 * @overture/formatters
 *
 * McpFormatter - Formats MCP server check results
 *
 * Responsibilities:
 * - Format MCP server availability status
 * - Display command availability with recommendations
 * - Show source information in verbose mode
 */

import type { OutputPort } from '@overture/ports-output';
import type { McpCheckResult } from '@overture/diagnostics-types';
import chalk from 'chalk';
import { getMcpInstallRecommendation } from '../helpers/recommendations.js';

/**
 * McpFormatter - Formats MCP server check results for display
 */
export class McpFormatter {
  constructor(private readonly output: OutputPort) {}

  /**
   * Format and output MCP server check results
   */
  formatMcpResults(mcpResult: McpCheckResult, verbose: boolean): void {
    if (mcpResult.mcpServers.length === 0) {
      return;
    }

    this.output.info(chalk.bold('Checking MCP servers...\n'));

    for (const mcp of mcpResult.mcpServers) {
      const sourceTag = verbose ? chalk.dim(` [${mcp.source}]`) : '';

      if (mcp.available) {
        this.output.success(
          `${chalk.green('✓')} ${chalk.bold(mcp.name)}${sourceTag} - ${chalk.dim(mcp.command)} ${chalk.dim('(found)')}`,
        );
      } else {
        this.output.warn(
          `${chalk.yellow('⚠')} ${chalk.bold(mcp.name)}${sourceTag} - ${chalk.dim(mcp.command)} ${chalk.yellow('(not found)')}`,
        );

        // Show recommendation
        const recommendation = getMcpInstallRecommendation(mcp.command);
        if (recommendation) {
          console.log(`  ${chalk.dim('→')} ${chalk.dim(recommendation)}`);
        }
      }
    }
  }

  /**
   * Format MCP servers summary section
   */
  formatMcpSummary(
    totalMcpServers: number,
    mcpCommandsAvailable: number,
    mcpCommandsMissing: number,
  ): void {
    if (totalMcpServers > 0) {
      console.log('');
      console.log(
        `  MCP commands available: ${chalk.green(mcpCommandsAvailable)} / ${totalMcpServers}`,
      );
      if (mcpCommandsMissing > 0) {
        console.log(
          `  MCP commands missing:   ${chalk.yellow(mcpCommandsMissing)}`,
        );
      }
    }
  }
}
