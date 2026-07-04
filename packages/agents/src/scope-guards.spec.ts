// F3 boundary guard — proves the new pure helper
// `detectCanonicalSettingsDrift` (and its surrounding module) respects
// the package-boundary rules locked in at scaffolding:
//
// 1. `packages/agents/src/parse-mcp-servers.ts` must NOT import
//    `@overture/scan-matrix`. scan-matrix already imports from
//    `@overture/agents` (it consumes `McpSupport` etc.), and the
//    reverse direction would close a circular dependency (memory 111).
//    The package-level "no scan-matrix import anywhere in agents"
//    guard lives in `normalize-contract.spec.ts`; this file is the
//    same assertion scoped to the F3 helper's home module, so a
//    future drift in `parse-mcp-servers.ts` shows up here even if
//    the broader guard is later refactored.
//
// 2. The new helper is a pure function. Its declaration must not
//    reference `node:fs`, `readFile`, or `async` — the helper is
//    expected to run inside the orchestrator's pre-write Pass 1 loop
//    without touching the filesystem, and any future regression
//    that introduces I/O would silently break the dry-run contract.
//
//    The pre-existing helpers in `parse-mcp-servers.ts` (the JSONC,
//    TOML, and YAML readers) DO use `node:fs`. The guard scopes the
//    purity check to the new helper's source slice, not the whole
//    file, so the existing read helpers are not flagged.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Co-located in `packages/agents/src/`, compiled as CommonJS
// (see `packages/agents/tsconfig.json`), so `__dirname` is available.
const PARSE_MCP_SERVERS_PATH = join(__dirname, 'parse-mcp-servers.ts');

const SCAN_MATRIX_IMPORT_REGEX =
  /import\s+(?:type\s+)?[^'"]*from\s+['"]@overture\/scan-matrix['"]/;

/**
 * Extract the source slice of `detectCanonicalSettingsDrift`'s
 * declaration: from `export function detectCanonicalSettingsDrift(`
 * up to the next top-level `export function` / `export const` /
 * `export type` / `export interface` declaration, or end-of-file.
 * The helper is the last `export function` in the file, so the
 * end-of-file bound is the practical case.
 */
function extractHelperSource(text: string): string {
  const start = text.indexOf('export function detectCanonicalSettingsDrift');
  if (start === -1) {
    throw new Error(
      'parse-mcp-servers.ts: detectCanonicalSettingsDrift helper not found',
    );
  }
  // Look for the next top-level declaration AFTER the helper starts.
  // Top-level declarations in this file all start at column 0 with
  // `export `, so a simple regex from `start + 1` is sufficient.
  const rest = text.slice(start + 1);
  const nextDecl = rest.match(
    /\nexport\s+(?:function|const|type|interface|class)\s/,
  );
  if (nextDecl && typeof nextDecl.index === 'number') {
    return text.slice(start, start + 1 + nextDecl.index);
  }
  return text.slice(start);
}

describe('parse-mcp-servers.ts — F3 boundary guard', () => {
  it('does not import @overture/scan-matrix', () => {
    const source = readFileSync(PARSE_MCP_SERVERS_PATH, 'utf8');
    expect(SCAN_MATRIX_IMPORT_REGEX.test(source)).toBe(false);
  });

  it('detectCanonicalSettingsDrift declaration does not reference node:fs', () => {
    const source = readFileSync(PARSE_MCP_SERVERS_PATH, 'utf8');
    const helperSlice = extractHelperSource(source);
    expect(helperSlice).not.toMatch(/node:fs/);
  });

  it('detectCanonicalSettingsDrift declaration does not reference readFile', () => {
    const source = readFileSync(PARSE_MCP_SERVERS_PATH, 'utf8');
    const helperSlice = extractHelperSource(source);
    expect(helperSlice).not.toMatch(/readFile/);
  });

  it('detectCanonicalSettingsDrift declaration is not async', () => {
    const source = readFileSync(PARSE_MCP_SERVERS_PATH, 'utf8');
    const helperSlice = extractHelperSource(source);
    // The declaration line itself must not declare `async function`.
    expect(helperSlice.startsWith('export function ')).toBe(true);
    expect(helperSlice).not.toMatch(/export\s+async\s+function/);
    // No `async (` arrow inside the helper body either — that
    // would also break the synchronous detector contract.
    expect(helperSlice).not.toMatch(/\basync\s/);
  });
});
