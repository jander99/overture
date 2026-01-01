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
   *
   * PERFORMANCE: Uses batch command checking for parallel execution.
   * This reduces checking time from O(n) sequential to O(1) parallel.
   * Example: 8 MCPs checked in ~1s instead of ~8s.
   */
  async checkMcpServers(
    mergedConfig: OvertureConfig | null,
    mcpSources: Record<string, string>,
  ): Promise<McpCheckResult> {
    const mcpConfig = mergedConfig?.mcp || {};
    const mcpEntries = Object.entries(mcpConfig);

    // Extract all commands for batch checking
    const commands = mcpEntries.map(([, mcpDef]) => mcpDef.command);

    // PERFORMANCE OPTIMIZATION: Check all commands in parallel!
    const commandExistsMap = await this.process.commandExistsBatch(commands);

    // Build results from batch check
    const mcpServers: McpServerCheckResult[] = mcpEntries.map(
      ([mcpName, mcpDef]) => {
        const commandExists = commandExistsMap.get(mcpDef.command) ?? false;
        const source = Object.hasOwn(mcpSources, mcpName)
          ? // eslint-disable-next-line security/detect-object-injection
            mcpSources[mcpName]
          : 'unknown';

        return {
          name: mcpName,
          command: mcpDef.command,
          available: commandExists,
          source,
        };
      },
    );

    // Calculate summary
    const summary = {
      mcpCommandsAvailable: mcpServers.filter((m) => m.available).length,
      mcpCommandsMissing: mcpServers.filter((m) => !m.available).length,
    };

    return {
      mcpServers,
      summary,
    };
  }
}
