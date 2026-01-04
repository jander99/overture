import { Command } from 'commander';
import type { AppDependencies } from '../../composition-root.js';

/**
 * Creates the 'skill' command group for managing Agent Skills.
 *
 * Usage:
 * - overture skill list                    - List available skills from config repo
 * - overture skill list --json             - Output as JSON
 * - overture skill list --source           - Show source paths
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

  return command;
}
