/**
 * Tests for the writer preservation harness.
 *
 * These tests are the E1 RED→GREEN contract. Each scenario proves a
 * specific preservation property:
 *
 *   S1  identity write passes all checks (every format)
 *   S2  comment loss is detected (jsonc, toml)
 *   S3  key reorder outside targetPath is detected
 *   S4  unrelated top-level key deletion is detected
 *   S5  unrelated MCP server deletion is detected
 *   S6  whitespace drift is detected
 *   S7  idempotency check fires when second apply drifts
 *   S8  targeted key reorder inside targetPath is NOT flagged
 *   S9  non-target-path comment edits fail
 *   S10 all four formats are covered
 *
 * The byte-mutators from `byte-mutators.ts` produce the
 * known-broken inputs.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  appendString,
  deleteMcpServer,
  deleteTopLevelKey,
  deleteTrailingNewline,
  driftIndentation,
  stripComments,
  swapMcpServers,
  swapTopLevelKeys,
} from './byte-mutators.js';
import { runPreservationChecks } from './run.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURE_DIR, name), 'utf8');
}

const opencode = loadFixture('opencode.jsonc');
const claudeCode = loadFixture('claude-code.jsonc');
const copilotCli = loadFixture('copilot-cli.jsonc');
const codex = loadFixture('codex.toml');

/** Convenience: run the harness with just original/written. */
function check(
  format: 'json' | 'jsonc' | 'toml' | 'yaml',
  original: string,
  written: string,
  targetPath: readonly string[],
): ReturnType<typeof runPreservationChecks> {
  return runPreservationChecks({ format, original, written, targetPath });
}

/** Find a check by name in a report. */
function findCheck(
  report: ReturnType<typeof runPreservationChecks>,
  name: string,
) {
  const c = report.checks.find((x) => x.name === name);
  if (c === undefined) throw new Error(`check ${name} missing`);
  return c;
}

describe('S1 — identity write passes all checks', () => {
  it('jsonc (claude-code): identity write passes', () => {
    const report = check('jsonc', claudeCode, claudeCode, [
      'mcpServers',
      'filesystem',
    ]);
    expect(report.allPassed).toBe(true);
    for (const c of report.checks) {
      expect(c.pass, `check ${c.name}: ${c.details}`).toBe(true);
    }
  });

  it('jsonc (opencode): identity write passes', () => {
    const report = check('jsonc', opencode, opencode, ['mcp', 'filesystem']);
    expect(report.allPassed).toBe(true);
    for (const c of report.checks) {
      expect(c.pass, `check ${c.name}: ${c.details}`).toBe(true);
    }
  });

  it('jsonc (copilot-cli): identity write passes', () => {
    const report = check('jsonc', copilotCli, copilotCli, [
      'mcpServers',
      'filesystem',
    ]);
    expect(report.allPassed).toBe(true);
    for (const c of report.checks) {
      expect(c.pass, `check ${c.name}: ${c.details}`).toBe(true);
    }
  });

  it('toml (codex): identity write passes', () => {
    const report = check('toml', codex, codex, ['mcp_servers', 'filesystem']);
    expect(report.allPassed).toBe(true);
    for (const c of report.checks) {
      expect(c.pass, `check ${c.name}: ${c.details}`).toBe(true);
    }
  });
});

describe('S2 — comment loss is detected', () => {
  it('jsonc: stripping // comments fires the comments check', () => {
    const written = stripComments(claudeCode, 'jsonc');
    const report = check('jsonc', claudeCode, written, [
      'mcpServers',
      'filesystem',
    ]);
    expect(report.allPassed).toBe(false);
    expect(findCheck(report, 'comments').pass).toBe(false);
  });

  it('jsonc: stripping /* block */ comments fires the comments check', () => {
    // claudeCode has a /* MCP server inventory */ block comment.
    const written = stripComments(claudeCode, 'jsonc');
    const report = check('jsonc', claudeCode, written, [
      'mcpServers',
      'filesystem',
    ]);
    expect(findCheck(report, 'comments').pass).toBe(false);
  });

  it('toml: stripping # comments fires the comments check', () => {
    const written = stripComments(codex, 'toml');
    const report = check('toml', codex, written, ['mcp_servers', 'filesystem']);
    expect(report.allPassed).toBe(false);
    expect(findCheck(report, 'comments').pass).toBe(false);
  });

  it('json: comments check is not in the report (JSON has no comments)', () => {
    const report = check('json', claudeCode, claudeCode, [
      'mcpServers',
      'filesystem',
    ]);
    // For plain JSON the comments check is not applicable and is not
    // included in the report. JSONC/TOML/YAML do include it (skipped).
    expect(report.checks.find((c) => c.name === 'comments')).toBeUndefined();
  });
});

describe('S3 — key reorder outside targetPath is detected', () => {
  it('jsonc: swapping numStartups and autoUpdaterStatus fires keyOrder', () => {
    const written = swapTopLevelKeys(
      claudeCode,
      'jsonc',
      'numStartups',
      'autoUpdaterStatus',
    );
    const report = check('jsonc', claudeCode, written, [
      'mcpServers',
      'filesystem',
    ]);
    expect(report.allPassed).toBe(false);
    expect(findCheck(report, 'keyOrder').pass).toBe(false);
  });

  it('jsonc: swapping two unrelated MCP servers fires keyOrder', () => {
    const written = swapMcpServers(
      claudeCode,
      'jsonc',
      'mcpServers',
      'filesystem',
      'context7',
    );
    const report = check('jsonc', claudeCode, written, [
      'mcpServers',
      'filesystem',
    ]);
    expect(report.allPassed).toBe(false);
    expect(findCheck(report, 'keyOrder').pass).toBe(false);
  });
});

describe('S4 — unrelated top-level key deletion is detected', () => {
  it('jsonc: deleting numStartups fires topLevelKeys', () => {
    const written = deleteTopLevelKey(claudeCode, 'jsonc', 'numStartups');
    const report = check('jsonc', claudeCode, written, [
      'mcpServers',
      'filesystem',
    ]);
    expect(report.allPassed).toBe(false);
    expect(findCheck(report, 'topLevelKeys').pass).toBe(false);
  });

  it('toml: deleting the model scalar fires topLevelKeys', () => {
    const written = deleteTopLevelKey(codex, 'toml', 'model');
    const report = check('toml', codex, written, ['mcp_servers', 'filesystem']);
    expect(report.allPassed).toBe(false);
    expect(findCheck(report, 'topLevelKeys').pass).toBe(false);
  });

  it('toml: deleting the mcp_servers implicit table fires mcpServers (context7 deleted)', () => {
    // targetPath[0] = 'mcp_servers' is the allowed top-level key, so
    // topLevelKeys excludes it from the check. But deleting the whole
    // mcp_servers subtree also deletes context7, which is OUTSIDE
    // targetPath[1] = 'filesystem'. The mcpServers check fires.
    const written = deleteTopLevelKey(codex, 'toml', 'mcp_servers');
    const report = check('toml', codex, written, ['mcp_servers', 'filesystem']);
    expect(report.allPassed).toBe(false);
    expect(findCheck(report, 'mcpServers').pass).toBe(false);
  });
});

describe('S5 — unrelated MCP server deletion is detected', () => {
  it('jsonc: deleting context7 server fires mcpServers', () => {
    const written = deleteMcpServer(
      claudeCode,
      'jsonc',
      'mcpServers',
      'context7',
    );
    const report = check('jsonc', claudeCode, written, [
      'mcpServers',
      'filesystem',
    ]);
    expect(report.allPassed).toBe(false);
    expect(findCheck(report, 'mcpServers').pass).toBe(false);
  });

  it('toml: deleting context7 server fires mcpServers', () => {
    const written = deleteMcpServer(codex, 'toml', 'mcp_servers', 'context7');
    const report = check('toml', codex, written, ['mcp_servers', 'filesystem']);
    expect(report.allPassed).toBe(false);
    expect(findCheck(report, 'mcpServers').pass).toBe(false);
  });
});

describe('S6 — whitespace drift is detected', () => {
  it('jsonc: drifting indentation by +2 fires formatting', () => {
    const written = driftIndentation(claudeCode, 2);
    const report = check('jsonc', claudeCode, written, [
      'mcpServers',
      'filesystem',
    ]);
    expect(report.allPassed).toBe(false);
    expect(findCheck(report, 'formatting').pass).toBe(false);
  });

  it('jsonc: removing the trailing newline fires formatting', () => {
    const written = deleteTrailingNewline(claudeCode);
    const report = check('jsonc', claudeCode, written, [
      'mcpServers',
      'filesystem',
    ]);
    expect(report.allPassed).toBe(false);
    expect(findCheck(report, 'formatting').pass).toBe(false);
  });

  it('toml: drifting indentation by +2 fires formatting', () => {
    const written = driftIndentation(codex, 2);
    const report = check('toml', codex, written, ['mcp_servers', 'filesystem']);
    expect(report.allPassed).toBe(false);
    expect(findCheck(report, 'formatting').pass).toBe(false);
  });
});

describe('S7 — idempotency check fires when second apply drifts', () => {
  it('jsonc: rewritten !== written fires idempotency', () => {
    const written = claudeCode;
    const rewritten = appendString(claudeCode, '\n');
    const report = runPreservationChecks({
      format: 'jsonc',
      original: claudeCode,
      written,
      rewritten,
      targetPath: ['mcpServers', 'filesystem'],
    });
    expect(report.allPassed).toBe(false);
    expect(findCheck(report, 'idempotency').pass).toBe(false);
  });

  it('jsonc: rewritten === written passes idempotency', () => {
    const report = runPreservationChecks({
      format: 'jsonc',
      original: claudeCode,
      written: claudeCode,
      rewritten: claudeCode,
      targetPath: ['mcpServers', 'filesystem'],
    });
    expect(findCheck(report, 'idempotency').pass).toBe(true);
  });

  it('jsonc: rewritten omitted → idempotency is skipped', () => {
    const report = runPreservationChecks({
      format: 'jsonc',
      original: claudeCode,
      written: claudeCode,
      targetPath: ['mcpServers', 'filesystem'],
    });
    expect(findCheck(report, 'idempotency').skipped).toBe(true);
    expect(findCheck(report, 'idempotency').pass).toBe(true);
  });
});

describe('S8 — targeted mutations inside targetPath do NOT fire checks', () => {
  it('jsonc: identity write with single-server targetPath passes every check', () => {
    const report = check('jsonc', claudeCode, claudeCode, [
      'mcpServers',
      'filesystem',
    ]);
    expect(report.allPassed).toBe(true);
    // topLevelKeys: every key outside mcpServers is preserved
    expect(findCheck(report, 'topLevelKeys').pass).toBe(true);
    // keyOrder: keys outside mcpServers are unchanged
    expect(findCheck(report, 'keyOrder').pass).toBe(true);
    // mcpServers: every server except filesystem is preserved
    expect(findCheck(report, 'mcpServers').pass).toBe(true);
    // formatting: nothing outside targetPath drifted
    expect(findCheck(report, 'formatting').pass).toBe(true);
    // comments: every comment outside mcpServers.filesystem is preserved
    expect(findCheck(report, 'comments').pass).toBe(true);
  });

  it('jsonc: targetPath on the whole mcp subtree still requires the rest to be preserved', () => {
    const report = check('jsonc', claudeCode, claudeCode, ['mcpServers']);
    expect(report.allPassed).toBe(true);
  });

  it('jsonc: empty targetPath means whole document may change — every check is skipped', () => {
    const report = check('jsonc', claudeCode, claudeCode, []);
    expect(report.allPassed).toBe(true);
    for (const c of report.checks) {
      expect(c.skipped).toBe(true);
    }
  });
});

describe('S9 — non-target-path comment edits fail', () => {
  it('jsonc: editing a comment outside the target subtree fires comments', () => {
    // Replace a comment line in the top-level (outside mcpServers.filesystem).
    const written = claudeCode.replace(
      '// Top-level keys are general Claude Code state, not MCP config.',
      '// (edited)',
    );
    const report = check('jsonc', claudeCode, written, [
      'mcpServers',
      'filesystem',
    ]);
    expect(report.allPassed).toBe(false);
    expect(findCheck(report, 'comments').pass).toBe(false);
  });
});

describe('S10 — all four formats are covered end-to-end', () => {
  it('opencode (jsonc) identity write passes', () => {
    const report = check('jsonc', opencode, opencode, ['mcp', 'filesystem']);
    expect(report.allPassed).toBe(true);
  });

  it('claude-code (jsonc) identity write passes', () => {
    const report = check('jsonc', claudeCode, claudeCode, [
      'mcpServers',
      'filesystem',
    ]);
    expect(report.allPassed).toBe(true);
  });

  it('copilot-cli (jsonc) identity write passes', () => {
    const report = check('jsonc', copilotCli, copilotCli, [
      'mcpServers',
      'filesystem',
    ]);
    expect(report.allPassed).toBe(true);
  });

  it('codex (toml) identity write passes', () => {
    const report = check('toml', codex, codex, ['mcp_servers', 'filesystem']);
    expect(report.allPassed).toBe(true);
  });

  it('opencode (jsonc) comment-strip breaks comments check', () => {
    const written = stripComments(opencode, 'jsonc');
    const report = check('jsonc', opencode, written, ['mcp', 'filesystem']);
    expect(findCheck(report, 'comments').pass).toBe(false);
  });

  it('copilot-cli (jsonc) comment-strip breaks comments check', () => {
    const written = stripComments(copilotCli, 'jsonc');
    const report = check('jsonc', copilotCli, written, [
      'mcpServers',
      'filesystem',
    ]);
    expect(findCheck(report, 'comments').pass).toBe(false);
  });
});
