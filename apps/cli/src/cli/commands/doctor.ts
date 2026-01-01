/**
 * Doctor Command - Diagnostic Tool for Overture
 *
 * Provides comprehensive diagnostics for:
 * - Client binary/app bundle detection
 * - Client version information
 * - Config file validity
 * - MCP server command availability
 * - WSL2 environment detection
 *
 * @module cli/commands/doctor
 * @version 0.3.0
 */

import { Command } from 'commander';
import type { AppDependencies } from '../../composition-root.js';

/**
 * Creates the 'doctor' command for system diagnostics.
 *
 * Usage: overture doctor [options]
 *
 * Checks:
 * - Client binary/application installations
 * - Client versions
 * - Config file validity
 * - MCP server command availability
 */
export function createDoctorCommand(deps: AppDependencies): Command {
  const { diagnosticsOrchestrator, formatters } = deps;

  const command = new Command('doctor');

  command
    .description('Check system for installed clients and MCP servers')
    .option('--json', 'Output results as JSON')
    .option('--verbose', 'Show detailed output')
    .option('--wsl2', 'Force WSL2 detection mode')
    .option('--no-wsl2', 'Disable WSL2 detection')
    .action(async (options) => {
      // Run all diagnostics (never throws)
      const results = await diagnosticsOrchestrator.runDiagnostics({
        wsl2: options.wsl2,
        verbose: options.verbose,
        json: options.json,
      });

      // Output results
      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        // Format and output results
        formatters.environment.formatEnvironment(results.environment);
        formatters.configRepo.formatConfigRepoStatus(
          results.configRepo,
          options.verbose,
        );
        formatters.clients.formatClientResults(
          results.clients,
          options.verbose,
        );
        formatters.mcp.formatMcpResults(results.mcpServers, options.verbose);
        formatters.summary.formatSummary(
          results,
          results.clients.clients.length,
        );
      }
    });

  return command;
}
