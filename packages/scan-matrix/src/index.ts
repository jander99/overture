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
