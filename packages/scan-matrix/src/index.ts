/**
 * Public `@overture/scan-matrix` surface.
 *
 * B1 is a pure TypeScript model; it does not import I/O, parsers, or renderers.
 * Equality happens after B2-style normalization: B1 consumes `OvertureMcpServer`
 * only via `NormalizedAgentServer.server`. Native-agent fields, display-shaped
 * entries produced by per-agent renderers, and config-file reads are
 * explicitly out of scope here.
 *
 * Behavior (`serverSettingsEqual`, `compareAgentEntries`, `buildScanMatrix`)
 * lands in later tasks; this module is type-only.
 */
import type { OvertureConfig, OvertureMcpServer } from '@overture/config';
import type { McpSupport } from '@overture/agents';

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
