/**
 * Public `@overture/scan-matrix` surface.
 *
 * B1 is a pure TypeScript model; it does not import I/O, parsers, or renderers.
 * Equality happens after B2-style normalization: B1 consumes `OvertureMcpServer`
 * only via `NormalizedAgentServer.server`. Native-agent fields, display-shaped
 * entries produced by per-agent renderers, and config-file reads are
 * explicitly out of scope here.
 *
 * Behavior (`compareAgentEntries`, `buildScanMatrix`) lands in later
 * tasks; `serverSettingsEqual` is the canonical equality helper row
 * classification and matrix construction consume.
 */
import type { OvertureConfig, OvertureMcpServer } from '@overture/config';
import type { McpSupport } from '@overture/agents';

/**
 * Canonical equality for two `OvertureMcpServer` values.
 *
 * The comparison is post-normalization: callers are responsible for
 * producing both sides from their native shapes before invoking. The
 * helper is a pure, synchronous, field-exact byte comparison:
 *
 * - `type` mismatch short-circuits to `false`; cross-type fields are
 *   never inspected.
 * - `stdio` compares only `command`, `args`, and `env`.
 * - `remote` compares only `url` and `headers`.
 * - Optional arrays/objects: `undefined` and `[]` / `{}` are distinct
 *   values and never compare equal.
 * - `args` order is significant; `env` / `headers` key insertion order
 *   is not.
 * - No URL normalization, command trimming, case folding, or
 *   `JSON.stringify`-based diffing.
 *
 * This is the equality contract row classification and the matrix
 * builder rely on.
 */
export function serverSettingsEqual(
  left: OvertureMcpServer,
  right: OvertureMcpServer,
): boolean {
  if (left.type !== right.type) {
    return false;
  }
  if (left.type === 'stdio' && right.type === 'stdio') {
    return (
      left.command === right.command &&
      stringArrayEqual(left.args, right.args) &&
      stringRecordEqual(left.env, right.env)
    );
  }
  if (left.type === 'remote' && right.type === 'remote') {
    return (
      left.url === right.url && stringRecordEqual(left.headers, right.headers)
    );
  }
  return false;
}

/**
 * Order-sensitive equality for two optional `string[]` values.
 *
 * `undefined` and `[]` are distinct: a missing field is not the same
 * as an explicitly empty list. Same reference (including both
 * `undefined`) short-circuits to `true`.
 */
function stringArrayEqual(
  left: readonly string[] | undefined,
  right: readonly string[] | undefined,
): boolean {
  if (left === right) {
    return true;
  }
  if (left === undefined || right === undefined) {
    return false;
  }
  if (left.length !== right.length) {
    return false;
  }
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Key-set + per-key string equality for two optional
 * `Record<string, string>` values. Key insertion order is ignored;
 * `undefined` and `{}` are distinct. Same reference (including both
 * `undefined`) short-circuits to `true`.
 */
function stringRecordEqual(
  left: Readonly<Record<string, string>> | undefined,
  right: Readonly<Record<string, string>> | undefined,
): boolean {
  if (left === right) {
    return true;
  }
  if (left === undefined || right === undefined) {
    return false;
  }
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) {
    return false;
  }
  for (const key of leftKeys) {
    if (!(key in right)) {
      return false;
    }
    if (left[key] !== right[key]) {
      return false;
    }
  }
  return true;
}

/**
 * Per-row classification of a single canonical/agent server pair.
 *
 * - `aligned` — canonical and post-normalized agent settings are byte-equal.
 * - `missing-from-agent` — canonical intent names a server the agent lacks.
 * - `extra-in-agent` — the agent declares a server the canonical intent lacks.
 * - `different-settings` — same `type` but the field values differ.
 * - `shape-conflict` — the agent entry could not be normalized to
 *   `OvertureMcpServer`, or the canonical/agent `type` discriminators differ.
 */
export type ServerStatus =
  | 'aligned'
  | 'missing-from-agent'
  | 'extra-in-agent'
  | 'different-settings'
  | 'shape-conflict';

/**
 * Read-side outcome of an upstream detection/read pass for a single agent.
 *
 * The matrix builder maps each of these to a snapshot and decides whether the
 * agent's server map should participate in row generation. `read-ok` is the
 * only state that yields `servers`; all other states produce no rows for the
 * agent.
 */
export type AgentReadState =
  | 'not-installed'
  | 'unsupported-agent'
  | 'not-read'
  | 'read-ok'
  | 'read-empty'
  | 'read-no-config'
  | 'parse-error';

/**
 * Post-normalization view of a single agent-side MCP server entry.
 *
 * B1 never sees agent-native field shapes; B2 is responsible for converting
 * each agent's native schema into one of these branches before this package
 * compares values. The `shape-conflict` branch carries the human-readable
 * reason that surfaces on the row.
 */
export type NormalizedAgentServer =
  | { readonly state: 'normalized'; readonly server: OvertureMcpServer }
  | { readonly state: 'shape-conflict'; readonly reason: string };

/**
 * Input shape for a single agent as the matrix builder receives it.
 *
 * Upstream detection/read code (Tasks 3-5 of other slices) produces this from
 * per-agent `readMcpConfig`/parsers; the scan matrix consumes it as data. The
 * `servers` map is only populated when `readState === 'read-ok'`.
 */
export interface AgentScanInput {
  readonly id: string;
  readonly displayName: string;
  readonly installed: boolean;
  readonly mcpSupport: McpSupport;
  readonly readState: AgentReadState;
  readonly resolvedPath?: string;
  readonly reason?: string;
  readonly servers?: Readonly<Record<string, NormalizedAgentServer>>;
}

/**
 * Public, server-free view of a single agent in the matrix.
 *
 * Mirrors `AgentScanInput` minus the per-server map. The matrix emits this
 * shape for every target agent (synthesized not-installed or unsupported-agent
 * snapshots are produced when the input is missing).
 */
export interface AgentSnapshot {
  readonly id: string;
  readonly displayName: string;
  readonly installed: boolean;
  readonly mcpSupport: McpSupport;
  readonly readState: AgentReadState;
  readonly resolvedPath?: string;
  readonly reason?: string;
}

/**
 * A single canonical/agent comparison row.
 *
 * `canonicalName` and `agentServerName` are nullable on purpose: the
 * `presence` field and `__extra__` magic sentinel are explicitly forbidden.
 * Exactly one of the two name fields is non-null per row.
 */
export interface ServerStatusRow {
  readonly agentId: string;
  readonly canonicalName: string | null;
  readonly agentServerName: string | null;
  readonly status: ServerStatus;
  readonly canonicalServer: OvertureMcpServer | null;
  readonly agentServer: OvertureMcpServer | null;
  readonly reason?: string;
}

/**
 * Full scan-matrix output: canonical intent, per-agent snapshots, and the
 * deterministic row list. `canonicalState` distinguishes
 * `absent` (no config), `ready` (config + profile resolved), and
 * `invalid-profile` (config present but default profile missing).
 */
export interface ScanMatrix {
  readonly canonicalState: 'absent' | 'ready' | 'invalid-profile';
  readonly canonicalProfileName: string | null;
  readonly canonicalIntent: Readonly<Record<string, OvertureMcpServer>>;
  readonly agents: readonly AgentSnapshot[];
  readonly rows: readonly ServerStatusRow[];
  readonly reason?: string;
}

/**
 * Input for `buildScanMatrix`. `config: null` is valid (the CLI is allowed to
 * scan before a user has written `overture.jsonc`); `registryOrder` lets
 * callers pin the agent order for deterministic output, defaulting to the
 * canonical four-agent registry order.
 */
export interface BuildScanMatrixInput {
  readonly config: OvertureConfig | null;
  readonly agents: readonly AgentScanInput[];
  readonly registryOrder?: readonly string[];
}

/**
 * Input for `compareAgentEntries`. Holds the canonical intent for a single
 * profile and the agent's post-normalized server map. `agentId` flows through
 * to every row so downstream renderers can group by agent.
 */
export interface CompareAgentEntriesInput {
  readonly canonical: Readonly<Record<string, OvertureMcpServer>>;
  readonly agent: Readonly<Record<string, NormalizedAgentServer>>;
  readonly agentId: string;
}

/**
 * Classify a single canonical intent against a single agent's
 * post-normalized server map.
 *
 * The function is a pure, synchronous row emitter. It does not read files,
 * inspect agent-native fields, or branch on agent ids: every decision is
 * made from the canonical entry, the `NormalizedAgentServer` produced by
 * upstream B2 normalization, and the comparison helpers in this module.
 *
 * Row order is deterministic:
 *
 * 1. One row per canonical server name, iterated in ascending lexical
 *    order. The row's `canonicalName` is the name; `agentServerName` is
 *    `null` when the agent lacks that name.
 * 2. One row per agent-only server name, appended after the canonical
 *    block and iterated in ascending lexical order. `canonicalName` is
 *    `null`; `agentServerName` is the agent's name.
 *
 * `canonicalServer` / `agentServer` use `null` for absent sides; the
 * `presence` field and `__extra__` magic sentinel are explicitly forbidden.
 * Reasons are human-readable strings that downstream renderers can surface
 * verbatim.
 */
export function compareAgentEntries(
  input: CompareAgentEntriesInput,
): readonly ServerStatusRow[] {
  const { canonical, agent, agentId } = input;
  const rows: ServerStatusRow[] = [];

  const canonicalNames = Object.keys(canonical).sort();
  const agentNames = Object.keys(agent).sort();

  for (const name of canonicalNames) {
    const canonicalServer = canonical[name];
    if (canonicalServer === undefined) {
      // Defensive: `Object.keys` only returns own enumerable keys, so this
      // branch is unreachable in practice. Kept to satisfy `noUncheckedIndexedAccess`.
      continue;
    }
    const entry = agent[name];
    if (entry === undefined) {
      rows.push({
        agentId,
        canonicalName: name,
        agentServerName: null,
        status: 'missing-from-agent',
        canonicalServer,
        agentServer: null,
        reason: `Agent has no server named "${name}"`,
      });
      continue;
    }
    if (entry.state === 'shape-conflict') {
      rows.push({
        agentId,
        canonicalName: name,
        agentServerName: name,
        status: 'shape-conflict',
        canonicalServer,
        agentServer: null,
        reason: entry.reason,
      });
      continue;
    }
    const agentServer = entry.server;
    if (canonicalServer.type !== agentServer.type) {
      rows.push({
        agentId,
        canonicalName: name,
        agentServerName: name,
        status: 'shape-conflict',
        canonicalServer,
        agentServer: null,
        reason: `Canonical type "${canonicalServer.type}" differs from agent type "${agentServer.type}"`,
      });
      continue;
    }
    if (serverSettingsEqual(canonicalServer, agentServer)) {
      rows.push({
        agentId,
        canonicalName: name,
        agentServerName: name,
        status: 'aligned',
        canonicalServer,
        agentServer,
      });
      continue;
    }
    rows.push({
      agentId,
      canonicalName: name,
      agentServerName: name,
      status: 'different-settings',
      canonicalServer,
      agentServer,
      reason: 'Canonical and agent settings differ',
    });
  }

  for (const name of agentNames) {
    if (canonical[name] !== undefined) {
      continue;
    }
    const entry = agent[name];
    if (entry === undefined) {
      // Mirror the canonical loop's defensive guard: `Object.keys` only yields
      // own keys, so this branch is unreachable in practice.
      continue;
    }
    if (entry.state === 'shape-conflict') {
      rows.push({
        agentId,
        canonicalName: null,
        agentServerName: name,
        status: 'shape-conflict',
        canonicalServer: null,
        agentServer: null,
        reason: entry.reason,
      });
      continue;
    }
    rows.push({
      agentId,
      canonicalName: null,
      agentServerName: name,
      status: 'extra-in-agent',
      canonicalServer: null,
      agentServer: entry.server,
      reason: `Canonical intent has no server named "${name}"`,
    });
  }

  return rows;
}

/**
 * Default agent-id order for `buildScanMatrix`.
 *
 * Mirrors the canonical four-agent registry (`claude-code`, `opencode`,
 * `github-copilot-cli`, `openai-codex`) but is intentionally a plain
 * string list rather than a re-export of `@overture/agents`'s
 * `AGENT_REGISTRY_ORDER` so the scan-matrix model stays decoupled from
 * per-agent `AgentDefinition` data. Callers that want to override the
 * order pass `BuildScanMatrixInput.registryOrder`; this constant is the
 * fallback when no order is supplied.
 */
export const DEFAULT_REGISTRY_ORDER: readonly string[] = [
  'claude-code',
  'opencode',
  'github-copilot-cli',
  'openai-codex',
];

interface ResolveCanonicalResult {
  readonly state: 'absent' | 'ready' | 'invalid-profile';
  readonly profileName: string | null;
  readonly intent: Readonly<Record<string, OvertureMcpServer>>;
  readonly targetIds: readonly string[];
  readonly reason?: string;
}

/**
 * Resolve canonical state, intent, and target ids from the input. Pulled
 * out of `buildScanMatrix` so the three-state switch stays readable.
 *
 * - `config === null` => absent state, empty intent, targets = `registryOrder`.
 * - Default profile missing => invalid-profile state, empty intent, targets
 *   follow `sync.targets` (so the snapshot list still populates correctly),
 *   reason pinned to the approved string.
 * - Default profile present => ready state, intent is the profile's
 *   `mcpServers` minus `sync.disabledServers` entries, targets follow
 *   `sync.targets`.
 */
function resolveCanonical(
  config: OvertureConfig | null,
  registryOrder: readonly string[],
): ResolveCanonicalResult {
  if (config === null) {
    return {
      state: 'absent',
      profileName: null,
      intent: {},
      targetIds: registryOrder,
    };
  }
  // The Zod schema's `default('default')` is shadowed by the outer
  // `.partial().default({})` on the settings object, so the inferred type
  // surfaces as `string | undefined`. Post-parse, the value is always
  // defined (the schema applies its default before output), so the
  // `?? 'default'` is a TypeScript-only fallback that matches the
  // schema's resolved default.
  const profileName = config.settings.defaultProfile ?? 'default';
  const profile = config.profiles[profileName];
  if (profile === undefined) {
    // Named profile is missing. Fall back to the 'default' profile's
    // sync.targets so the agent snapshot list still has meaningful
    // content (the test plan requires "populated target agents" even
    // for invalid-profile state). If the default profile is itself
    // missing or its targets are empty, fall back to registryOrder.
    const fallback = config.profiles.default;
    const fallbackTargets =
      fallback !== undefined && fallback.sync.targets.length > 0
        ? fallback.sync.targets
        : registryOrder;
    return {
      state: 'invalid-profile',
      profileName,
      intent: {},
      targetIds: fallbackTargets,
      reason: `Default profile "${profileName}" does not exist`,
    };
  }
  const targetIds =
    profile.sync.targets.length === 0 ? registryOrder : profile.sync.targets;
  const disabled = new Set(profile.sync.disabledServers);
  const mcpServers = profile.mcpServers;
  const intent: Record<string, OvertureMcpServer> = {};
  for (const name of Object.keys(mcpServers)) {
    if (disabled.has(name)) {
      continue;
    }
    const server = mcpServers[name];
    if (server === undefined) {
      continue;
    }
    intent[name] = server;
  }
  return {
    state: 'ready',
    profileName,
    intent,
    targetIds,
  };
}

/**
 * Derive the per-target id order used for both the snapshot list and the
 * global row sort. Known ids emit first in their `registryOrder` position;
 * unknown ids follow in ascending lexical order. Duplicates collapse.
 */
function orderTargetIds(
  targetIds: readonly string[],
  registryOrder: readonly string[],
): readonly string[] {
  const known = new Set(registryOrder);
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of registryOrder) {
    if (targetIds.includes(id) && !seen.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }
  for (const id of [...targetIds].filter((id) => !known.has(id)).sort()) {
    if (!seen.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }
  return ordered;
}

/**
 * Build the public `AgentSnapshot` for a target id. When an input is
 * present, the `servers` field is dropped (the snapshot is intentionally
 * server-free). When absent, a synthetic not-installed snapshot is built
 * with the approved reason.
 */
function snapshotForTarget(
  id: string,
  input: AgentScanInput | undefined,
): AgentSnapshot {
  if (input !== undefined) {
    const { servers: _ignored, ...snapshot } = input;
    return snapshot;
  }
  return {
    id,
    displayName: id,
    installed: false,
    mcpSupport: 'unknown',
    readState: 'not-installed',
    reason: `No scan input for target "${id}"`,
  };
}

/**
 * Build the synthetic unsupported-agent snapshot for a target id that is
 * not part of the four-agent registry. `installed: false` because
 * unsupported agents are not part of the host.
 */
function unsupportedSnapshotFor(id: string): AgentSnapshot {
  return {
    id,
    displayName: id,
    installed: false,
    mcpSupport: 'unsupported',
    readState: 'unsupported-agent',
    reason: `Target "${id}" is not supported by this Overture build`,
  };
}

/**
 * Build the full scan matrix from canonical config and per-agent scan
 * inputs. Pure, synchronous, and side-effect free: it never reads files,
 * inspects agent-native fields, or mutates any of its inputs.
 *
 * Output shape:
 *
 * - `canonicalState`, `canonicalProfileName`, `canonicalIntent`, and
 *   optional `reason` are derived from the config (absent / ready /
 *   invalid-profile).
 * - `agents` lists one `AgentSnapshot` per target id, ordered by
 *   `registryOrder` for known ids and lexicographically for unknown ids.
 *   Synthesized not-installed / unsupported-agent snapshots fill the
 *   gaps left by missing or unrecognized inputs.
 * - `rows` is the global concatenation of `compareAgentEntries` results
 *   for every read-ok target. The list is empty for the invalid-profile
 *   state (the plan pins that as the row count when the named profile
 *   is missing). Rows whose `canonicalName` is non-null emit first,
 *   sorted by canonical name ascending then by agent position; rows
 *   with a null `canonicalName` (agent-only entries) emit after, sorted
 *   by agent position then by agent server name.
 * Read states other than `read-ok` produce no rows for that agent but
 * still appear in the snapshot list (the input's snapshot view is used
 * verbatim, minus the `servers` field). `read-ok` without a `servers`
 * map behaves as an empty server map.
 */
export function buildScanMatrix(input: BuildScanMatrixInput): ScanMatrix {
  const { config, agents } = input;
  const registryOrder = input.registryOrder ?? DEFAULT_REGISTRY_ORDER;

  const inputById = new Map<string, AgentScanInput>();
  for (const agent of agents) {
    inputById.set(agent.id, agent);
  }
  const knownIds = new Set(registryOrder);

  const resolution = resolveCanonical(config, registryOrder);
  const orderedIds = orderTargetIds(resolution.targetIds, registryOrder);

  const matrixAgents: AgentSnapshot[] = [];
  for (const id of orderedIds) {
    if (!knownIds.has(id)) {
      matrixAgents.push(unsupportedSnapshotFor(id));
    } else {
      matrixAgents.push(snapshotForTarget(id, inputById.get(id)));
    }
  }

  const agentPosition = new Map<string, number>();
  orderedIds.forEach((id, index) => {
    agentPosition.set(id, index);
  });

  const rawRows: ServerStatusRow[] = [];
  // The plan pins `rows: []` for the invalid-profile state: the canonical
  // intent is empty (the named profile is missing), so even read-ok agents
  // cannot meaningfully compare against nothing. Skip row generation in
  // that state so the row list stays empty as the plan requires.
  if (resolution.state !== 'invalid-profile') {
    for (const id of orderedIds) {
      const agentInput = inputById.get(id);
      if (agentInput === undefined) {
        continue;
      }
      if (agentInput.readState !== 'read-ok') {
        continue;
      }
      for (const row of compareAgentEntries({
        canonical: resolution.intent,
        agent: agentInput.servers ?? {},
        agentId: id,
      })) {
        rawRows.push(row);
      }
    }
  }

  const canonicalRows: ServerStatusRow[] = [];
  const extraRows: ServerStatusRow[] = [];
  for (const row of rawRows) {
    if (row.canonicalName === null) {
      extraRows.push(row);
    } else {
      canonicalRows.push(row);
    }
  }

  canonicalRows.sort((left, right) => {
    const leftName = left.canonicalName ?? '';
    const rightName = right.canonicalName ?? '';
    if (leftName < rightName) {
      return -1;
    }
    if (leftName > rightName) {
      return 1;
    }
    return (
      (agentPosition.get(left.agentId) ?? 0) -
      (agentPosition.get(right.agentId) ?? 0)
    );
  });

  extraRows.sort((left, right) => {
    const leftPos = agentPosition.get(left.agentId) ?? 0;
    const rightPos = agentPosition.get(right.agentId) ?? 0;
    if (leftPos !== rightPos) {
      return leftPos - rightPos;
    }
    const leftName = left.agentServerName ?? '';
    const rightName = right.agentServerName ?? '';
    if (leftName < rightName) {
      return -1;
    }
    if (leftName > rightName) {
      return 1;
    }
    return 0;
  });

  const result: ScanMatrix = {
    canonicalState: resolution.state,
    canonicalProfileName: resolution.profileName,
    canonicalIntent: resolution.intent,
    agents: matrixAgents,
    rows: [...canonicalRows, ...extraRows],
  };
  if (resolution.reason !== undefined) {
    return { ...result, reason: resolution.reason };
  }
  return result;
}

/**
 * B3 - Per-name conflict classification reasons for hard-refuse entries.
 * Exhaustive union; extend by adding a new literal AND a new message template.
 */
export type HardRefuseReason =
  | 'parse-error'
  | 'shape-conflict'
  | 'mixed-transport-types'
  | 'canonical-settings-drift';

/**
 * B3 - One candidate entry inside a `PickableConflict.candidates` list.
 * Carries only stable data that renderers (C1/C2) and the bootstrap prompt (D2) need.
 */
export interface PickableConflictCandidate {
  readonly agentId: string;
  readonly displayName: string;
  readonly server: OvertureMcpServer;
}

/**
 * B3 - One bootstrap pickable conflict: same server name across two or more agents
 * with non-equal settings (and only emitted when `matrix.canonicalState === 'absent'`).
 */
export interface PickableConflict {
  readonly serverName: string;
  readonly candidates: readonly PickableConflictCandidate[];
  readonly message: string;
}

/**
 * B3 - One hard-refuse entry. `serverName`, `agentId`, and `displayName` are nullable
 * because some reasons span multiple agents without a single agent of blame.
 */
export interface HardRefuseConflict {
  readonly reason: HardRefuseReason;
  readonly serverName: string | null;
  readonly agentId: string | null;
  readonly displayName: string | null;
  readonly message: string;
}

/**
 * B3 - Full classification output. Both arrays are JSON-serializable plain data:
 * no `Map`, `Set`, `Date`, functions, classes, or `ServerStatusRow` references.
 */
export interface ConflictClassification {
  readonly pickable: readonly PickableConflict[];
  readonly hardRefuses: readonly HardRefuseConflict[];
}

/**
 * B3 - Classify a scan matrix into pickable conflicts and hard-refuse conflicts.
 * Initial implementation returns empty arrays; Task 2 and Task 3 populate them.
 *
 * Pure, synchronous, no I/O. Deterministic ordering:
 *   - `pickable` sorted by `serverName` ascending.
 *   - pickable `candidates` sorted by matrix agent order, falling back to `agentId` ascending.
 *   - `hardRefuses` sorted by `reason`, then `serverName ?? ''`, then `agentId ?? ''`.
 */
export function classifyConflicts(matrix: ScanMatrix): ConflictClassification {
  return { pickable: [], hardRefuses: [] };
}
