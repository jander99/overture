import { describe, expect, it } from 'vitest';
import type { ConflictClassification, ScanMatrix } from '@overture/scan-matrix';
import { formatHumanScanDetail } from './scan-human.js';

const zeroAgentMatrix: ScanMatrix = {
  canonicalState: 'absent',
  canonicalProfileName: null,
  canonicalIntent: {},
  agents: [
    {
      id: 'claude-code',
      displayName: 'Claude Code',
      installed: false,
      mcpSupport: 'supported',
      readState: 'not-installed',
    },
    {
      id: 'opencode',
      displayName: 'OpenCode',
      installed: false,
      mcpSupport: 'supported',
      readState: 'not-installed',
    },
    {
      id: 'github-copilot-cli',
      displayName: 'GitHub Copilot CLI',
      installed: false,
      mcpSupport: 'supported',
      readState: 'not-installed',
    },
    {
      id: 'openai-codex',
      displayName: 'OpenAI Codex',
      installed: false,
      mcpSupport: 'supported',
      readState: 'not-installed',
    },
  ],
  rows: [],
};

const noConflicts: ConflictClassification = {
  pickable: [],
  hardRefuses: [],
};

describe('formatHumanScanDetail', () => {
  it('renders the zero agents human scan golden', () => {
    const actual = formatHumanScanDetail(zeroAgentMatrix, noConflicts);

    expect(actual).toBe(`Scan complete.
Detected agents: 0 / 4
Canonical config: absent
Hard refuses: 0

Agents
  - Claude Code (claude-code): not installed, mcp=supported, read=not-installed
  - OpenCode (opencode): not installed, mcp=supported, read=not-installed
  - GitHub Copilot CLI (github-copilot-cli): not installed, mcp=supported, read=not-installed
  - OpenAI Codex (openai-codex): not installed, mcp=supported, read=not-installed

Aligned servers
  (none)

Missing from agents
  (none)

Agent-only servers
  (none)

Pickable conflicts
  (none)

Hard refuses
  (none)

Parse errors
  (none)

No supported MCP-capable agents detected.
Install one of these CLI agents on a supported OS (linux/darwin):
  - Claude Code
  - OpenCode
  - GitHub Copilot CLI
  - OpenAI Codex

Run "overture scan --json" for machine-readable details.`);
    expect(actual).not.toContain('\x1b[');
    expect(actual).not.toContain('"matrix"');
    expect(actual).not.toContain('"canonicalServer"');
    expect(actual).not.toContain('"agentServer"');
  });
});
