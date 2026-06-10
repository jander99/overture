/**
 * Consolidated per-agent `parse<Name>McpServers` test suite.
 *
 * Replaces 11 per-agent `parse-servers.*.spec.ts` files (one per
 * supported agent) with a single real-filesystem test driven by the
 * typed fixture table in `./parse-servers.cases.ts`.
 *
 * Adding a new per-agent parser: add a new entry to the table in
 * `parse-servers.cases.ts`. No new spec file needed.
 *
 * Opencode still has its own spec file (`parse-servers.opencode.spec.ts`)
 * because it uses the shared `parseOpenCodeMcpServerMap` helper
 * directly (no `parse<Name>McpServers` wrapper).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseServersCases } from './parse-servers.cases.js';

let workdir: string;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'parse-servers-'));
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

function writeFile(name: string, contents: string): string {
  // For missing-file test cases, the fileName is an absolute path
  // outside workdir — write to that absolute path instead. If the
  // fileName starts with '/' and isn't under workdir, skip writing
  // and let the parser return [].
  const isExternalPath = name.startsWith('/') && !name.startsWith(workdir);
  const path = isExternalPath ? name : join(workdir, name);
  if (!isExternalPath) writeFileSync(path, contents);
  return path;
}

describe('parse<AgentName>McpServers (consolidated)', () => {
  it.each(parseServersCases)(
    '$agentId: $description',
    ({ parser, fileName, contents, expected }) => {
      const path = writeFile(fileName, contents);
      expect(parser(path)).toEqual(expected);
    },
  );
});
