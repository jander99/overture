// Registry-level contract guards for the B2 MCP normalization slice.
//
// These tests prove the agentRegistry aggregate exposed from
// `packages/agents/src/index.ts` actually carries the `mcp.normalize`
// handler on every supported local CLI agent — i.e. the per-file
// normalizers wired in by Tasks 3, 4, and 5 reach the public surface
// and the registry stays consistent with the in-tree
// `AGENT_REGISTRY_ORDER`. They also pin the B2 scope: exactly the four
// CLI agents called out by the plan, and no `@overture/scan-matrix`
// import closes a package cycle (scan-matrix already imports
// `McpSupport` from agents; the reverse direction would create a
// circular dependency).
//
// The runtime assertions are intentionally narrow (id set + per-entry
// handler presence + parseServers/normalize identity separation +
// import statement scan). Per-agent normalization behavior lives in
// the colocated per-agent specs (`normalize-claude-copilot.spec.ts`,
// `normalize-opencode.spec.ts`, `normalize-openai-codex.spec.ts`) and
// the shared helpers are covered by `normalize-mcp-config.spec.ts`.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { agentRegistry } from './index.js';
import type { AgentDefinition, PlatformId } from './types.js';

// The four supported local CLI agents in scope for B2. Reordering or
// renaming an id is a breaking change for any consumer that depends
// on the registry's positional indices, so this constant pins both
// the cardinality and the id set.
const B2_SUPPORTED_AGENT_IDS: ReadonlySet<PlatformId> = new Set<PlatformId>([
  'claude-code',
  'opencode',
  'github-copilot-cli',
  'openai-codex',
]);

// Predicate narrowing the heterogeneous AgentDefinition union to the
// B2-supported agents (mcpSupport === 'supported'). Untyped
// `agentRegistry` returns a `readonly AgentDefinition[]`; this guard
// is what the rest of the suite iterates over.
function isSupported(
  entry: AgentDefinition,
): entry is AgentDefinition & { mcpSupport: 'supported' } {
  return entry.mcpSupport === 'supported';
}

// Resolve the agents package src directory. The test is co-located
// in `packages/agents/src/`, and the agents package compiles to
// CommonJS (see `packages/agents/tsconfig.json` → `module: commonjs`),
// so the standard CommonJS globals `__dirname` / `__filename` are
// available without the `import.meta.url` ESM bridge.
const AGENTS_SRC_DIR = __dirname;

/**
 * Recursively collect every `.ts` file under the given directory,
 * excluding this test file (which contains the literal string
 * `@overture/scan-matrix` as part of its assertions).
 */
function listTypeScriptSources(
  rootDir: string,
  exclude: ReadonlySet<string>,
): readonly string[] {
  const out: string[] = [];
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry.startsWith('.')) {
        continue;
      }
      const abs = join(dir, entry);
      const st = statSync(abs);
      if (st.isDirectory()) {
        visit(abs);
        continue;
      }
      if (entry.endsWith('.ts') && !exclude.has(abs)) {
        out.push(abs);
      }
    }
  };
  visit(rootDir);
  return out;
}

// Match an actual import statement referencing `@overture/scan-matrix`
// (with or without a `type` modifier). The test self-preserves by
// excluding this file from the scan, so comments and string literals
// in this file do not produce a false positive.
const SCAN_MATRIX_IMPORT_REGEX =
  /import\s+(?:type\s+)?[^'"]*from\s+['"]@overture\/scan-matrix['"]/;

describe('agentRegistry — B2 normalize contract', () => {
  it('contains exactly the four B2-supported CLI agents', () => {
    const ids = new Set(agentRegistry.map((entry) => entry.id));
    expect(ids).toEqual(B2_SUPPORTED_AGENT_IDS);
  });

  it('contains no agents outside the B2 scope (no extras, no future drift)', () => {
    expect(agentRegistry.length).toBe(B2_SUPPORTED_AGENT_IDS.size);
  });

  it('every supported agent exposes an mcp.normalize handler', () => {
    const supported = agentRegistry.filter(isSupported);
    expect(supported.length).toBe(B2_SUPPORTED_AGENT_IDS.size);
    for (const entry of supported) {
      expect(typeof entry.mcp.normalize).toBe('function');
    }
  });

  it('mcp.parseServers and mcp.normalize are separate functions for every supported agent', () => {
    // parseServers is the human-readable display path (renders the
    // server list under the `mcp:` line); normalize is the canonical
    // path the scan matrix compares against. They MUST be distinct
    // functions — if they collapse to one, the display layer and the
    // comparison layer share a contract and a future change to either
    // silently breaks the other.
    for (const entry of agentRegistry.filter(isSupported)) {
      const parse = entry.mcp.parseServers;
      const normalize = entry.mcp.normalize;
      expect(typeof parse).toBe('function');
      expect(typeof normalize).toBe('function');
      expect(parse).not.toBe(normalize);
    }
  });

  it('mcp.normalize is wired on exactly the four expected ids', () => {
    // Belt-and-braces: even if a future agent sneaks in with
    // mcpSupport === 'supported' and forgets a normalize handler, this
    // test names the offenders.
    const missing = agentRegistry
      .filter((entry) => B2_SUPPORTED_AGENT_IDS.has(entry.id))
      .filter((entry) => typeof entry.mcp.normalize !== 'function')
      .map((entry) => entry.id);
    expect(missing).toEqual([]);
  });
});

describe('packages/agents/src — package-cycle guard', () => {
  it('does not import from @overture/scan-matrix in any source file', () => {
    // scan-matrix already imports `McpSupport` from @overture/agents;
    // a reverse import would close a circular dependency.
    // Exclude this spec file: it intentionally contains the literal
    // string `@overture/scan-matrix` in its docstring and matcher.
    const sources = listTypeScriptSources(
      AGENTS_SRC_DIR,
      new Set([__filename]),
    );
    const offenders: readonly string[] = sources
      .map((path) => ({ path, text: readFileSync(path, 'utf8') }))
      .filter(({ text }) => SCAN_MATRIX_IMPORT_REGEX.test(text))
      .map(({ path }) => relative(AGENTS_SRC_DIR, path));
    expect(offenders).toEqual([]);
  });
});
