import { renderFingerprint, redactUrl } from './scan-human/fingerprint.js';

import type { BootstrapBlocker, BootstrapPlan } from './bootstrap.js';

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
