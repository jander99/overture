/**
 * B1 anti-scope guard tests.
 *
 * These tests read only the implementation source
 * (`packages/scan-matrix/src/index.ts`) and assert that the B1 model
 * stays pure: no file I/O, no MCP config readers/parsers, no output
 * formatters, no `JSON.stringify`-based behavior, and no per-agent
 * branches beyond the four-CLI allow-list in `DEFAULT_REGISTRY_ORDER`.
 *
 * The "removed agent" deny-list check lives in the Task 6 shell QA
 * scenario (`.omo/evidence/task-6-no-removed-agents.log`) and is
 * intentionally not embedded here — committing a deny-list of removed
 * platform ids to the package would re-introduce the very scope the
 * guards are trying to prevent.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Vitest runs the spec through Vite, so `__dirname` is the directory
// of the compiled test module. The package is CommonJS (`module:
// "nodenext"` + no `"type": "module"` in package.json), so
// `import.meta.url` would fail the strict TS build. Resolve the
// implementation path relative to `__dirname` instead.
const IMPL_PATH = resolve(__dirname, 'index.ts');
const IMPL_SOURCE = readFileSync(IMPL_PATH, 'utf8');

describe('B1 anti-scope guards', () => {
  it('implementation source does not import node:fs, fs, readFile, or any reader/parser', () => {
    // Each token is a positive signal that an I/O or reader dependency
    // leaked into B1. The list mirrors the forbidden surface from the
    // Task 6 plan block.
    const forbidden = [
      'node:fs',
      'node:fs/promises',
      "from 'fs'",
      'from "fs"',
      'readFile',
      'readAgentMcpConfig',
      'parseMcpConfig',
      'parseJsoncMcpServerMap',
      'parseTomlMcpServerMap',
    ];
    for (const token of forbidden) {
      expect(IMPL_SOURCE, `forbidden token: ${token}`).not.toContain(token);
    }
  });

  it('implementation source does not use JSON.stringify for behavior or equality', () => {
    // Match the function-call form (`JSON.stringify(`) so the JSDoc
    // mention of the forbidden pattern on `serverSettingsEqual` does
    // not trip the guard.
    expect(IMPL_SOURCE).not.toMatch(/JSON\.stringify\s*\(/);
  });

  it('implementation source does not write to stdout/stderr or invoke a renderer', () => {
    const forbidden = [
      'process.stdout',
      'process.stderr',
      'console.log',
      'formatHumanOutput',
      'formatJsonOutput',
    ];
    for (const token of forbidden) {
      expect(IMPL_SOURCE, `forbidden token: ${token}`).not.toContain(token);
    }
  });

  it('implementation source is not async and does not return a Promise', () => {
    expect(IMPL_SOURCE).not.toMatch(/\basync\b/);
    expect(IMPL_SOURCE).not.toMatch(/\bPromise\b/);
  });

  it('the four supported agent ids appear only inside the DEFAULT_REGISTRY_ORDER block', () => {
    // The plan allows the four supported ids inside the
    // DEFAULT_REGISTRY_ORDER constant and inside tests. Anywhere else
    // in the implementation source would be a per-agent branch — a
    // hard scope violation against the four-CLI mandate.
    const supportedIds = [
      'claude-code',
      'opencode',
      'github-copilot-cli',
      'openai-codex',
    ];
    const lines = IMPL_SOURCE.split('\n');

    const constLine = lines.findIndex((line) =>
      line.includes('export const DEFAULT_REGISTRY_ORDER'),
    );
    expect(
      constLine,
      'DEFAULT_REGISTRY_ORDER must exist',
    ).toBeGreaterThanOrEqual(0);

    // Walk upward to the start of the JSDoc that documents the constant.
    // The JSDoc is part of the "constant block" for the purposes of this
    // guard: it is documentation, not code, and it must be free to name
    // the agents so future readers know what the list means.
    let jsDocStart = constLine;
    while (jsDocStart > 0) {
      const prev = lines[jsDocStart - 1];
      if (prev !== undefined && prev.trim().startsWith('/**')) {
        break;
      }
      jsDocStart--;
    }
    expect(
      jsDocStart,
      'DEFAULT_REGISTRY_ORDER must have a JSDoc block above it',
    ).toBeLessThan(constLine);

    // Walk downward to the closing `];` of the array literal.
    let arrayEnd = constLine;
    while (arrayEnd < lines.length && !lines[arrayEnd]?.includes('];')) {
      arrayEnd++;
    }
    expect(
      arrayEnd,
      'DEFAULT_REGISTRY_ORDER array must close with `];`',
    ).toBeLessThan(lines.length);

    const outsideBlock = lines
      .filter((_, i) => i < jsDocStart || i > arrayEnd)
      .join('\n');

    for (const id of supportedIds) {
      expect(
        outsideBlock,
        `agent id "${id}" must only appear inside DEFAULT_REGISTRY_ORDER`,
      ).not.toContain(id);
    }
  });

  it('DEFAULT_REGISTRY_ORDER lists exactly the four canonical agent ids in the documented order', () => {
    // This is a positive allow-list: the four ids and their order are
    // load-bearing for downstream consumers. The constant is the single
    // source of truth; the test pins both the contents and the order so
    // a future edit that reorders or drops an id has to be intentional.
    const match = IMPL_SOURCE.match(
      /export const DEFAULT_REGISTRY_ORDER[^=]*=\s*\[([\s\S]*?)\]/,
    );
    expect(
      match,
      'DEFAULT_REGISTRY_ORDER must exist as an array literal',
    ).toBeTruthy();
    const entries = (match?.[1] ?? '')
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter((s) => s.length > 0);
    expect(entries).toEqual([
      'claude-code',
      'opencode',
      'github-copilot-cli',
      'openai-codex',
    ]);
  });
});
