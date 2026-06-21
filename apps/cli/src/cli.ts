import { platform as nodePlatform } from 'node:os';
import {
  defaultOverturePaths,
  isSupportedPlatform,
  loadOvertureConfig,
  type HostPlatform,
  type OvertureConfig,
  type OverturePaths,
} from '@overture/config';
import {
  defaultPathResolutionContext,
  detectPlatforms,
} from './platforms/detect.js';
import { buildScanJsonOutput, type ScanJsonOutput } from './scan.js';
import { agentRegistry, type McpServerEntry } from '@overture/agents';
import type { DetectJsonOutput } from './platforms/types.js';

/**
 * Indirection over `process.platform` so tests can force a specific host
 * (e.g. `win32`) without having to mutate Node's global state. Production
 * callers always see the real value.
 */
let platformOverride: HostPlatform | null = null;
export function __setPlatformForTests(p: HostPlatform | null): void {
  platformOverride = p;
}
function currentPlatform(): HostPlatform {
  return platformOverride ?? (nodePlatform() as HostPlatform);
}

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

const USAGE =
  'Usage: overture <command> [flags]\n\nCommands:\n' +
  '  detect [--json]   Detect installed MCP-capable platforms.\n' +
  '  config show       Print the resolved user-level overture config.\n' +
  '  scan [--json]     Build the installed MCP server matrix.\n';

async function runDetect(flags: readonly string[]): Promise<number> {
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

interface StringWriter {
  write(chunk: string): boolean;
}

/**
 * Decide the exit code for a successful `--json` scan based on the model the
 * C1 adapter emits. Exposed so the contract is unit-testable in isolation and
 * so the dispatcher in {@link runScan} only orchestrates I/O.
 *
 * Contract (Task 4):
 * - `0` — the scan matrix has no invalid-profile state and no hard-refuse
 *   conflicts. "No agents installed" returns `0` because an empty inventory is
 *   a valid scan result, not an error.
 * - `1` — `matrix.canonicalState === 'invalid-profile'` OR
 *   `conflicts.hardRefuses.length > 0`. The JSON envelope is still written to
 *   stdout so consumers can inspect what failed.
 *
 * Other exit codes (`2` for usage errors and pre-model orchestration failures)
 * are owned by the dispatcher, not this helper.
 */
function exitCodeForScan(
  matrix: ScanJsonOutput['matrix'],
  conflicts: ScanJsonOutput['conflicts'],
): 0 | 1 {
  if (matrix.canonicalState === 'invalid-profile') return 1;
  if (conflicts.hardRefuses.length > 0) return 1;
  return 0;
}

/**
 * Dispatch the `overture scan` subcommand. Mirrors the {@link runDetect}
 * shape but routes through {@link buildScanJsonOutput} so the JSON output is
 * the same model the C1 adapter exposes to other consumers.
 *
 * Exit codes:
 * - `0` — clean scan (no invalid-profile state, no hard-refuse conflicts),
 *   including the "no agents installed" case; also returned for `--help` /
 *   `-h` and the no-flag placeholder that Task 5 will replace.
 * - `1` — scan ran but produced a `matrix.canonicalState === 'invalid-profile'`
 *   state, or `conflicts.hardRefuses` is non-empty. The JSON envelope is
 *   still emitted to stdout before the non-zero exit so consumers can read
 *   the failure model.
 * - `2` — usage errors (unknown flags, already wired) AND pre-model
 *   orchestration failures (canonical config parse / validation errors, any
 *   unexpected thrown error). The dispatcher writes the error message to
 *   stderr and does NOT emit a fake scan matrix to stdout.
 *
 * `stdout` / `stderr` are injected so tests can pass mocks; the production
 * dispatcher in {@link run} always passes `process.stdout` / `process.stderr`.
 */
async function runScan(
  args: readonly string[],
  stdout: StringWriter,
  stderr: StringWriter,
): Promise<number> {
  if (args.includes('--help') || args.includes('-h')) {
    stdout.write('Usage: overture scan [--json]\n');
    return 0;
  }
  const unknownFlags = args.filter((f) => f !== '--json');
  if (unknownFlags.length > 0) {
    stderr.write(
      `Unknown flag: ${unknownFlags[0]}\nUsage: overture scan [--json]\n`,
    );
    return 2;
  }
  if (args.includes('--json')) {
    let config: OvertureConfig | null;
    try {
      config = await loadOvertureConfig(defaultOverturePaths());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      stderr.write(`${message}\n`);
      return 2;
    }
    let scanOutput: ScanJsonOutput;
    try {
      scanOutput = await buildScanJsonOutput({
        ctx: defaultPathResolutionContext(),
        config,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      stderr.write(`${message}\n`);
      return 2;
    }
    const { matrix, conflicts } = scanOutput;
    stdout.write(JSON.stringify({ matrix, conflicts }, null, 2) + '\n');
    return exitCodeForScan(matrix, conflicts);
  }
  // No flag (default): Task 5 will replace this with the human formatter.
  return 0;
}
function renderConfigNotFound(paths: OverturePaths): string {
  return (
    `No overture config found at ${paths.configFile}\n` +
    `Resolved config dir: ${paths.configDir}\n` +
    `Platform: ${paths.platform}\n` +
    `(create the file to enable declarative sync — see docs/overture-config.md)\n`
  );
}

function renderConfigFound(paths: OverturePaths, cfg: OvertureConfig): string {
  return (
    `Config file: ${paths.configFile}\n` +
    `Platform:    ${paths.platform}\n` +
    `---\n` +
    JSON.stringify(cfg, null, 2) +
    '\n'
  );
}

async function runConfigShow(paths: OverturePaths): Promise<number> {
  let cfg: OvertureConfig | null;
  try {
    cfg = await loadOvertureConfig(paths);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    return 2;
  }
  if (cfg === null) {
    process.stdout.write(renderConfigNotFound(paths));
    return 0;
  }
  process.stdout.write(renderConfigFound(paths, cfg));
  return 0;
}

async function runConfig(subArgs: readonly string[]): Promise<number> {
  if (subArgs.length === 0) {
    process.stderr.write(
      'Usage: overture config <subcommand>\n  show     Print the resolved user-level overture config.\n',
    );
    return 2;
  }
  if (subArgs[0] === '--help' || subArgs[0] === '-h') {
    process.stdout.write(
      'Usage: overture config <subcommand>\n  show     Print the resolved user-level overture config.\n',
    );
    return 0;
  }
  if (subArgs[0] === 'show') {
    return runConfigShow(defaultOverturePaths());
  }
  process.stderr.write(
    `Unknown config subcommand: ${subArgs[0]}\nUsage: overture config <subcommand>\n`,
  );
  return 2;
}

export async function run(args: readonly string[]): Promise<number> {
  // Platform gate: only linux (incl. WSL1/WSL2) and darwin are supported
  // in v1. We surface this as a clean stdout message + exit 0 so users
  // running on Windows see an explanation, not a stack trace.
  const platform = currentPlatform();
  if (!isSupportedPlatform(platform)) {
    const message =
      `Note: Windows is not supported in this version of overture. ` +
      `Support is planned for a future release.\n` +
      `(detected platform: ${platform})\n`;
    process.stdout.write(message);
    return 0;
  }

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    process.stdout.write(USAGE);
    return 0;
  }

  if (args[0] === 'detect') {
    return runDetect(args.slice(1));
  }

  if (args[0] === 'config') {
    return runConfig(args.slice(1));
  }

  if (args[0] === 'scan') {
    return runScan(args.slice(1), process.stdout, process.stderr);
  }

  process.stderr.write(`Unknown command: ${args[0]}\n${USAGE}`);
  return 2;
}
