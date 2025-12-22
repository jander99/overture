/**
 * Import Command
 *
 * Import unmanaged MCP servers from client configs into Overture.
 *
 * @module cli/commands/import
 */

import { Command } from 'commander';
import * as p from '@clack/prompts';
import type { AppDependencies } from '../../composition-root.js';
import type { ClientName, DiscoveredMcp } from '@overture/config-types';
import { formatConflict, DetectionFormatter } from '@overture/import-core';

/**
 * Create the import command
 */
export function createImportCommand(deps: AppDependencies): Command {
  const cmd = new Command('import');

  cmd
    .description(
      'Import unmanaged MCP servers from client configs into Overture\n\n' +
        'Examples:\n' +
        '  $ overture import                    # Interactive import\n' +
        '  $ overture import --detect           # Scan without importing\n' +
        '  $ overture import --detect --verbose # Detailed scan results\n' +
        '  $ overture import --detect --format json > mcps.json',
    )
    .option(
      '--client <name>',
      'Target client: claude-code, copilot-cli, opencode, or all',
      'all',
    )
    .option('--yes', 'Skip confirmation prompts')
    .option('--detect', 'Scan and report MCP configurations without importing')
    .option(
      '--format <type>',
      'Output format for --detect: text, json, table',
      'text',
    )
    .option('--verbose', 'Show detailed information (use with --detect)')
    .action(async (options) => {
      const {
        importService,
        configLoader,
        pathResolver,
        output,
        environment,
        adapterRegistry,
      } = deps;

      try {
        // Load current Overture config
        const overtureConfig = await configLoader.loadConfig();
        const platform = environment.platform();

        // Determine which clients to scan
        const clientFilter: ClientName[] =
          options.client === 'all'
            ? ['claude-code', 'copilot-cli', 'opencode']
            : [options.client as ClientName];

        // Get adapters
        const claudeCodeAdapter = clientFilter.includes('claude-code')
          ? (adapterRegistry.get('claude-code') as any)
          : null;
        const openCodeAdapter = clientFilter.includes('opencode')
          ? (adapterRegistry.get('opencode') as any)
          : null;
        const copilotCliAdapter = clientFilter.includes('copilot-cli')
          ? (adapterRegistry.get('copilot-cli') as any)
          : null;

        // DETECT MODE: Read-only scan without importing
        if (options.detect) {
          const result = await importService.performDetection(
            claudeCodeAdapter,
            openCodeAdapter,
            copilotCliAdapter,
            overtureConfig,
            platform,
          );

          const formatter = new DetectionFormatter();
          let formattedOutput: string;

          switch (options.format) {
            case 'json':
              formattedOutput = formatter.formatJson(result);
              break;
            case 'table':
              formattedOutput = formatter.formatTable(result);
              break;
            case 'text':
            default:
              formattedOutput = formatter.formatText(
                result,
                options.verbose || false,
              );
          }

          console.log(formattedOutput);

          // Exit with appropriate code
          if (result.summary.parseErrors > 0) {
            process.exit(1);
          } else if (result.summary.conflicts > 0) {
            process.exit(2);
          } else {
            process.exit(0);
          }
        }

        // NORMAL IMPORT MODE
        p.intro('🔍 Import MCPs from Client Configs');

        // Discover unmanaged MCPs
        const spinner = p.spinner();
        spinner.start('Scanning client configurations...');

        const discovery = await importService.discoverUnmanagedMcps(
          claudeCodeAdapter,
          openCodeAdapter,
          copilotCliAdapter,
          overtureConfig,
          platform,
        );

        spinner.stop('Scan complete');

        // Show conflicts if any
        if (discovery.conflicts.length > 0) {
          p.note(
            discovery.conflicts.map((c) => formatConflict(c)).join('\n\n'),
            '⚠️  Conflicts Detected',
          );
          output.info(
            'These MCPs have different configurations across clients and cannot be imported automatically.',
          );
          output.info(
            'Please resolve conflicts manually by making the configurations match.\n',
          );
        }

        // Check if any MCPs found
        if (discovery.discovered.length === 0) {
          if (discovery.alreadyManaged.length > 0) {
            p.outro(
              `✅ All ${discovery.alreadyManaged.length} MCP(s) already managed by Overture`,
            );
          } else {
            p.outro('No unmanaged MCPs found');
          }
          return;
        }

        // Interactive selection
        const selectedValues = await p.multiselect({
          message: `Select MCPs to import (${discovery.discovered.length} found):`,
          options: discovery.discovered.map((mcp) => ({
            value: mcp,
            label: mcp.name,
            hint: `${mcp.source.client}: ${mcp.command} (${mcp.suggestedScope})`,
          })),
          required: false,
        });

        if (p.isCancel(selectedValues) || selectedValues.length === 0) {
          p.cancel('Import cancelled');
          return;
        }

        const selected = selectedValues as DiscoveredMcp[];

        // Group by suggested scope for confirmation
        const globalMcps = selected.filter(
          (m) => m.suggestedScope === 'global',
        );
        const projectMcps = selected.filter(
          (m) => m.suggestedScope === 'project',
        );

        // Show scope assignments
        const scopeLines: string[] = [];
        if (globalMcps.length > 0) {
          scopeLines.push(`\nGlobal scope (~/.config/overture/config.yaml):`);
          globalMcps.forEach((m) => scopeLines.push(`  • ${m.name}`));
        }
        if (projectMcps.length > 0) {
          scopeLines.push(`\nProject scope (.overture/config.yaml):`);
          projectMcps.forEach((m) => scopeLines.push(`  • ${m.name}`));
        }

        p.note(scopeLines.join('\n'), 'Import Plan');

        // Show environment variables that need to be set
        const allEnvVars = new Set<string>();
        selected.forEach((m) =>
          m.envVarsToSet?.forEach((v) => allEnvVars.add(v)),
        );

        if (allEnvVars.size > 0) {
          const envLines = Array.from(allEnvVars).map(
            (v) => `export ${v}="your-value-here"`,
          );
          p.note(envLines.join('\n'), '⚠️  Environment Variables Required');
        }

        // Confirm import
        if (!options.yes) {
          const confirmed = await p.confirm({
            message: `Import ${selected.length} MCP(s)?`,
            initialValue: true,
          });

          if (p.isCancel(confirmed) || !confirmed) {
            p.cancel('Import cancelled');
            return;
          }
        }

        // Execute import
        const importSpinner = p.spinner();
        importSpinner.start('Importing MCPs...');

        const globalPath = pathResolver.getUserConfigPath();
        const projectPath = pathResolver.getProjectConfigPath();

        const result = await importService.importMcps(
          selected,
          globalPath,
          projectPath,
        );

        importSpinner.stop('Import complete');

        // Show results
        p.note(
          [
            `Imported: ${result.imported.length}`,
            `Skipped: ${result.skipped.length}`,
            `Scopes modified: ${result.scopesModified.join(', ')}`,
          ].join('\n'),
          '✅ Import Results',
        );

        // Show environment variables reminder if any
        if (allEnvVars.size > 0) {
          output.info(
            '\n⚠️  Remember to set the required environment variables!',
          );
        }

        // Offer to run sync
        if (result.imported.length > 0 && !options.yes) {
          const shouldSync = await p.confirm({
            message: 'Run overture sync now?',
            initialValue: true,
          });

          if (!p.isCancel(shouldSync) && shouldSync) {
            output.info('\nRun: overture sync');
            output.info('(Automatic sync integration coming in next update)\n');
          }
        }

        p.outro('Import complete! 🎉');
      } catch (error) {
        p.cancel(`Import failed: ${(error as Error).message}`);
        throw error;
      }
    });

  return cmd;
}
