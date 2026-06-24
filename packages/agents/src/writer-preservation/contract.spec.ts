/**
 * Contract tests for the writer preservation harness.
 *
 * These tests use the intentionally-broken reference writers from
 * `__reference-writers__.ts` to prove the harness catches real
 * writer-shaped regressions. Each reference writer is a small
 * input→output transform that mimics what a future per-agent writer
 * might accidentally do (strip comments, reorder keys, delete
 * unrelated keys, drift whitespace, break idempotency, etc.).
 *
 * The contract: for each reference writer, the harness must fire the
 * expected preservation check. This proves the harness works against
 * real writer-shaped code, not just raw byte-mutator outputs.
 */

import { describe, expect, it } from 'vitest';

import { runPreservationChecks } from './run.js';
import {
  commentStrippingWriter,
  keyReorderingWriter,
  nonIdempotentWriter,
  preservingWriter,
  trailingNewlineDeletingWriter,
  unrelatedKeyDeletingWriter,
  unrelatedServerDeletingWriter,
  whitespaceDriftingWriter,
} from './__reference-writers__.js';
import { CLAUDE_CODE_FIXTURE, CODEX_FIXTURE } from './fixtures.js';

const claudeCode = CLAUDE_CODE_FIXTURE;
const codex = CODEX_FIXTURE;

const JSONC_TARGET: readonly string[] = ['mcpServers', 'filesystem'];
const TOML_TARGET: readonly string[] = ['mcp_servers', 'filesystem'];

interface ScenarioInput {
  readonly original: string;
  readonly format: 'json' | 'jsonc' | 'toml' | 'yaml';
  readonly targetPath: readonly string[];
}

function applyAndCheck(
  scenario: ScenarioInput,
  writer: (
    original: string,
    format: 'json' | 'jsonc' | 'toml' | 'yaml',
    targetPath: readonly string[],
  ) => string,
  applyWriterTwice = false,
): ReturnType<typeof runPreservationChecks> {
  const written = writer(
    scenario.original,
    scenario.format,
    scenario.targetPath,
  );
  const rewritten = applyWriterTwice
    ? writer(written, scenario.format, scenario.targetPath)
    : written;
  return runPreservationChecks({
    format: scenario.format,
    original: scenario.original,
    written,
    rewritten,
    targetPath: scenario.targetPath,
  });
}

function expectCheckFails(
  report: ReturnType<typeof runPreservationChecks>,
  name: string,
): void {
  const c = report.checks.find((x) => x.name === name);
  expect(c, `check ${name} missing`).toBeDefined();
  expect(c!.pass, `check ${name} should fail: ${c!.details}`).toBe(false);
}

function expectCheckPasses(
  report: ReturnType<typeof runPreservationChecks>,
  name: string,
): void {
  const c = report.checks.find((x) => x.name === name);
  expect(c, `check ${name} missing`).toBeDefined();
  expect(c!.pass, `check ${name} should pass: ${c!.details}`).toBe(true);
}

describe('contract — preservingWriter passes every check (jsonc)', () => {
  it('jsonc (claude-code): all checks pass', () => {
    const report = applyAndCheck(
      { original: claudeCode, format: 'jsonc', targetPath: JSONC_TARGET },
      preservingWriter,
    );
    expect(report.allPassed).toBe(true);
  });
});

describe('contract — commentStrippingWriter fires comments', () => {
  it('jsonc (claude-code): comments check fires', () => {
    const report = applyAndCheck(
      { original: claudeCode, format: 'jsonc', targetPath: JSONC_TARGET },
      commentStrippingWriter,
    );
    expect(report.allPassed).toBe(false);
    expectCheckFails(report, 'comments');
  });

  it('toml (codex): comments check fires', () => {
    const report = applyAndCheck(
      { original: codex, format: 'toml', targetPath: TOML_TARGET },
      commentStrippingWriter,
    );
    expect(report.allPassed).toBe(false);
    expectCheckFails(report, 'comments');
  });
});

describe('contract — keyReorderingWriter fires keyOrder', () => {
  it('jsonc (claude-code): keyOrder check fires', () => {
    const report = applyAndCheck(
      { original: claudeCode, format: 'jsonc', targetPath: JSONC_TARGET },
      keyReorderingWriter,
    );
    expect(report.allPassed).toBe(false);
    expectCheckFails(report, 'keyOrder');
  });
});

describe('contract — unrelatedKeyDeletingWriter fires topLevelKeys', () => {
  it('jsonc (claude-code): topLevelKeys check fires', () => {
    const report = applyAndCheck(
      { original: claudeCode, format: 'jsonc', targetPath: JSONC_TARGET },
      unrelatedKeyDeletingWriter,
    );
    expect(report.allPassed).toBe(false);
    expectCheckFails(report, 'topLevelKeys');
  });

  it('toml (codex): topLevelKeys check fires', () => {
    const report = applyAndCheck(
      { original: codex, format: 'toml', targetPath: TOML_TARGET },
      unrelatedKeyDeletingWriter,
    );
    expect(report.allPassed).toBe(false);
    expectCheckFails(report, 'topLevelKeys');
  });
});

describe('contract — unrelatedServerDeletingWriter fires mcpServers', () => {
  it('jsonc (claude-code): mcpServers check fires', () => {
    const report = applyAndCheck(
      { original: claudeCode, format: 'jsonc', targetPath: JSONC_TARGET },
      unrelatedServerDeletingWriter,
    );
    expect(report.allPassed).toBe(false);
    expectCheckFails(report, 'mcpServers');
  });

  it('toml (codex): mcpServers check fires', () => {
    const report = applyAndCheck(
      { original: codex, format: 'toml', targetPath: TOML_TARGET },
      unrelatedServerDeletingWriter,
    );
    expect(report.allPassed).toBe(false);
    expectCheckFails(report, 'mcpServers');
  });
});

describe('contract — whitespaceDriftingWriter fires formatting', () => {
  it('jsonc (claude-code): formatting check fires', () => {
    const report = applyAndCheck(
      { original: claudeCode, format: 'jsonc', targetPath: JSONC_TARGET },
      whitespaceDriftingWriter,
    );
    expect(report.allPassed).toBe(false);
    expectCheckFails(report, 'formatting');
  });
});

describe('contract — trailingNewlineDeletingWriter fires formatting', () => {
  it('jsonc (claude-code): formatting check fires', () => {
    const report = applyAndCheck(
      { original: claudeCode, format: 'jsonc', targetPath: JSONC_TARGET },
      trailingNewlineDeletingWriter,
    );
    expect(report.allPassed).toBe(false);
    expectCheckFails(report, 'formatting');
  });
});

describe('contract — nonIdempotentWriter fires idempotency', () => {
  it('jsonc (claude-code): idempotency check fires on second apply', () => {
    const report = applyAndCheck(
      { original: claudeCode, format: 'jsonc', targetPath: JSONC_TARGET },
      nonIdempotentWriter,
      /* applyWriterTwice */ true,
    );
    expect(report.allPassed).toBe(false);
    expectCheckFails(report, 'idempotency');
  });

  it('jsonc (claude-code): single apply + rewritten=written trivially passes idempotency, but rawBytes fires on the appended newline', () => {
    // nonIdempotentWriter appends '\n' to the output. The newline is at
    // the very end, outside any target subtree, so:
    //   - rawBytes fires (the appended byte is outside targetPath)
    //   - idempotency trivially holds (rewritten === written)
    //   - allPassed is false because rawBytes caught a real regression
    const report = applyAndCheck(
      { original: claudeCode, format: 'jsonc', targetPath: JSONC_TARGET },
      nonIdempotentWriter,
      /* applyWriterTwice */ false,
    );
    expect(report.allPassed).toBe(false);
    const idem = report.checks.find((c) => c.name === 'idempotency');
    expect(idem!.skipped).toBe(false);
    expect(idem!.pass).toBe(true);
    const raw = report.checks.find((c) => c.name === 'rawBytes');
    expect(raw!.pass).toBe(false);
  });
});

describe('contract — preservingWriter passes idempotency on second apply', () => {
  it('jsonc (claude-code): idempotency passes when apply is a no-op', () => {
    const report = applyAndCheck(
      { original: claudeCode, format: 'jsonc', targetPath: JSONC_TARGET },
      preservingWriter,
      /* applyWriterTwice */ true,
    );
    expectCheckPasses(report, 'idempotency');
    expect(report.allPassed).toBe(true);
  });
});
