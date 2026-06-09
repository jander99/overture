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
  const totalOrphans = output.platforms.reduce(
    (n, p) => n + p.orphanedMcpLocations.length,
    0,
  );
  if (installed.length === 0 && totalOrphans === 0) {
    return 'No supported MCP-capable platforms detected.\n';
  }
  const sections: string[] = [];

  // Section 1: installed platforms with MCP support (or unknown status)
  const detected = installed.filter((p) => p.mcpSupport !== 'unsupported');
  if (detected.length > 0) {
    const lines: string[] = ['Detected MCP-capable platforms:'];
    for (const platform of detected) {
      let tag: string;
      if (platform.mcpConfigured) {
        tag = '[mcp-configured]';
      } else if (platform.mcpSupport === 'unknown') {
        tag = '[unknown]';
      } else {
        tag = '[mcp-not-configured]';
      }
      lines.push(`  - ${platform.displayName} (${platform.confidence}) ${tag}`);
      const agentPath =
        platform.matchedExecutables[0]?.resolvedPath ??
        platform.matchedMarkers[0];
      if (agentPath) {
        lines.push(`    agent: ${agentPath}`);
      }
      const mcpPath = platform.mcpConfigured
        ? platform.matchedMcpLocations[0]?.resolvedPath
        : null;
      lines.push(`    mcp:   ${mcpPath ?? '(not configured)'}`);
    }
    sections.push(lines.join('\n'));
  }

  // Section 2: installed platforms without MCP support
  const unsupported = installed.filter((p) => p.mcpSupport === 'unsupported');
  if (unsupported.length > 0) {
    const lines: string[] = [
      'Installed tools without MCP support (inventory):',
    ];
    for (const platform of unsupported) {
      const label = platform.executableNames[0] ?? platform.id;
      lines.push(`    - ${platform.displayName} (${label})`);
      const agentPath =
        platform.matchedExecutables[0]?.resolvedPath ??
        platform.matchedMarkers[0];
      if (agentPath) {
        lines.push(`        agent: ${agentPath}`);
      }
    }
    sections.push(lines.join('\n'));
  }

  // Section 3: orphaned MCP configurations (no platform installed)
  const orphans: { path: string; platformId: string }[] = [];
  for (const platform of output.platforms) {
    for (const orphan of platform.orphanedMcpLocations) {
      orphans.push({ path: orphan.resolvedPath, platformId: platform.id });
    }
  }
  if (orphans.length > 0) {
    const lines: string[] = [
      'Orphaned MCP configurations (no platform installed):',
    ];
    for (const o of orphans) {
      lines.push(`    - ${o.path} (${o.platformId})`);
    }
    sections.push(lines.join('\n'));
  }

  return sections.join('\n\n') + '\n';
}

export async function run(args: readonly string[]): Promise<number> {
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    process.stdout.write('Usage: overture detect [--json]\n');
    return 0;
  }

  if (args[0] === 'detect') {
    const flags = args.slice(1);
    // Help is recognized and exits 0.
    if (flags.includes('--help') || flags.includes('-h')) {
      process.stdout.write('Usage: overture detect [--json]\n');
      return 0;
    }
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
