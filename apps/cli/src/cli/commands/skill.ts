import { Command } from 'commander';
import type { AppDependencies } from '../../composition-root.js';
import type { SkillSyncResult, ClientName } from '@overture/config-types';

/**
 * Creates the 'skill' command group for managing Agent Skills.
 *
 * Usage:
 * - overture skill list                    - List available skills from config repo
 * - overture skill list --json             - Output as JSON
 * - overture skill list --source           - Show source paths
 * - overture skill cp <name>               - Copy skill to current project
 * - overture skill cp <name> --force       - Force overwrite existing skill
 * - overture skill cp <name> --client <c>  - Copy for specific client only
 */
export function createSkillCommand(deps: AppDependencies): Command {
  const command = new Command('skill');

  command.description('Manage Agent Skills');

  // skill list subcommand
  command
    .command('list')
    .description('List available skills from config repo')
    .option('--json', 'Output as JSON')
    .option('--source', 'Show source path for each skill')
    .action(async (options: { json?: boolean; source?: boolean }) => {
      const { skillDiscovery, output } = deps;

      try {
        // Discover all skills
        const skills = await skillDiscovery.discoverSkills();

        if (skills.length === 0) {
          output.warn(
            'No skills found in ~/.config/overture/skills/\n' +
              'Create a skill by adding a directory with a SKILL.md file.',
          );
          return;
        }

        if (options.json) {
          // JSON output for scripting
          console.log(JSON.stringify(skills, null, 2));
          return;
        }

        // Table format output
        output.info('\nAvailable Skills:\n');
        console.log('NAME              DESCRIPTION');
        console.log('─'.repeat(80));

        for (const skill of skills) {
          const name = skill.name.padEnd(18);
          const description = skill.description || '(no description)';
          console.log(`${name}${description}`);

          if (options.source) {
            console.log(`                  ${skill.path}`);
          }
        }

        console.log('');
        output.info(
          `Total: ${skills.length} skill${skills.length === 1 ? '' : 's'}`,
        );
      } catch (error) {
        output.error(`Failed to list skills: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  // skill cp subcommand
  command
    .command('cp <name>')
    .description('Copy a skill to the current project')
    .option('-f, --force', 'Overwrite if skill exists in project')
    .option(
      '-c, --client <name>',
      'Only copy for specified client (claude-code, copilot-cli, or opencode)',
    )
    .action(
      async (name: string, options: { force?: boolean; client?: string }) => {
        const { skillCopyService, output } = deps;

        try {
          // Parse client option
          const clients = options.client
            ? [options.client as ClientName]
            : undefined;

          // Copy skill to project
          const results = await skillCopyService.copySkillToProject(name, {
            force: options.force,
            clients,
          });

          // Output results
          output.info(`\nCopied '${name}' skill to project:\n`);

          for (const result of results) {
            const status = result.success ? (result.skipped ? '○' : '✓') : '✗';
            const message = result.skipped
              ? '(already exists, use --force to overwrite)'
              : result.error
                ? `(failed: ${result.error})`
                : '';

            console.log(`  ${status} ${result.targetPath} ${message}`);
          }

          console.log('');

          // Exit with error if any failed
          const failed = results.filter((r: SkillSyncResult) => !r.success);
          if (failed.length > 0) {
            output.error(
              `Failed to copy skill to ${failed.length} client${failed.length === 1 ? '' : 's'}`,
            );
            process.exit(1);
          }
        } catch (error) {
          output.error(
            `Failed to copy skill '${name}': ${(error as Error).message}`,
          );
          process.exit(1);
        }
      },
    );

  return command;
}
