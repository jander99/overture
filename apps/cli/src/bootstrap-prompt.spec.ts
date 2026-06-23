/**
 * D2 - Spec for the interactive bootstrap prompt primitive.
 *
 * Covers the pure renderer (`formatPickablePrompt`) and parser
 * (`parsePickableAnswer`) plus the injectable readline adapter
 * (`createReadlinePrompt`). `createStdinPrompt` is intentionally not
 * exercised here because it would attach to the real process stdio.
 */
import { describe, expect, it, vi } from 'vitest';
import type { OvertureMcpServer } from '@overture/config';
import type {
  PickableConflict,
  PickableConflictCandidate,
} from '@overture/scan-matrix';

import {
  createReadlinePrompt,
  formatPickablePrompt,
  parsePickableAnswer,
} from './bootstrap-prompt.js';
import { renderFingerprint } from './scan-human/fingerprint.js';

function stdioCandidate(
  agentId: string,
  displayName: string,
  server: Extract<OvertureMcpServer, { type: 'stdio' }>,
): PickableConflictCandidate {
  return { agentId, displayName, server };
}

function remoteCandidate(
  agentId: string,
  displayName: string,
  server: Extract<OvertureMcpServer, { type: 'remote' }>,
): PickableConflictCandidate {
  return { agentId, displayName, server };
}

describe('formatPickablePrompt', () => {
  it('2-candidate: exact-string render with stdio servers (no headers)', () => {
    const conflict: PickableConflict = {
      serverName: 'filesystem',
      message: '',
      candidates: [
        stdioCandidate('claude-code', 'claude-code', {
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem'],
        }),
        stdioCandidate('opencode', 'opencode', {
          type: 'stdio',
          command: 'mcp-fs',
        }),
      ],
    };

    const out = formatPickablePrompt(conflict);

    const expected = [
      'Pickable conflict: filesystem',
      `  1) claude-code (claude-code): ${renderFingerprint(conflict.candidates[0].server)}`,
      `  2) opencode (opencode): ${renderFingerprint(conflict.candidates[1].server)}`,
      '  s) skip this server (default)',
      'Choose canonical entry [1-2, s=skip, q=abort]: ',
    ].join('\n');

    expect(out).toBe(expected);
  });

  it('3-candidate: exact-string render with one stdio and two remotes (distinct URLs)', () => {
    const conflict: PickableConflict = {
      serverName: 'context7',
      message: '',
      candidates: [
        stdioCandidate('claude-code', 'claude-code', {
          type: 'stdio',
          command: 'mcp-fs',
        }),
        remoteCandidate('opencode', 'opencode', {
          type: 'remote',
          url: 'https://mcp.example.com/?api_key=secret&x=1',
        }),
        remoteCandidate('openai-codex', 'openai-codex', {
          type: 'remote',
          url: 'https://other.example.com/?token=abc',
        }),
      ],
    };

    const out = formatPickablePrompt(conflict);

    const expected = [
      'Pickable conflict: context7',
      `  1) claude-code (claude-code): ${renderFingerprint(conflict.candidates[0].server)}`,
      `  2) opencode (opencode): ${renderFingerprint(conflict.candidates[1].server)}`,
      `  3) openai-codex (openai-codex): ${renderFingerprint(conflict.candidates[2].server)}`,
      '  s) skip this server (default)',
      'Choose canonical entry [1-3, s=skip, q=abort]: ',
    ].join('\n');

    expect(out).toBe(expected);
  });

  it('redaction: never leaks api_key / Bearer / schema / matrix / agentServer / canonicalServer / headers / Authorization', () => {
    const conflict: PickableConflict = {
      serverName: 'leaky',
      message: '',
      candidates: [
        remoteCandidate('claude-code', 'claude-code', {
          type: 'remote',
          url: 'https://mcp.example.com/?api_key=secret&x=1',
          headers: { Authorization: 'Bearer leaked' },
        }),
      ],
    };

    const out = formatPickablePrompt(conflict);

    for (const banned of [
      'api_key=',
      'Bearer ',
      '$schema',
      'matrix',
      'agentServer',
      'canonicalServer',
      'headers: {',
      'Authorization',
    ]) {
      expect(out).not.toContain(banned);
    }
  });

  it('suffix: prompt line ends with ": " and overall output ends with newline', () => {
    const conflict: PickableConflict = {
      serverName: 'filesystem',
      message: '',
      candidates: [
        stdioCandidate('claude-code', 'claude-code', {
          type: 'stdio',
          command: 'npx',
        }),
        stdioCandidate('opencode', 'opencode', {
          type: 'stdio',
          command: 'mcp-fs',
        }),
      ],
    };

    const out = formatPickablePrompt(conflict);

    // Prompt line ends with ': ' (single trailing space), not '\n'; exact-string cases above pin this.
    expect(out.endsWith('\n')).toBe(false);
  });
});

describe('parsePickableAnswer', () => {
  const cases: readonly (readonly [
    string,
    number,
    ReturnType<typeof parsePickableAnswer>,
  ])[] = [
    ['', 2, { kind: 'skipped' }],
    ['   ', 2, { kind: 'skipped' }],
    ['s', 2, { kind: 'skipped' }],
    ['S', 2, { kind: 'skipped' }],
    ['skip', 2, { kind: 'skipped' }],
    ['Skip', 2, { kind: 'skipped' }],
    ['SKIP', 2, { kind: 'skipped' }],
    ['q', 2, { kind: 'abort' }],
    ['Q', 2, { kind: 'abort' }],
    ['quit', 2, { kind: 'abort' }],
    ['abort', 2, { kind: 'abort' }],
    ['exit', 2, { kind: 'abort' }],
    ['  q  ', 2, { kind: 'abort' }],
    ['1', 2, { kind: 'selected', candidateIndex: 0 }],
    ['2', 2, { kind: 'selected', candidateIndex: 1 }],
    ['1', 3, { kind: 'selected', candidateIndex: 0 }],
    ['3', 3, { kind: 'selected', candidateIndex: 2 }],
    ['3', 2, { kind: 'invalid' }],
    ['0', 2, { kind: 'invalid' }],
    ['-1', 2, { kind: 'invalid' }],
    ['1.5', 2, { kind: 'invalid' }],
    ['foo', 2, { kind: 'invalid' }],
    ['  1  ', 2, { kind: 'selected', candidateIndex: 0 }],
  ];

  for (const [input, candidateCount, expected] of cases) {
    it(`maps ${JSON.stringify(input)} (n=${candidateCount}) -> ${expected.kind}`, () => {
      expect(parsePickableAnswer(input, candidateCount)).toEqual(expected);
    });
  }
});
describe('createReadlinePrompt', () => {
  it('returns the trimmed stubbed answer', async () => {
    const rl = {
      question: vi.fn((_msg: string) => Promise.resolve('1')),
      close: vi.fn(),
    };
    const ask = createReadlinePrompt(rl);

    expect(await ask('pick: ')).toBe('1');
    expect(rl.question).toHaveBeenCalledWith('pick: ');
  });

  it('strips surrounding whitespace from the stubbed answer', async () => {
    const rl = {
      question: vi.fn((_msg: string) => Promise.resolve('  q  ')),
      close: vi.fn(),
    };
    const ask = createReadlinePrompt(rl);

    expect(await ask('pick: ')).toBe('q');
  });

  it('returns null when the underlying reader rejects (EOF)', async () => {
    const rl = {
      question: vi.fn(() => {
        throw new Error('eof');
      }),
      close: vi.fn(),
    };

    const ask = createReadlinePrompt(rl);

    expect(await ask('pick: ')).toBeNull();
  });
});

// createStdinPrompt is not unit-tested: would attach to the real process stdio.
