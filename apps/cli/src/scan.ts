import { buildScanMatrix, classifyConflicts } from '@overture/scan-matrix';
import type { ConflictClassification, ScanMatrix } from '@overture/scan-matrix';
import type { AgentScanInput, AgentReadState } from '@overture/scan-matrix';

import type { OvertureConfig } from '@overture/config';

import {
  AGENT_REGISTRY_ORDER,
  agentRegistry,
  type AgentDefinition,
  type AgentNormalizedMcpServer,
  type AgentMcpReadResult,
  type McpSupport,
  type PathResolutionContext,
} from '@overture/agents';

import { detectPlatforms } from './platforms/detect.js';
import type { PlatformDetectionResult } from './platforms/types.js';

/**
 * The public JSON-serializable output of one scan invocation:
 *
 * - `matrix` is the full {@link ScanMatrix} the CLI can render or hand to a
 *   consumer.
 * - `conflicts` is the conflict classification derived from `matrix` via
 *   `classifyConflicts`. Surfaced alongside the matrix so renderers do not
 *   have to run the classifier twice.
 *
 * No runtime `version` / `generatedAt` / `duration` fields are added here —
 * adding one would force every downstream consumer to negotiate a stable
 * envelope, which is out of scope for the C1 adapter.
 */
export interface ScanJsonOutput {
  readonly matrix: ScanMatrix;
  readonly conflicts: ConflictClassification;
}

/**
 * Inputs the C1 adapter needs to assemble the scan JSON output:
 *
 * - `ctx` is the resolved host filesystem context (`PathResolutionContext`)
 *   the detection + read pipeline consumes. Callers usually pass the
 *   `defaultPathResolutionContext()` from `./platforms/detect.js`.
 * - `config` is the canonical user-level `overture.jsonc` config (or `null`
 *   when no file has been written yet). `null` is a first-class input —
 *   pre-canonical users still get a meaningful inventory scan.
 */
export interface ScanInput {
  readonly ctx: PathResolutionContext;
  readonly config: OvertureConfig | null;
}

/**
 * Build the `{ matrix, conflicts }` scan output by:
 *
 * 1. Running `detectPlatforms(ctx)` to inventory installed agents.
 * 2. Walking `agentRegistry` in {@link AGENT_REGISTRY_ORDER}.
 * 3. For each agent, calling `agent.mcp.read(ctx)` and feeding the result
 *    through `agent.mcp.normalize(...)` to produce a
 *    `Readonly<Record<string, AgentNormalizedMcpServer>>` server map.
 * 4. Synthesizing an `AgentScanInput` snapshot for every agent — the
 *    `read-ok` case carries the normalized server map; every other case
 *    yields a not-installed / unsupported / read-empty snapshot with no
 *    `servers` slot.
 * 5. Passing the inputs to `buildScanMatrix(...)` and `classifyConflicts(...)`.
 *
 * The adapter never touches `parseServers`; the server-list UX surface is a
 * separate concern owned by the human-output renderer.
 */
export async function buildScanJsonOutput(
  input: ScanInput,
): Promise<ScanJsonOutput> {
  const detection = await detectPlatforms(input.ctx);
  const detectionById = new Map<string, PlatformDetectionResult>(
    detection.platforms.map((p) => [p.id, p]),
  );

  const agents: AgentScanInput[] = [];
  for (const agent of agentRegistry) {
    agents.push(
      await buildAgentInput(agent, detectionById.get(agent.id), input.ctx),
    );
  }

  const matrix = buildScanMatrix({
    config: input.config,
    agents,
    registryOrder: AGENT_REGISTRY_ORDER,
  });
  const conflicts = classifyConflicts(matrix);
  return { matrix, conflicts };
}

/**
 * Map a single agent + detection result + context into the corresponding
 * {@link AgentScanInput}. Pulled out of the main loop so the read-state
 * branches stay readable and unit-testable.
 *
 * Branches:
 * - detection missing OR not installed => `not-installed`.
 * - installed but MCP support is `unsupported`/`unknown` OR the agent has no
 *   `mcp.normalize` handler => `unsupported-agent`.
 * - installed + MCP support `supported` => call `mcp.read(ctx)` and
 *   `mcp.normalize(readResult)`:
 *   - `parseError` set     -> `readState: 'parse-error'` (no `servers`).
 *   - `config: null`       -> `readState: 'read-no-config'` (no `servers`).
 *   - `nonEmpty: false`    -> `readState: 'read-empty'` (no `servers`).
 *   - `nonEmpty: true`     -> `readState: 'read-ok'` (servers from normalize).
 *
 * The `servers` map is only attached in the `read-ok` branch — every other
 * branch leaves it absent so `buildScanMatrix` does not synthesize empty
 * rows.
 */
async function buildAgentInput(
  agent: AgentDefinition,
  detection: PlatformDetectionResult | undefined,
  ctx: PathResolutionContext,
): Promise<AgentScanInput> {
  const isInstalled = detection?.installed === true;
  const mcpSupport: McpSupport = detection?.mcpSupport ?? agent.mcpSupport;

  if (!isInstalled) {
    return {
      id: agent.id,
      displayName: agent.displayName,
      installed: false,
      mcpSupport,
      readState: 'not-installed',
    };
  }

  if (mcpSupport !== 'supported' || agent.mcp.normalize === undefined) {
    return {
      id: agent.id,
      displayName: agent.displayName,
      installed: true,
      mcpSupport,
      readState: 'unsupported-agent',
    };
  }

  const readResult = await agent.mcp.read(ctx);
  const readState = readStateFor(readResult);

  if (
    agent.id === 'opencode' &&
    readState === 'read-no-config' &&
    readResult.location === undefined
  ) {
    return {
      id: agent.id,
      displayName: agent.displayName,
      installed: false,
      mcpSupport,
      readState: 'not-installed',
    };
  }

  const resolvedPath = readResult.location?.resolvedPath;
  const reason = readResult.parseError;

  const base: AgentScanInput = {
    id: agent.id,
    displayName: agent.displayName,
    installed: true,
    mcpSupport,
    readState,
    ...(resolvedPath !== undefined ? { resolvedPath } : {}),
    ...(reason !== undefined ? { reason } : {}),
  };

  if (readState !== 'read-ok') {
    return base;
  }

  const servers: Readonly<Record<string, AgentNormalizedMcpServer>> =
    agent.mcp.normalize(readResult);
  return { ...base, servers };
}

/**
 * Map an {@link AgentMcpReadResult} to the matrix `readState` vocabulary:
 *
 * - `parseError` present  -> `'parse-error'`
 * - `config: null`        -> `'read-no-config'`
 * - `nonEmpty: false`     -> `'read-empty'`
 * - otherwise             -> `'read-ok'`
 *
 * Order matters: a parse error short-circuits even when `config` happens to
 * be non-null (the parse failure is the more useful signal for the matrix).
 */
function readStateFor(readResult: AgentMcpReadResult<unknown>): AgentReadState {
  if (readResult.parseError !== undefined) {
    return 'parse-error';
  }
  if (readResult.config === null) {
    return 'read-no-config';
  }
  if (!readResult.nonEmpty) {
    return 'read-empty';
  }
  return 'read-ok';
}
