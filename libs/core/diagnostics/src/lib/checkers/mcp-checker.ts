import type { ProcessPort } from '@overture/ports-process';
import type { OvertureConfig } from '@overture/config-types';
import type {
  McpCheckResult,
  McpServerCheckResult,
} from '@overture/diagnostics-types';

/**
 * McpChecker - Checks MCP server command availability
 *
 * Never throws errors - always returns results.
 */
export class McpChecker {
  constructor(private readonly process: ProcessPort) {}

  /**
   * Check all MCP servers
   */
  async checkMcpServers(
    mergedConfig: OvertureConfig | null,
    mcpSources: Record<string, string>,
  ): Promise<McpCheckResult> {
    const mcpServers: McpServerCheckResult[] = [];

    const summary = {
      mcpCommandsAvailable: 0,
      mcpCommandsMissing: 0,
    };

    const mcpConfig = mergedConfig?.mcp || {};

    for (const [mcpName, mcpDef] of Object.entries(mcpConfig)) {
      const commandExists = await this.process.commandExists(mcpDef.command);
      const source = Object.hasOwn(mcpSources, mcpName)
        ? // eslint-disable-next-line security/detect-object-injection
          mcpSources[mcpName]
        : 'unknown';

      const mcpResult: McpServerCheckResult = {
        name: mcpName,
        command: mcpDef.command,
        available: commandExists,
        source,
      };

      mcpServers.push(mcpResult);

      // Update summary
      if (commandExists) {
        summary.mcpCommandsAvailable++;
      } else {
        summary.mcpCommandsMissing++;
      }
    }

    return {
      mcpServers,
      summary,
    };
  }
}
