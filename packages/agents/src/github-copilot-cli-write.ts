/**
 * GitHub Copilot CLI MCP writer (E3 slice).
 *
 * Self-contained writer: it carries its own path resolution via
 * `ctx` (the first argument), resolves the on-disk target via
 * `pickCopilotWriteTarget`, and refuses to create missing files.
 *
 * Byte-level splice via `editJsoncMap` (value-node-only replacement) which
 * preserves comments, whitespace, BOM, trailing newlines, and unrelated keys.
 */
import {
  parse as parseJsonc,
  type ParseError,
} from 'jsonc-parser/lib/esm/main.js';
import type { OvertureMcpServer } from '@overture/config';
import {
  normalizeGitHubCopilotCliMcpServers,
  type GitHubCopilotCliMcpConfig,
} from './github-copilot-cli.js';
import { editJsoncMap } from './jsonc-map-write.js';
import { normalized } from './normalize-mcp-config.js';
import { detectCanonicalSettingsDrift } from './parse-mcp-servers.js';
import { atomicWrite } from './writers/lib/atomic-write.js';
import { readIfExists } from './writers/lib/read-if-exists.js';
import { collectExtensions } from './writers/lib/collect-extensions.js';
import type {
  AgentMcpReadResult,
  AgentMcpWriteInput,
  AgentMcpWriteResult,
  AgentNormalizedMcpServer,
  McpLocationFormat,
  PathResolutionContext,
  WriteReason,
} from './types.js';
import {
  pickCopilotWriteTarget,
  targetPathFor,
} from './github-copilot-cli-write-helpers.js';

// ---------------------------------------------------------------------------
// Types and converter
// ---------------------------------------------------------------------------

export type GitHubCopilotCliWritableMcpServer = {
  type: 'local' | 'http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  [key: string]: unknown;
};

const GITHUB_COPILOT_CLI_CANONICAL_FIELD_NAMES = new Set<string>([
  'type',
  'command',
  'args',
  'env',
  'url',
  'headers',
]);

export function toGitHubCopilotCliMcpServer(
  server: OvertureMcpServer,
  existing?: GitHubCopilotCliWritableMcpServer,
): GitHubCopilotCliWritableMcpServer {
  const extensions = collectExtensions(
    existing,
    GITHUB_COPILOT_CLI_CANONICAL_FIELD_NAMES,
  );

  // Canonical fields first, extensions last — preserves the existing entry's
  // JSON key order so JSON.stringify(a) === JSON.stringify(b) is true when the
  // canonical is byte-equivalent to the existing native entry.
  if (server.type === 'stdio') {
    return {
      type: 'local',
      command: server.command,
      ...(server.args === undefined ? {} : { args: server.args }),
      ...(server.env === undefined ? {} : { env: server.env }),
      ...extensions,
    };
  }

  return {
    type: 'http',
    url: server.url,
    ...(server.headers === undefined ? {} : { headers: server.headers }),
    ...extensions,
  };
}

// ---------------------------------------------------------------------------
// Atomic write
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Deep equal for no-change detection
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Deep equal for no-change detection
// ---------------------------------------------------------------------------

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

export async function writeGitHubCopilotCliMcpConfig(
  ctx: PathResolutionContext,
  input: AgentMcpWriteInput,
): Promise<AgentMcpWriteResult> {
  const dryRun = input.dryRun ?? false;

  // pathContext is always provided by the orchestrator — no early-return needed.

  const target = await pickCopilotWriteTarget(ctx);
  if (target.kind === 'none') {
    return {
      written: 0,
      changed: false,
      dryRun,
      serversWritten: [],
      targetPaths: [],
      reason: 'not-targetable' as WriteReason,
    };
  }

  const targetPath = target.path;
  const original = await readIfExists(targetPath);
  if (original === null) {
    return {
      written: 0,
      changed: false,
      dryRun,
      serversWritten: [],
      targetPaths: [targetPathFor(target)],
      reason: 'not-targetable' as WriteReason,
    };
  }

  // Parse and validate structure
  const parseErrors: ParseError[] = [];
  const parsed = parseJsonc(original, parseErrors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  if (parseErrors.length > 0) {
    return {
      written: 0,
      changed: false,
      dryRun,
      serversWritten: [],
      targetPaths: [targetPathFor(target)],
      resolvedPath: targetPath,
      format: 'jsonc' as McpLocationFormat,
      reason: 'parse-error' as WriteReason,
    };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      written: 0,
      changed: false,
      dryRun,
      serversWritten: [],
      targetPaths: [targetPathFor(target)],
      resolvedPath: targetPath,
      format: 'jsonc' as McpLocationFormat,
      reason: 'unsupported-shape' as WriteReason,
    };
  }

  const doc = parsed as Record<string, unknown>;
  const mcpServers = doc['mcpServers'];
  if (
    typeof mcpServers !== 'object' ||
    mcpServers === null ||
    Array.isArray(mcpServers)
  ) {
    return {
      written: 0,
      changed: false,
      dryRun,
      serversWritten: [],
      targetPaths: [targetPathFor(target)],
      resolvedPath: targetPath,
      format: 'jsonc' as McpLocationFormat,
      reason: 'unsupported-shape' as WriteReason,
    };
  }

  const mcpServersObj = mcpServers as Record<string, unknown>;

  // F3 conflict detection: build the existing normalized map from
  // the read mcpServers container, compare against the canonical
  // input, and refuse when any same-name pair differs in normalized
  // shape. Detector invocation order is fixed per the F3 design
  // contract: read → normalize → compare → refuse-or-proceed. Runs
  // AFTER shape validation and BEFORE any per-server patch building
  // so the writer never reads-then-rewrites a divergent entry.
  const existingRead: AgentMcpReadResult<GitHubCopilotCliMcpConfig> = {
    config: {
      mcpServers: mcpServersObj as GitHubCopilotCliMcpConfig['mcpServers'],
    },
    nonEmpty: Object.keys(mcpServersObj).length > 0,
  };
  const existingNormalizedRecord =
    normalizeGitHubCopilotCliMcpServers(existingRead);
  const existingMap = new Map<string, AgentNormalizedMcpServer>(
    Object.entries(existingNormalizedRecord),
  );
  const canonicalMap = new Map<string, AgentNormalizedMcpServer>(
    input.servers.map((s) => [s.name, normalized(s.server)]),
  );
  const conflicts = detectCanonicalSettingsDrift(existingMap, canonicalMap);
  if (conflicts.length > 0) {
    return {
      written: 0,
      changed: false,
      dryRun,
      serversWritten: [],
      targetPaths: [targetPathFor(target)],
      resolvedPath: targetPath,
      format: 'jsonc' as McpLocationFormat,
      conflicts,
    };
  }

  // Check all requested servers exist in the container (update-only: no creation)
  for (const entry of input.servers) {
    if (!Object.prototype.hasOwnProperty.call(mcpServersObj, entry.name)) {
      return {
        written: 0,
        changed: false,
        dryRun,
        serversWritten: [],
        targetPaths: [targetPathFor(target)],
        resolvedPath: targetPath,
        format: 'jsonc' as McpLocationFormat,
        reason: 'not-targetable' as WriteReason,
      };
    }
  }

  // Build native patches, reading existing entries for extension preservation
  const patches: Record<string, GitHubCopilotCliWritableMcpServer> = {};
  const touched: string[] = [];

  for (const entry of input.servers) {
    const existingNative = mcpServersObj[entry.name] as
      | GitHubCopilotCliWritableMcpServer
      | undefined;
    const nextServer = toGitHubCopilotCliMcpServer(
      entry.server,
      existingNative,
    );

    // No-change check: compare serialized forms
    if (existingNative !== undefined && deepEqual(existingNative, nextServer)) {
      continue;
    }

    patches[entry.name] = nextServer;
    touched.push(entry.name);
  }

  if (Object.keys(patches).length === 0) {
    return {
      written: 0,
      changed: false,
      dryRun,
      serversWritten: [],
      targetPaths: [targetPathFor(target)],
      resolvedPath: targetPath,
      format: 'jsonc' as McpLocationFormat,
      bytesChanged: 0,
      reason: 'no-change' as WriteReason,
    };
  }

  // Apply patches via editJsoncMap (value-node-only replacement)
  const editResult = editJsoncMap({
    original: new TextEncoder().encode(original),
    targetPath: ['mcpServers'],
    patch: patches,
  });

  if (editResult.kind === 'error') {
    const reason: WriteReason =
      editResult.reason === 'parse-error'
        ? 'parse-error'
        : editResult.reason === 'unsupported-shape'
          ? 'unsupported-shape'
          : editResult.reason === 'unsupported-path'
            ? 'not-targetable'
            : 'unsupported-shape';
    return {
      written: 0,
      changed: false,
      dryRun,
      serversWritten: [],
      targetPaths: [targetPathFor(target)],
      resolvedPath: targetPath,
      format: 'jsonc' as McpLocationFormat,
      reason,
    };
  }

  if (!editResult.changed) {
    return {
      written: 0,
      changed: false,
      dryRun,
      serversWritten: [],
      targetPaths: [targetPathFor(target)],
      resolvedPath: targetPath,
      format: 'jsonc' as McpLocationFormat,
      bytesChanged: 0,
      reason: 'no-change' as WriteReason,
    };
  }

  const nextBytes = editResult.nextBytes;
  const nextText = new TextDecoder('utf-8').decode(nextBytes);

  // No-change check: compare full serialized bytes before attempting patch
  if (nextText === original) {
    return {
      written: 0,
      changed: false,
      dryRun,
      serversWritten: [],
      targetPaths: [targetPathFor(target)],
      resolvedPath: targetPath,
      format: 'jsonc' as McpLocationFormat,
      bytesChanged: 0,
      reason: 'no-change' as WriteReason,
    };
  }

  if (!dryRun) {
    await atomicWrite(targetPath, nextText);
  }

  return {
    written: touched.length,
    changed: true,
    dryRun,
    serversWritten: touched,
    targetPaths: [targetPathFor(target)],
    resolvedPath: targetPath,
    format: 'jsonc' as McpLocationFormat,
    bytesChanged: Math.abs(
      nextBytes.length - new TextEncoder().encode(original).length,
    ),
  };
}
