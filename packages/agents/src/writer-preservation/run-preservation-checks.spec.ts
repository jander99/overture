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
import {
  CLAUDE_CODE_FIXTURE,
  CODEX_FIXTURE,
  COPILOT_CLI_FIXTURE,
  OPENCODE_FIXTURE,
} from './fixtures.js';
import { runPreservationChecks } from './run.js';

const opencode = OPENCODE_FIXTURE;
const claudeCode = CLAUDE_CODE_FIXTURE;
const copilotCli = COPILOT_CLI_FIXTURE;
const codex = CODEX_FIXTURE;

/** Convenience: run the harness with just original/written. */
function check(
  format: 'json' | 'jsonc' | 'toml' | 'yaml',
  original: string,
  written: string,
  targetPath: readonly string[],
): ReturnType<typeof runPreservationChecks> {
  return runPreservationChecks({
    format,
    original,
    written,
    rewritten: written,
    targetPath,
  });
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

  it('jsonc: rewritten=written → idempotency trivially holds', () => {
    // `rewritten` is now a required input. Callers that don't exercise
    // a second apply pass `written` again — the check then holds
    // trivially and the report is honest about it.
    const report = runPreservationChecks({
      format: 'jsonc',
      original: claudeCode,
      written: claudeCode,
      rewritten: claudeCode,
      targetPath: ['mcpServers', 'filesystem'],
    });
    const idem = findCheck(report, 'idempotency');
    expect(idem.skipped).toBe(false);
    expect(idem.pass).toBe(true);
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

  it('jsonc: empty targetPath means whole document may change — all structural checks are skipped; idempotency still runs (rewritten is required)', () => {
    const report = check('jsonc', claudeCode, claudeCode, []);
    expect(report.allPassed).toBe(true);
    for (const c of report.checks) {
      if (c.name === 'idempotency') continue;
      expect(c.skipped).toBe(true);
    }
    const idem = report.checks.find((c) => c.name === 'idempotency');
    expect(idem!.skipped).toBe(false);
    expect(idem!.pass).toBe(true);
  });

  it('jsonc: empty targetPath + rewritten !== written fires idempotency (regression)', () => {
    // Regression test for the Oracle round-2 finding: the empty-target
    // short-circuit must NOT hardcode idempotency pass. If the writer
    // produced different bytes on a second apply, the harness must
    // catch it even when the writer was allowed to mutate the whole doc.
    const report = runPreservationChecks({
      format: 'jsonc',
      original: claudeCode,
      written: claudeCode,
      rewritten: claudeCode + '\n',
      targetPath: [],
    });
    expect(report.allPassed).toBe(false);
    const idem = report.checks.find((c) => c.name === 'idempotency');
    expect(idem!.skipped).toBe(false);
    expect(idem!.pass).toBe(false);
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

describe('S11 — rawBytes check is the primary E1 contract', () => {
  it('rawBytes: identity write preserves every outside byte (jsonc)', () => {
    const report = check('jsonc', claudeCode, claudeCode, [
      'mcpServers',
      'filesystem',
    ]);
    expect(findCheck(report, 'rawBytes').pass).toBe(true);
  });

  it('rawBytes: edited comment text fires (not just removed comments)', () => {
    // The structured `comments` check uses a set comparison: as long as the
    // same comments exist somewhere, it passes. rawBytes is stricter: any
    // byte change outside targetPath fires. This test edits the text of a
    // non-target comment (keeps the same set) and proves rawBytes catches it.
    const written = claudeCode.replace(
      '// Top-level keys are general Claude Code state, not MCP config.',
      '// (edited for the test)',
    );
    const report = check('jsonc', claudeCode, written, [
      'mcpServers',
      'filesystem',
    ]);
    expect(findCheck(report, 'rawBytes').pass).toBe(false);
  });

  it('rawBytes: unrelated top-level key value change fires', () => {
    // numStartups is outside targetPath[0]=mcpServers. A writer that
    // changes its value (without deleting or reordering) must fire rawBytes
    // even though the structured `topLevelKeys` check only verifies the key
    // exists with equal content (which it would, since the value is still a
    // number).
    const written = claudeCode.replace(
      '"numStartups": 42',
      '"numStartups": 43',
    );
    const report = check('jsonc', claudeCode, written, [
      'mcpServers',
      'filesystem',
    ]);
    expect(findCheck(report, 'rawBytes').pass).toBe(false);
  });

  it('rawBytes: legitimate inside-target mutation passes', () => {
    // Swap two MCP servers inside the target subtree. targetPath is the
    // whole mcpServers subtree (so the swap is fully inside the target).
    // rawBytes compares only the bytes OUTSIDE the target, so an
    // inside-target swap must pass.
    const written = swapMcpServers(
      claudeCode,
      'jsonc',
      'mcpServers',
      'filesystem',
      'context7',
    );
    const report = check('jsonc', claudeCode, written, ['mcpServers']);
    expect(findCheck(report, 'rawBytes').pass).toBe(true);
  });

  it('rawBytes: length-changing legitimate target mutation passes', () => {
    // Add a new key to the target server. The target's byte length
    // changes (longer written subtree). The fix in rawBytesCheck is to
    // compute the target range independently in both original and
    // written; using the original range for the written side would
    // slice into the wrong content and falsely fire.
    const written = claudeCode.replace(
      '"LOG_LEVEL": "info"',
      '"LOG_LEVEL": "info",\n        "TIMEOUT": 30',
    );
    const report = check('jsonc', claudeCode, written, [
      'mcpServers',
      'filesystem',
    ]);
    expect(findCheck(report, 'rawBytes').pass).toBe(true);
  });

  it('rawBytes: inter-value spacing change outside target fires (the false-negative structural checks miss)', () => {
    // This is the false-negative test. The structured checks all pass:
    //   - comments: comment set is unchanged
    //   - topLevelKeys: deep equality holds (42 === 42, "enabled" === "enabled")
    //   - keyOrder: key order is unchanged
    //   - mcpServers: only the filesystem server is touched, the others
    //     have equal content
    //   - formatting: line-leading whitespace and trailing newline are
    //     unchanged
    // But the spacing between ":" and the value changed from " " to "  "
    // (double space), which is an out-of-scope byte change. rawBytes
    // catches it; the structured checks do not.
    const written = claudeCode.replace(
      '"numStartups": 42',
      '"numStartups":  42',
    );
    const report = check('jsonc', claudeCode, written, [
      'mcpServers',
      'filesystem',
    ]);
    // rawBytes must fire.
    expect(findCheck(report, 'rawBytes').pass).toBe(false);
    // None of the structural checks fire — this is the false-negative
    // scenario rawBytes exists to close.
    expect(findCheck(report, 'comments').pass).toBe(true);
    expect(findCheck(report, 'topLevelKeys').pass).toBe(true);
    expect(findCheck(report, 'keyOrder').pass).toBe(true);
    expect(findCheck(report, 'mcpServers').pass).toBe(true);
    expect(findCheck(report, 'formatting').pass).toBe(true);
  });

  it('rawBytes (toml): identity write preserves every outside byte', () => {
    const report = check('toml', codex, codex, ['mcp_servers', 'filesystem']);
    expect(findCheck(report, 'rawBytes').pass).toBe(true);
  });

  it('rawBytes: AST path resolution finds the right top-level mcpServers (regression for nested-collision bug)', () => {
    // A config that has an unrelated top-level key BEFORE the real
    // mcpServers. The unrelated key's value contains a nested
    // mcpServers.filesystem. A regex first-match would find the
    // nested one; the AST walk must find the real top-level one.
    const configWithCollision = `{
  "unrelatedConfig": {
    "mcpServers": {
      "filesystem": {
        "command": "fake",
        "args": ["--nested"]
      }
    }
  },
  "mcpServers": {
    "filesystem": {
      "command": "real",
      "args": ["--real"]
    }
  }
}
`;
    // 1) Edit only the NESTED filesystem (change a command arg). The
    //    real target is the top-level mcpServers.filesystem, so the
    //    change is OUTSIDE the target. rawBytes must fire.
    const writtenNestedEdit = configWithCollision.replace(
      '"--nested"',
      '"--nested-edited"',
    );
    const reportNested = check(
      'jsonc',
      configWithCollision,
      writtenNestedEdit,
      ['mcpServers', 'filesystem'],
    );
    expect(findCheck(reportNested, 'rawBytes').pass).toBe(false);

    // 2) Edit only the REAL filesystem (change a command arg). The
    //    change is INSIDE the target. rawBytes must pass.
    const writtenRealEdit = configWithCollision.replace(
      '"--real"',
      '"--real-edited"',
    );
    const reportReal = check('jsonc', configWithCollision, writtenRealEdit, [
      'mcpServers',
      'filesystem',
    ]);
    expect(findCheck(reportReal, 'rawBytes').pass).toBe(true);
  });

  it('rawBytes (toml): edited scalar outside target fires', () => {
    // model is outside targetPath[0]=mcp_servers. A writer that changes
    // its value must fire rawBytes.
    const written = codex.replace('model = "gpt-5"', 'model = "gpt-6"');
    const report = check('toml', codex, written, ['mcp_servers', 'filesystem']);
    expect(findCheck(report, 'rawBytes').pass).toBe(false);
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
