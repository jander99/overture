import type { OvertureMcpServer } from '@overture/config';

import type {
  BootstrapAdoptedServer,
  BootstrapPlan,
  BootstrapProposal,
} from './bootstrap.js';

/**
 * D2 Wave 1 - One interactive resolution decision supplied by the prompt
 * adapter (Wave 2). Decisions are passed in as a readonly array; this module
 * never reads from stdin or any other I/O source.
 *
 * - `selected`: pick candidate N (0-based) of the pickable conflict named
 *   `serverName`.
 * - `skipped`: drop the pickable conflict named `serverName` from the
 *   proposal.
 * - `abort`: short-circuit. The original plan is returned unchanged with
 *   `aborted: true`.
 */
export type InteractiveResolution =
  | {
      readonly kind: 'selected';
      readonly serverName: string;
      readonly candidateIndex: number;
    }
  | { readonly kind: 'skipped'; readonly serverName: string }
  | { readonly kind: 'abort' };

/**
 * Per-server summary of a selected pickable. The `agentId` and `displayName`
 * reflect the candidate the user picked, not the union of candidates.
 */
export interface ResolvedConflictSummary {
  readonly serverName: string;
  readonly agentId: string;
  readonly displayName: string;
}

/**
 * D2 Wave 1 - Pure resolution result. `plan` is a deep clone of the input
 * plan with the decisions applied: selected pickables are folded into the
 * proposal config and adopted servers, skipped pickables are removed from
 * the proposal and recorded in `skippedConflicts`. `aborted: true` means
 * the caller supplied a `kind: 'abort'` decision and the input plan is
 * returned unchanged (no clone is required).
 */
export interface InteractiveResolutionResult {
  readonly plan: BootstrapPlan;
  readonly resolvedConflicts: readonly ResolvedConflictSummary[];
  readonly skippedConflicts: readonly string[];
  readonly aborted: boolean;
}

/**
 * D2 Wave 1 - Apply a list of per-conflict decisions to a `BootstrapPlan`.
 *
 * Pure: no I/O, no fs, no readline, no `process.exit`, no `process.stdin`.
 *
 * Mutation: the input `plan`, the input `decisions`, and any nested object
 * reachable from them are not modified. The returned `plan` is a fresh
 * object graph constructed from cloned input slices.
 *
 * Status semantics:
 *   - `kind: 'abort'` short-circuits and returns the input plan with
 *     `aborted: true` and no other state mutated.
 *   - Otherwise, the new `proposal.status` is `'ready'` iff there are no
 *     hard refuses, no blockers, and no remaining (un-decided) pickables.
 *   - Hard refuses and blockers are passed through untouched.
 *
 * Validation (throws `Error` with a descriptive message):
 *   - Unknown `serverName` (not in `plan.conflicts.pickable`).
 *   - Out-of-range `candidateIndex` for a `selected` decision.
 *   - Duplicate `serverName` across decisions (the first duplicate
 *     encountered in `decisions` order throws).
 */
export function applyInteractiveResolutions(
  plan: BootstrapPlan,
  decisions: readonly InteractiveResolution[],
): InteractiveResolutionResult {
  if (decisions.some((decision) => decision.kind === 'abort')) {
    return {
      plan,
      resolvedConflicts: [],
      skippedConflicts: [],
      aborted: true,
    };
  }

  const pickableByServer = new Map<
    string,
    BootstrapPlan['conflicts']['pickable'][number]
  >();
  for (const conflict of plan.conflicts.pickable) {
    pickableByServer.set(conflict.serverName, conflict);
  }

  const seenServerNames = new Set<string>();
  const appliedSelections: {
    readonly serverName: string;
    readonly candidateIndex: number;
    readonly candidate: BootstrapPlan['conflicts']['pickable'][number]['candidates'][number];
  }[] = [];
  const appliedSkips: string[] = [];

  for (const decision of decisions) {
    if (decision.kind === 'abort') {
      // unreachable: handled above, but satisfies the discriminated narrowing.
      continue;
    }
    if (seenServerNames.has(decision.serverName)) {
      throw new Error(
        `applyInteractiveResolutions: duplicate decision for pickable serverName "${decision.serverName}". Each pickable may be resolved at most once.`,
      );
    }
    const conflict = pickableByServer.get(decision.serverName);
    if (conflict === undefined) {
      throw new Error(
        `applyInteractiveResolutions: unknown serverName "${decision.serverName}". Decisions may only reference names listed in plan.conflicts.pickable.`,
      );
    }
    if (decision.kind === 'skipped') {
      seenServerNames.add(decision.serverName);
      appliedSkips.push(decision.serverName);
      continue;
    }
    const { candidateIndex, serverName } = decision;
    if (
      !Number.isInteger(candidateIndex) ||
      candidateIndex < 0 ||
      candidateIndex >= conflict.candidates.length
    ) {
      throw new Error(
        `applyInteractiveResolutions: candidateIndex ${candidateIndex} is out of range for serverName "${serverName}" (candidates: ${conflict.candidates.length}).`,
      );
    }
    const candidate = conflict.candidates[candidateIndex];
    if (candidate === undefined) {
      // Defensive: the bounds check above guarantees this is unreachable.
      throw new Error(
        `applyInteractiveResolutions: candidate at index ${candidateIndex} is missing for serverName "${serverName}".`,
      );
    }
    seenServerNames.add(serverName);
    appliedSelections.push({ serverName, candidateIndex, candidate });
  }

  const resolvedConflicts: ResolvedConflictSummary[] = appliedSelections
    .map(({ serverName, candidate }) => ({
      serverName,
      agentId: candidate.agentId,
      displayName: candidate.displayName,
    }))
    .sort((left, right) => left.serverName.localeCompare(right.serverName));

  const skippedConflicts: string[] = [...appliedSkips].sort((left, right) =>
    left.localeCompare(right),
  );

  const existingMcpServers: Record<string, OvertureMcpServer> = {
    ...plan.proposal.config.profiles.default.mcpServers,
  };
  const newMcpServers: Record<string, OvertureMcpServer> = {
    ...existingMcpServers,
  };
  for (const selection of appliedSelections) {
    newMcpServers[selection.serverName] = cloneMcpServer(
      selection.candidate.server,
    );
  }

  const selectedAdoptions: BootstrapAdoptedServer[] = appliedSelections
    .map(
      ({ serverName, candidate }): BootstrapAdoptedServer => ({
        name: serverName,
        source: 'selected-conflict',
        agentIds: [candidate.agentId],
      }),
    )
    .sort((left, right) => left.name.localeCompare(right.name));

  const existingAdopted = [...plan.proposal.adoptedServers];
  const mergedAdopted = [...existingAdopted, ...selectedAdoptions].sort(
    (left, right) => left.name.localeCompare(right.name),
  );

  const remainingPickable = plan.conflicts.pickable.filter(
    (conflict) => !seenServerNames.has(conflict.serverName),
  );

  const newStatus: BootstrapProposal['status'] =
    plan.conflicts.hardRefuses.length === 0 &&
    plan.blockers.length === 0 &&
    remainingPickable.length === 0
      ? 'ready'
      : 'blocked';

  const newPlan: BootstrapPlan = {
    proposal: {
      ...plan.proposal,
      status: newStatus,
      config: {
        ...plan.proposal.config,
        profiles: {
          ...plan.proposal.config.profiles,
          default: {
            ...plan.proposal.config.profiles.default,
            mcpServers: newMcpServers,
          },
        },
      },
      adoptedServers: mergedAdopted,
    },
    conflicts: {
      pickable: remainingPickable,
      hardRefuses: plan.conflicts.hardRefuses,
    },
    blockers: plan.blockers,
  };

  return {
    plan: newPlan,
    resolvedConflicts,
    skippedConflicts,
    aborted: false,
  };
}

function cloneMcpServer(server: OvertureMcpServer): OvertureMcpServer {
  if (server.type === 'stdio') {
    return {
      type: 'stdio',
      command: server.command,
      args: server.args === undefined ? undefined : [...server.args],
      env: server.env === undefined ? undefined : { ...server.env },
    };
  }
  return {
    type: 'remote',
    url: server.url,
    headers: server.headers === undefined ? undefined : { ...server.headers },
  };
}
