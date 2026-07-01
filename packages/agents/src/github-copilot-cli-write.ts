/**
 * GitHub Copilot CLI MCP writer (E3 slice).
 *
 * Self-contained writer: it carries its own path resolution via
 * `input.pathContext`, resolves the on-disk target via
 * `pickCopilotWriteTarget`, and refuses to create missing files.
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
  ToolList,
} from './types.js';
import {
  pickCopilotWriteTarget,
  targetPathFor,
} from './github-copilot-cli-write-helpers.js';
import type { JsonValue } from './types.js';

// ---------------------------------------------------------------------------
// Canonical-to-native conversion
// ---------------------------------------------------------------------------

export type GitHubCopilotCliWritableLocalServer = {
  readonly type: 'local';
  readonly command: string;
  readonly args?: readonly string[];
  readonly env?: StringMap;
  readonly tools?: ToolList;
  readonly cwd?: string;
  readonly [key: string]: JsonValue | undefined;
};

export type GitHubCopilotCliWritableRemoteServer = {
  readonly type: 'http';
  readonly url: string;
  readonly headers?: StringMap;
  readonly tools?: ToolList;
  readonly [key: string]: JsonValue | undefined;
};

export type GitHubCopilotCliWritableMcpServer =
  | GitHubCopilotCliWritableLocalServer
  | GitHubCopilotCliWritableRemoteServer;

const COPILOT_CANONICAL_FIELD_NAMES = new Set<string>([
  'type',
  'command',
  'args',
  'env',
  'url',
  'headers',
]);

function collectExtensions(
  existing: GitHubCopilotCliWritableMcpServer | undefined,
): Record<string, JsonValue> {
  const extensions: Record<string, JsonValue> = {};
  if (existing === undefined) {
    return extensions;
  }

  for (const key of Object.keys(existing)) {
    if (COPILOT_CANONICAL_FIELD_NAMES.has(key)) {
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
 * Convert a canonical `OvertureMcpServer` to a GitHub Copilot CLI native server.
 *
 * - stdio → `{ type: 'local', command: string, args?: string[], env?: StringMap }`
 * - remote → `{ type: 'http', url: string, headers?: StringMap }`
 *
 * Preserves `tools` and `cwd` extension fields from `existing`, as well as
 * any other non-canonical keys the user may have added.
 */
export function toGitHubCopilotCliMcpServer(
  server: OvertureMcpServer,
  existing?: GitHubCopilotCliWritableMcpServer,
): GitHubCopilotCliWritableMcpServer {
  const extensions = collectExtensions(existing);

  if (server.type === 'stdio') {
    return {
      ...extensions,
      type: 'local',
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

export async function writeGitHubCopilotCliMcpConfig(
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

  const target = await pickCopilotWriteTarget(input.pathContext);
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

  // Stub: confirm target exists, return parse-error placeholder while
  // jsonc-map-write grows real byte splices (same pattern as claude-code).
  return {
    written: 0,
    changed: false,
    dryRun,
    serversWritten: [],
    targetPaths: [targetPathFor(target)],
    reason: 'parse-error',
  };
}
