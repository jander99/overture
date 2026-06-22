import { describe, expect, it } from 'vitest';

import type {
  BootstrapBlocker,
  BootstrapPlan,
  BootstrapProposal,
} from './bootstrap.js';
import { formatHumanBootstrapProposal } from './bootstrap-human.js';
import { renderFingerprint } from './scan-human/fingerprint.js';

const SCHEMA_URL =
  'https://raw.githubusercontent.com/jander99/overture/main/schemas/overture.config.schema.json';

function baseProposal(
  overrides: Partial<BootstrapProposal> = {},
): BootstrapProposal {
  return {
    status: 'ready',
    configPath: '/tmp/overture.jsonc',
    config: {
      $schema: SCHEMA_URL,
      version: 1,
      settings: {
        defaultProfile: 'default',
        dryRunByDefault: true,
        backupBeforeWrite: true,
        conflictPolicy: 'refuse',
      },
      profiles: {
        default: {
          mcpServers: {},
          sync: {
            targets: ['claude-code', 'opencode'],
            disabledServers: [],
          },
          skills: [],
        },
      },
    },
    adoptedServers: [],
    targetAgents: ['claude-code', 'opencode'],
    ...overrides,
  };
}

function basePlan(overrides: Partial<BootstrapPlan> = {}): BootstrapPlan {
  return {
    proposal: baseProposal(),
    conflicts: { pickable: [], hardRefuses: [] },
    blockers: [],
    ...overrides,
  };
}

describe('formatHumanBootstrapProposal', () => {
  it('renders ready sections and footer deterministically', () => {
    const plan = basePlan({
      proposal: baseProposal({
        adoptedServers: [
          {
            name: 'filesystem',
            source: 'all-agents-equal',
            agentIds: ['claude-code', 'opencode', 'github-copilot-cli'],
          },
        ],
      }),
    });

    const output = formatHumanBootstrapProposal(plan);

    expect(output).toContain('Bootstrap proposal (dry-run)');
    expect(output).toContain('Config path: /tmp/overture.jsonc');
    expect(output).toContain('Proposal status: ready');
    expect(output).toContain('Target agents: claude-code, opencode');
    expect(output).toContain('Adopted servers: 1');
    expect(output).toContain(
      '  - filesystem (all-agents-equal) from claude-code, opencode, github-copilot-cli',
    );
    expect(output).toContain('No files were written.');
    expect(output).toContain(
      'Run "overture bootstrap --dry-run --json" for machine-readable details.',
    );
  });

  it('renders blocked sections, redacts urls, and shows hard refuses', () => {
    const plan = basePlan({
      proposal: baseProposal({ status: 'blocked' }),
      conflicts: {
        pickable: [
          {
            serverName: 'context7',
            candidates: [
              {
                agentId: 'claude-code',
                displayName: 'Claude Code',
                server: {
                  type: 'remote',
                  url: 'https://api.example.com?api_key=secret',
                  headers: { Authorization: 'Bearer secret' },
                },
              },
            ],
            message:
              'Pick one from https://api.example.com?api_key=secret for context7.',
          },
        ],
        hardRefuses: [
          {
            reason: 'mixed-transport-types',
            serverName: 'context7',
            agentId: null,
            displayName: null,
            message:
              'Cannot classify server "context7" because agents disagree on transport type (remote, stdio). See https://mcp.context7.com/mcp?api_key=secret.',
          },
        ],
      },
    });

    const output = formatHumanBootstrapProposal(plan);

    expect(output).toContain('Proposal status: blocked');
    expect(output).toContain('Pickable conflicts: 1');
    expect(output).toContain('Hard refuses: 1');
    expect(output).toContain('https://api.example.com/?…');
    expect(output).toContain('https://mcp.context7.com/mcp?…');
    expect(output).not.toContain('api_key=secret');
    expect(output).toContain('No files were written.');
  });

  it('renders no-readable-agents blockers', () => {
    const plan = basePlan({
      proposal: baseProposal({
        status: 'blocked',
        targetAgents: [],
      }),
      blockers: [{ reason: 'no-readable-agents' } satisfies BootstrapBlocker],
    });

    const output = formatHumanBootstrapProposal(plan);

    expect(output).toContain('Target agents: (none)');
    expect(output).toContain('Blockers: 1');
    expect(output).toContain('no-readable-agents');
  });

  it('is byte-identical for repeated calls', () => {
    const plan = basePlan();
    expect(formatHumanBootstrapProposal(plan)).toBe(
      formatHumanBootstrapProposal(plan),
    );
  });

  it('redacts urls via the shared fingerprint helper', () => {
    expect(
      renderFingerprint({
        type: 'remote',
        url: 'https://mcp.context7.com/mcp?api_key=secret',
        headers: {},
      }),
    ).toBe('remote url=https://mcp.context7.com/mcp?… headers=0');
  });

  it('does not emit ansi escape codes', () => {
    const output = formatHumanBootstrapProposal(basePlan());
    expect(/\x1b\[[0-9;]*m/.test(output)).toBe(false);
  });
});
