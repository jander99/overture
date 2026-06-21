import { describe, expect, it } from 'vitest';
import { classifyConflicts } from '@overture/scan-matrix';
import { formatHumanScanDetail } from './scan-human.js';
import {
  expectCommonSanitization,
  expectSectionOrder,
  makeAgent,
  makeMatrix,
  makeRemoteServer,
  makeRow,
  makeStdioServer,
} from './scan-human/fixtures.js';

describe('formatHumanScanDetail redaction', () => {
  it('renders a remote row with URL redaction and header count', () => {
    const remoteServer = makeRemoteServer(
      'https://mcp.example.com/mcp?token=abc123#frag456',
      { Authorization: 'Bearer test-token' },
    );
    const matrix = makeMatrix({
      canonicalState: 'ready',
      canonicalProfileName: 'default',
      canonicalIntent: {
        context7: remoteServer,
      },
      agents: [
        makeAgent({
          id: 'claude-code',
          displayName: 'Claude Code',
          installed: true,
          readState: 'read-ok',
        }),
        makeAgent({ id: 'opencode', displayName: 'OpenCode' }),
        makeAgent({
          id: 'github-copilot-cli',
          displayName: 'GitHub Copilot CLI',
        }),
        makeAgent({ id: 'openai-codex', displayName: 'OpenAI Codex' }),
      ],
      rows: [
        makeRow({
          agentId: 'claude-code',
          canonicalName: 'context7',
          agentServerName: 'context7',
          status: 'aligned',
          canonicalServer: remoteServer,
          agentServer: remoteServer,
        }),
      ],
    });

    const conflicts = classifyConflicts(matrix);
    const out = formatHumanScanDetail(matrix, conflicts);

    expect(out).toContain(
      '  - context7 on Claude Code (claude-code): remote url=https://mcp.example.com/mcp?…#… headers=1',
    );
    expect(out).not.toContain('Bearer test-token');
    expect(out).not.toContain('abc123');
    expect(out).not.toContain('frag456');
    expectSectionOrder(out);
    expectCommonSanitization(out);
  });

  it('redacts env values, header values, arg values, bearer tokens, query and fragment values from stdio/remote output', () => {
    const secretArg = 'top-secret-arg-value';
    const bearerA = 'Bearer top-secret-token-a';
    const bearerB = 'Bearer another-secret-token-b';
    const matrix = makeMatrix({
      canonicalState: 'ready',
      canonicalProfileName: 'default',
      canonicalIntent: {
        secretServer: makeStdioServer('node', [secretArg], {
          Authorization: bearerA,
          DEBUG: '1',
        }),
      },
      agents: [
        makeAgent({
          id: 'claude-code',
          displayName: 'Claude Code',
          installed: true,
          readState: 'read-ok',
        }),
        makeAgent({ id: 'opencode', displayName: 'OpenCode' }),
        makeAgent({
          id: 'github-copilot-cli',
          displayName: 'GitHub Copilot CLI',
        }),
        makeAgent({ id: 'openai-codex', displayName: 'OpenAI Codex' }),
      ],
      rows: [
        makeRow({
          agentId: 'claude-code',
          canonicalName: 'secretServer',
          agentServerName: 'secretServer',
          status: 'aligned',
          canonicalServer: makeStdioServer('node', [secretArg], {
            Authorization: bearerA,
            DEBUG: '1',
          }),
          agentServer: makeStdioServer('node', [secretArg], {
            Authorization: bearerA,
            DEBUG: '1',
          }),
        }),
        makeRow({
          agentId: 'claude-code',
          canonicalName: 'remoteSecret',
          agentServerName: 'remoteSecret',
          status: 'aligned',
          canonicalServer: makeRemoteServer(
            'https://api.example.com/mcp?token=secret-query&key=value#frag=secret-fragment',
            { Authorization: bearerB, 'X-Trace': 'yes' },
          ),
          agentServer: makeRemoteServer(
            'https://api.example.com/mcp?token=secret-query&key=value#frag=secret-fragment',
            { Authorization: bearerB, 'X-Trace': 'yes' },
          ),
        }),
      ],
    });

    const conflicts = classifyConflicts(matrix);
    const out = formatHumanScanDetail(matrix, conflicts);

    expect(out).toContain('stdio command=node args=1 env=2');
    expect(out).toContain(
      'remote url=https://api.example.com/mcp?…#… headers=2',
    );
    expect(out).not.toContain(secretArg);
    expect(out).not.toContain(bearerA);
    expect(out).not.toContain(bearerB);
    expect(out).not.toContain('secret-query');
    expect(out).not.toContain('key=value');
    expect(out).not.toContain('frag=secret-fragment');
    expect(out).not.toContain('token=secret-query');
    expect(out).not.toContain('DEBUG=1');
    expectCommonSanitization(out);
  });

  it('renders <invalid-url> for malformed URLs and never throws', () => {
    for (const badUrl of ['not a valid url', '', 'http://', 'ht!tp://x']) {
      const matrix = makeMatrix({
        canonicalState: 'ready',
        canonicalProfileName: 'default',
        canonicalIntent: {
          badServer: makeRemoteServer(badUrl, { Authorization: 'Bearer x' }),
        },
        agents: [
          makeAgent({
            id: 'claude-code',
            displayName: 'Claude Code',
            installed: true,
            readState: 'read-ok',
          }),
          makeAgent({ id: 'opencode', displayName: 'OpenCode' }),
          makeAgent({
            id: 'github-copilot-cli',
            displayName: 'GitHub Copilot CLI',
          }),
          makeAgent({ id: 'openai-codex', displayName: 'OpenAI Codex' }),
        ],
        rows: [
          makeRow({
            agentId: 'claude-code',
            canonicalName: 'badServer',
            agentServerName: 'badServer',
            status: 'aligned',
            canonicalServer: makeRemoteServer(badUrl, {
              Authorization: 'Bearer x',
            }),
            agentServer: makeRemoteServer(badUrl, {
              Authorization: 'Bearer x',
            }),
          }),
        ],
      });
      const conflicts = classifyConflicts(matrix);
      let out = '';
      expect(() => {
        out = formatHumanScanDetail(matrix, conflicts);
      }).not.toThrow();
      expect(out).toContain('remote url=<invalid-url>');
      expect(out).not.toContain('Bearer x');
    }
  });
});
