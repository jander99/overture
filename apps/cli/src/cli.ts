import {
  detectPlatforms,
  defaultPathResolutionContext,
} from './platforms/detect.js';
import { agentRegistry, type McpServerEntry } from '@overture/agents';
import type { DetectJsonOutput } from './platforms/types.js';

export function formatJsonOutput(output: DetectJsonOutput): string {
  return JSON.stringify(output, null, 2) + '\n';
}

/**
 * Render a single `McpServerEntry` for human-readable output. Local
 * servers show the argv vector joined with spaces; remote servers show
 * the URL. Returns the text without the leading indentation (caller
 * adds it).
 */
function formatServerLine(entry: McpServerEntry): string {
  if (entry.transport === 'remote') {
    return `- ${entry.name}  (remote)   ${entry.url ?? ''}`;
  }
  const cmd =
    entry.command && entry.command.length > 0 ? entry.command.join(' ') : '';
  return `- ${entry.name}  (local)   ${cmd}`;
}

/**
 * Look up an agent by id in the static registry and, if it exposes a
 * `parseServers` handler, return the parsed server list for the given
 * config file path. Returns an empty array when the agent is not found
 * or doesn't implement `parseServers`. Centralized here so the
 * per-platform loop in `formatHumanOutput` doesn't need to know about
 * any specific agent.
 */
function parseServersForAgent(
  agentId: string,
  resolvedPath: string,
): readonly McpServerEntry[] {
  const agent = agentRegistry.find((a) => a.id === agentId);
  if (!agent?.mcp.parseServers) return [];
  return agent.mcp.parseServers(resolvedPath);
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
      // Render the agent's parsed server list (if it implements one).
      if (mcpPath) {
        const servers = parseServersForAgent(platform.id, mcpPath);
        for (const s of servers) {
          lines.push(`      ${formatServerLine(s)}`);
        }
      }
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
