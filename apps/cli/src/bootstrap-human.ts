import { renderFingerprint, redactUrl } from './scan-human/fingerprint.js';

import type { BootstrapBlocker, BootstrapPlan } from './bootstrap.js';
import type { InteractiveResolutionResult } from './bootstrap-resolution.js';

type PickableConflictList = BootstrapPlan['conflicts']['pickable'];
type HardRefuseConflictList = BootstrapPlan['conflicts']['hardRefuses'];

export function formatHumanBootstrapProposal(plan: BootstrapPlan): string {
  const lines: string[] = ['Bootstrap proposal (dry-run)'];

  lines.push(`Config path: ${plan.proposal.configPath}`);
  lines.push(`Proposal status: ${plan.proposal.status}`);
  lines.push(
    `Target agents: ${
      plan.proposal.targetAgents.length > 0
        ? plan.proposal.targetAgents.join(', ')
        : '(none)'
    }`,
  );

  lines.push(`Adopted servers: ${plan.proposal.adoptedServers.length}`);
  for (const adopted of sortByName(plan.proposal.adoptedServers)) {
    lines.push(
      `  - ${adopted.name} (${adopted.source}) from ${adopted.agentIds.join(', ')}`,
    );
  }

  lines.push(`Pickable conflicts: ${plan.conflicts.pickable.length}`);
  for (const conflict of sortPickable(plan.conflicts.pickable)) {
    lines.push(`  - ${redactMessageUrls(conflict.message)}`);
    for (const candidate of [...conflict.candidates].sort((left, right) =>
      left.agentId.localeCompare(right.agentId),
    )) {
      lines.push(
        `    candidate ${candidate.displayName} (${candidate.agentId}): ${renderFingerprint(candidate.server)}`,
      );
    }
  }

  lines.push(`Hard refuses: ${plan.conflicts.hardRefuses.length}`);
  for (const conflict of sortHardRefuses(plan.conflicts.hardRefuses)) {
    lines.push(`  - ${redactMessageUrls(conflict.message)}`);
  }

  lines.push(`Blockers: ${plan.blockers.length}`);
  for (const blocker of plan.blockers) {
    lines.push(`  - ${renderBlocker(blocker)}`);
  }

  lines.push('No files were written.');
  lines.push(
    'Run "overture bootstrap --dry-run --json" for machine-readable details.',
  );
  return `${lines.join('\n')}\n`;
}

/**
 * D2 - Render the final read-only interactive summary. A sibling renderer to
 * `formatHumanBootstrapProposal`: the dry-run path emits the full proposal
 * (config preview, target agents, pickable candidate fingerprints), while
 * this interactive path emits a tighter summary that surfaces only the
 * proposal fields the user needs to verify the resolution plus the
 * in-memory decisions they made.
 *
 * Section ordering (fixed):
 *   heading, config path, status, adopted servers, pickable conflicts,
 *   hard refuses, blockers, resolved conflicts, skipped conflicts,
 *   no-files footer.
 *
 * Deterministic, plain-text, no ANSI. URL-bearing messages from hard
 * refuses are redacted via `redactMessageUrls`. No raw env/headers/full
 * URLs/`$schema`/`matrix`/`agentServer`/`canonicalServer` is ever emitted.
 * No files are written; the footer reflects that explicitly.
 */
export function formatHumanInteractiveResult(
  result: InteractiveResolutionResult,
): string {
  const lines: string[] = ['Bootstrap proposal (interactive)'];

  lines.push(`Config path: ${result.plan.proposal.configPath}`);
  lines.push(`Proposal status: ${result.plan.proposal.status}`);

  lines.push(`Adopted servers: ${result.plan.proposal.adoptedServers.length}`);
  for (const adopted of sortByName(result.plan.proposal.adoptedServers)) {
    lines.push(
      `  - ${adopted.name} (${adopted.source}) from ${adopted.agentIds.join(', ')}`,
    );
  }

  // Pickable conflicts: count only. After a successful interactive run the
  // caller has decided every pickable (selected or skipped), so this count
  // is always 0 here; the boot command exits 1 before reaching this renderer
  // when pickables remain un-decided.
  lines.push(`Pickable conflicts: ${result.plan.conflicts.pickable.length}`);

  lines.push(`Hard refuses: ${result.plan.conflicts.hardRefuses.length}`);
  for (const conflict of sortHardRefuses(result.plan.conflicts.hardRefuses)) {
    lines.push(`  - ${redactMessageUrls(conflict.message)}`);
  }

  lines.push(`Blockers: ${result.plan.blockers.length}`);
  for (const blocker of result.plan.blockers) {
    lines.push(`  - ${renderBlocker(blocker)}`);
  }

  lines.push(`Resolved conflicts: ${result.resolvedConflicts.length}`);
  for (const entry of result.resolvedConflicts) {
    lines.push(
      `  - ${entry.serverName}: ${entry.displayName} (${entry.agentId})`,
    );
  }

  lines.push(`Skipped conflicts: ${result.skippedConflicts.length}`);
  for (const name of result.skippedConflicts) {
    lines.push(`  - ${name}`);
  }

  lines.push('No files were written.');

  return `${lines.join('\n')}\n`;
}

function renderBlocker(blocker: BootstrapBlocker): string {
  return blocker.reason;
}

function redactMessageUrls(message: string): string {
  return message.replace(/https?:\/\/[^\s"'<>)]+/g, (url) => redactUrl(url));
}

function sortByName<T extends { readonly name: string }>(
  entries: readonly T[],
): T[] {
  return [...entries].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

function sortPickable(conflicts: PickableConflictList): PickableConflictList {
  return [...conflicts].sort((left, right) =>
    left.serverName.localeCompare(right.serverName),
  );
}

function sortHardRefuses(
  conflicts: HardRefuseConflictList,
): HardRefuseConflictList {
  return [...conflicts].sort((left, right) => {
    const reasonOrder = left.reason.localeCompare(right.reason);
    if (reasonOrder !== 0) return reasonOrder;
    return (left.serverName ?? '').localeCompare(right.serverName ?? '');
  });
}
