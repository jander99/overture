import {
  detectPlatforms,
  defaultPathResolutionContext,
} from './platforms/detect.js';
import type { DetectJsonOutput } from './platforms/types.js';

export function formatJsonOutput(output: DetectJsonOutput): string {
  return JSON.stringify(output, null, 2) + '\n';
}

export function formatHumanOutput(output: DetectJsonOutput): string {
  const installed = output.platforms.filter((p) => p.installed);
  if (installed.length === 0) {
    return 'No supported MCP-capable platforms detected.\n';
  }
  const lines = ['Detected MCP-capable platforms:'];
  for (const platform of installed) {
    const paths = platform.matchedMarkers.join(', ');
    lines.push(`  - ${platform.displayName} (${platform.confidence}) ${paths}`);
  }
  lines.push('');
  return lines.join('\n');
}

export async function run(args: readonly string[]): Promise<number> {
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    process.stdout.write('Usage: overture detect [--json]\n');
    return 0;
  }

  if (args[0] === 'detect') {
    const flags = args.slice(1);
    const unknownFlags = flags.filter((f) => f !== '--json');
    if (unknownFlags.length > 0) {
      process.stderr.write(
        `Unknown flag: ${unknownFlags[0]}\nUsage: overture detect [--json]\n`,
      );
      return 2;
    }

    const output = await detectPlatforms(defaultPathResolutionContext());

    if (flags.includes('--json')) {
      process.stdout.write(formatJsonOutput(output));
      return 0;
    }

    process.stdout.write(formatHumanOutput(output));
    return 0;
  }

  process.stderr.write(
    `Unknown command: ${args[0]}\nUsage: overture detect [--json]\n`,
  );
  return 2;
}
