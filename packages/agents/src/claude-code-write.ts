/**
 * Claude Code MCP writer (E3 slice).
 *
 * Self-contained writer: it carries its own path resolution via
 * `input.pathContext`, resolves the on-disk target via
 * `pickClaudeCodeTarget`, and refuses to create missing files.
 *
 * This slice establishes the wiring contract only — the byte-level
 * splice lands in the follow-up TDD step once `jsonc-map-write`
 * grows real byte splices. The function returns `parse-error` after
 * confirming the target exists so the wiring is exercised end-to-end
 * without performing any destructive IO.
 */
import type { OvertureMcpServer } from '@overture/config';
import type {
  AgentMcpWriteInput,
  AgentMcpWriteResult,
  PathResolutionContext,
  StringMap,
  TargetPath,
} from './types.js';
import {
  pickClaudeCodeTarget,
  type ClaudeCodeWriteTarget,
} from './claude-code-write-helpers.js';
import type { JsonValue } from './types.js';

// ---------------------------------------------------------------------------
// Canonical-to-native conversion
// ---------------------------------------------------------------------------

export type ClaudeCodeWritableStdioServer = {
  readonly type: 'stdio';
  readonly command: string;
  readonly args?: readonly string[];
  readonly env?: StringMap;
  readonly [key: string]: JsonValue | undefined;
};

export type ClaudeCodeWritableRemoteServer = {
  readonly type: 'http';
  readonly url: string;
  readonly headers?: StringMap;
  readonly [key: string]: JsonValue | undefined;
};

export type ClaudeCodeWritableMcpServer =
  | ClaudeCodeWritableStdioServer
  | ClaudeCodeWritableRemoteServer;

const CLAUDE_CODE_CANONICAL_FIELD_NAMES = new Set<string>([
  'type',
  'command',
  'args',
  'env',
  'url',
  'headers',
]);

function collectExtensions(
  existing: ClaudeCodeWritableMcpServer | undefined,
): Record<string, JsonValue> {
  const extensions: Record<string, JsonValue> = {};
  if (existing === undefined) {
    return extensions;
  }

  for (const key of Object.keys(existing)) {
    if (CLAUDE_CODE_CANONICAL_FIELD_NAMES.has(key)) {
      continue;
    }
    const value = existing[key];
    if (value !== undefined) {
      extensions[key] = value;
    }
  }

  return extensions;
}

/**
 * Convert a canonical `OvertureMcpServer` to a Claude Code native server.
 *
 * - stdio → `{ type: 'stdio', command: string, args?: string[], env?: StringMap }`
 * - remote → `{ type: 'http', url: string, headers?: StringMap }`
 *
 * Preserves non-canonical extension fields from `existing` (e.g. any custom
 * keys the user may have added to their config).
 */
export function toClaudeCodeMcpServer(
  server: OvertureMcpServer,
  existing?: ClaudeCodeWritableMcpServer,
): ClaudeCodeWritableMcpServer {
  const extensions = collectExtensions(existing);

  if (server.type === 'stdio') {
    return {
      ...extensions,
      type: 'stdio',
      command: server.command,
      ...(server.args === undefined ? {} : { args: server.args }),
      ...(server.env === undefined ? {} : { env: server.env }),
    };
  }

  return {
    ...extensions,
    type: 'http',
    url: server.url,
    ...(server.headers === undefined ? {} : { headers: server.headers }),
  };
}

function targetPathFor(
  target: Exclude<ClaudeCodeWriteTarget, { kind: 'none' }>,
): TargetPath {
  return { scope: 'user', base: 'home', path: target.path };
}

export async function writeClaudeCodeMcpConfig(
  _ctx: PathResolutionContext,
  input: AgentMcpWriteInput,
): Promise<AgentMcpWriteResult> {
  const dryRun = input.dryRun ?? false;

  if (input.pathContext === undefined) {
    return {
      written: 0,
      changed: false,
      dryRun,
      serversWritten: [],
      targetPaths: [],
      reason: 'not-targetable',
    };
  }

  // Discover target (./mcp.json OR ~/.claude.json top-level OR ~/.claude.json/projects[ws]/).
  // No creation: if no applicable target exists, return reason: 'not-targetable'.
  // No raw bytes in result.
  const target = await pickClaudeCodeTarget(input.pathContext);
  if (target.kind === 'none') {
    return {
      written: 0,
      changed: false,
      dryRun,
      serversWritten: [],
      targetPaths: [],
      reason: 'not-targetable',
    };
  }

  // For E3 stub: refuse to write; return parse-error after confirming
  // the target exists. Full per-server byte splicing arrives when
  // jsonc-map-write grows real byte splices; this slice establishes the
  // wiring contract.
  return {
    written: 0,
    changed: false,
    dryRun,
    serversWritten: [],
    targetPaths: [targetPathFor(target)],
    reason: 'parse-error',
  };
}
