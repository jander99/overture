/**
 * OpenCode canonical-to-native MCP server conversion.
 *
 * Pure in-memory conversion: the `toOpenCodeMcpServer` helper has no IO.
 * The `opencodeWriteMcpConfig` function below is the metadata-only writer
 * wired into the agent's `mcp.write` slot. It preserves every byte outside
 * the touched server entries (comments, whitespace, key order, unrelated
 * top-level keys, and unrelated MCP servers) by surgically replacing only
 * the byte ranges that `parseTree` identifies as the touched subtrees.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import {
  parseTree,
  type Node,
  type ParseError,
} from 'jsonc-parser/lib/esm/main.js';
import type { OvertureMcpServer } from '@overture/config';
import { opencode } from './opencode.js';
import type { OpenCodeMcpServer } from './opencode.js';
import type {
  AgentMcpWriteInput,
  AgentMcpWriteResult,
  McpLocation,
  McpLocationFormat,
  PathResolutionContext,
  TargetPath,
} from './types.js';
import type { JsonValue } from './types.js';

export type OpenCodeWritableMcpServer = OpenCodeMcpServer &
  Readonly<Record<string, JsonValue | undefined>>;

const CANONICAL_FIELD_NAMES = new Set<string>([
  'type',
  'command',
  'environment',
  'url',
  'headers',
]);

export function toOpenCodeMcpServer(
  server: OvertureMcpServer,
  existing?: OpenCodeWritableMcpServer,
): OpenCodeWritableMcpServer {
  const extensions = collectExtensions(existing);

  if (server.type === 'stdio') {
    return {
      ...extensions,
      type: 'local',
      command: [server.command, ...(server.args ?? [])],
      ...(server.env === undefined ? {} : { environment: server.env }),
    };
  }

  return {
    ...extensions,
    type: 'remote',
    url: server.url,
    ...(server.headers === undefined ? {} : { headers: server.headers }),
  };
}

function collectExtensions(
  existing: OpenCodeWritableMcpServer | undefined,
): Record<string, JsonValue> {
  const extensions: Record<string, JsonValue> = {};
  if (existing === undefined) {
    return extensions;
  }

  for (const key of Object.keys(existing)) {
    if (CANONICAL_FIELD_NAMES.has(key)) {
      continue;
    }
    const value = existing[key];
    if (value !== undefined) {
      extensions[key] = value;
    }
  }

  return extensions;
}

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function findApplicableLocation(
  ctx: PathResolutionContext,
): { readonly loc: McpLocation; readonly resolvedPath: string } | null {
  for (const loc of opencode.mcpLocations) {
    if (loc.platforms !== undefined && !loc.platforms.includes(ctx.platform)) {
      continue;
    }
    const path =
      loc.base === 'home'
        ? join(ctx.homeDir, loc.relativePath)
        : loc.base === 'config'
          ? join(ctx.configDir, loc.relativePath)
          : loc.base === 'workspace'
            ? join(ctx.workspaceDir, loc.relativePath)
            : loc.relativePath;
    return { loc, resolvedPath: path };
  }
  return null;
}

async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    if (
      isObject(err) &&
      typeof err['code'] === 'string' &&
      ['ENOENT', 'EACCES', 'EPERM', 'EISDIR'].includes(err['code'])
    ) {
      return null;
    }
    throw err;
  }
}

async function atomicWrite(
  targetPath: string,
  contents: string,
): Promise<void> {
  await mkdir(dirname(targetPath), { recursive: true });
  const tempPath = join(
    dirname(targetPath),
    `.${basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(tempPath, contents, 'utf8');
    await rename(tempPath, targetPath);
  } catch (err) {
    try {
      await rm(tempPath, { force: true });
    } catch {
      /* best-effort cleanup */
    }
    throw err;
  }
}

function renderServer(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

interface PlannedEdit {
  readonly start: number;
  readonly end: number;
  readonly replacement: string;
}

function applyEdits(text: string, edits: readonly PlannedEdit[]): string {
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  let out = text;
  for (const edit of sorted) {
    out = out.slice(0, edit.start) + edit.replacement + out.slice(edit.end);
  }
  return out;
}

function findChildProperty(root: Node, key: string): Node | undefined {
  if (root.type !== 'object' || root.children === undefined) return undefined;
  for (const property of root.children) {
    if (property.type !== 'property' || property.children === undefined)
      continue;
    const keyNode = property.children[0];
    if (keyNode !== undefined && keyNode.value === key) {
      return property;
    }
  }
  return undefined;
}

function safeParseNodeValue(text: string, node: Node): unknown {
  try {
    return JSON.parse(text.slice(node.offset, node.offset + node.length));
  } catch {
    return undefined;
  }
}

function findServerPropertyRange(
  mcpNode: Node,
  text: string,
  serverName: string,
): { readonly start: number; readonly end: number } | null {
  if (mcpNode.type !== 'object' || mcpNode.children === undefined) {
    return null;
  }
  for (const property of mcpNode.children) {
    if (property.type !== 'property' || property.children === undefined)
      continue;
    const keyNode = property.children[0];
    if (keyNode === undefined || keyNode.value !== serverName) continue;
    let end = property.offset + property.length;
    while (end < text.length && /[ \t]/.test(text[end]!)) {
      end++;
    }
    if (text[end] === ',') end++;
    let start = property.offset;
    while (start > 0 && /[ \t]/.test(text[start - 1]!)) {
      start--;
    }
    return { start, end };
  }
  return null;
}

function detectIndent(text: string, node: Node): string {
  let lineStart = node.offset;
  while (lineStart > 0 && text[lineStart - 1] !== '\n') {
    lineStart--;
  }
  let indentLen = 0;
  while (
    lineStart + indentLen < node.offset &&
    text[lineStart + indentLen] === ' '
  ) {
    indentLen++;
  }
  return ' '.repeat(Math.max(indentLen, 2));
}

function mcpObjectBodyRange(
  mcpNode: Node,
  text: string,
): { readonly start: number; readonly end: number } | null {
  if (mcpNode.type !== 'object') return null;
  const open = text.indexOf('{', mcpNode.offset);
  if (open < 0) return null;
  const close = mcpNode.offset + mcpNode.length - 1;
  if (text[close] !== '}') return null;
  return { start: open + 1, end: close };
}

function indentMultiLine(text: string, indent: string): string {
  const lines = text.split('\n');
  return lines
    .map((line, idx) => (idx === 0 ? line : `${indent}${line}`))
    .join('\n');
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function findInsertionPoint(
  text: string,
  body: { readonly start: number; readonly end: number },
  lastChild: Node | undefined,
): number {
  if (lastChild !== undefined && lastChild.type === 'property') {
    let probe = lastChild.offset + lastChild.length;
    while (probe < body.end && /[ \t]/.test(text[probe]!)) probe++;
    if (text[probe] === ',') probe++;
    while (probe < body.end && text[probe] === '\n') probe++;
    return probe;
  }
  let probe = body.start;
  if (text[probe] === '\n') probe++;
  return probe;
}

interface PlanResult {
  readonly written: string;
  readonly changed: boolean;
  readonly touched: readonly string[];
}

function planEdits(args: {
  readonly text: string;
  readonly input: readonly {
    readonly name: string;
    readonly server: OpenCodeMcpServer;
  }[];
  readonly mcpKey: string;
}): PlanResult | { readonly parseError: true } {
  const errors: ParseError[] = [];
  const root = parseTree(args.text, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  if (errors.length > 0 || root === undefined || root.type !== 'object') {
    return { parseError: true };
  }
  const mcpProperty = findChildProperty(root, args.mcpKey);
  const mcpValueNode =
    mcpProperty !== undefined && mcpProperty.children !== undefined
      ? mcpProperty.children[1]
      : undefined;

  const existingServers: Record<string, OpenCodeMcpServer> = {};
  if (mcpValueNode !== undefined && mcpValueNode.type === 'object') {
    for (const prop of mcpValueNode.children ?? []) {
      if (prop.type !== 'property' || prop.children === undefined) continue;
      const keyNode = prop.children[0];
      const valueNode = prop.children[1];
      if (keyNode === undefined || valueNode === undefined) continue;
      const name = String(keyNode.value);
      const parsed = safeParseNodeValue(args.text, valueNode);
      if (parsed !== undefined && isObject(parsed)) {
        existingServers[name] = parsed as unknown as OpenCodeMcpServer;
      }
    }
  }

  const edits: PlannedEdit[] = [];
  const touched: string[] = [];

  if (mcpValueNode !== undefined && mcpValueNode.type === 'object') {
    const indent = detectIndent(args.text, mcpValueNode);
    for (const entry of args.input) {
      const existingRaw = existingServers[entry.name];
      const existingWritable =
        existingRaw !== undefined
          ? (existingRaw as unknown as OpenCodeWritableMcpServer)
          : undefined;
      const next = toOpenCodeMcpServer(
        entry.server as unknown as OvertureMcpServer,
        existingWritable,
      );

      const range = findServerPropertyRange(
        mcpValueNode,
        args.text,
        entry.name,
      );
      if (range !== null) {
        if (existingRaw !== undefined && deepEqual(existingRaw, next)) {
          continue;
        }
        edits.push({
          start: range.start,
          end: range.end,
          replacement: renderServer(next),
        });
        touched.push(entry.name);
      } else {
        const body = mcpObjectBodyRange(mcpValueNode, args.text);
        if (body === null) continue;
        const rendered = renderServer(next);
        const indented = indentMultiLine(rendered, indent);
        const spliceText = `${indent}${indented},\n`;
        const lastChild =
          mcpValueNode.children?.[mcpValueNode.children.length - 1];
        const insertAt = findInsertionPoint(args.text, body, lastChild);
        edits.push({ start: insertAt, end: insertAt, replacement: spliceText });
        touched.push(entry.name);
      }
    }
  } else {
    if (root.type !== 'object') return { parseError: true };
    const body = mcpObjectBodyRange(root, args.text);
    if (body === null) return { parseError: true };
    const indent = detectIndent(args.text, root);
    const mcpObj: Record<string, OpenCodeMcpServer> = {};
    for (const entry of args.input) {
      const existingRaw = existingServers[entry.name];
      const existingWritable =
        existingRaw !== undefined
          ? (existingRaw as unknown as OpenCodeWritableMcpServer)
          : undefined;
      mcpObj[entry.name] = toOpenCodeMcpServer(
        entry.server as unknown as OvertureMcpServer,
        existingWritable,
      );
    }
    const rendered = renderServer(mcpObj);
    const indented = indentMultiLine(rendered, indent);
    const spliceText = `${indent}${JSON.stringify(args.mcpKey)}: ${indented},\n`;
    const lastChild = root.children?.[root.children.length - 1];
    const insertAt = findInsertionPoint(args.text, body, lastChild);
    edits.push({ start: insertAt, end: insertAt, replacement: spliceText });
    for (const entry of args.input) touched.push(entry.name);
  }

  if (edits.length === 0) {
    return { written: args.text, changed: false, touched: [] };
  }
  return {
    written: applyEdits(args.text, edits),
    changed: true,
    touched,
  };
}

function freshDocument(mcp: Record<string, OpenCodeMcpServer>): string {
  const rendered = renderServer(mcp);
  return `{\n  "mcp": ${rendered}\n}\n`;
}

function isJsonLike(format: McpLocationFormat): boolean {
  return format === 'json' || format === 'jsonc';
}

export async function opencodeWriteMcpConfig(
  ctx: PathResolutionContext,
  input: AgentMcpWriteInput,
): Promise<AgentMcpWriteResult> {
  const dryRun = input.dryRun === true;
  const located = findApplicableLocation(ctx);
  if (located === null) {
    return {
      written: 0,
      changed: false,
      dryRun,
      serversWritten: [],
      targetPaths: [],
      reason: 'not-targetable',
    };
  }
  const { loc, resolvedPath } = located;
  if (!isJsonLike(loc.format)) {
    return {
      written: 0,
      changed: false,
      dryRun,
      serversWritten: [],
      targetPaths: [],
      reason: 'unsupported-format',
    };
  }

  const targetPaths: TargetPath[] = [
    { scope: loc.scope, base: loc.base, path: loc.relativePath },
  ];

  const original = await readIfExists(resolvedPath);
  const mcpKey = loc.topLevelKey ?? 'mcp';

  // No existing file: build a fresh document. Only do this when there is
  // at least one input server; an empty input against a missing file is a
  // no-change no-op.
  if (original === null) {
    if (input.servers.length === 0) {
      return {
        written: 0,
        changed: false,
        dryRun,
        serversWritten: [],
        targetPaths,
        resolvedPath,
        format: loc.format,
        reason: 'no-change',
      };
    }
    const mcpObj: Record<string, OpenCodeMcpServer> = {};
    for (const entry of input.servers) {
      mcpObj[entry.name] = toOpenCodeMcpServer(entry.server);
    }
    const written = freshDocument(mcpObj);
    if (!dryRun) {
      await atomicWrite(resolvedPath, written);
    }
    return {
      written: input.servers.length,
      changed: true,
      dryRun,
      serversWritten: input.servers.map((s) => s.name),
      targetPaths,
      resolvedPath,
      format: loc.format,
      bytesChanged: written.length,
    };
  }

  // Convert the writer input into the canonical form the planner consumes.
  // The planner only needs (name, server) pairs.
  const planned = planEdits({
    text: original,
    mcpKey,
    input: input.servers.map((s) => {
      // toOpenCodeMcpServer is called inside the planner, but the planner
      // doesn't have access to the raw canonical server — pre-compute the
      // native shape here and pass it through. The planner still re-derives
      // it for extension preservation against existing entries.
      return { name: s.name, server: toOpenCodeMcpServer(s.server) };
    }),
  });
  if ('parseError' in planned) {
    return {
      written: 0,
      changed: false,
      dryRun,
      serversWritten: [],
      targetPaths,
      resolvedPath,
      format: loc.format,
      reason: 'parse-error',
    };
  }

  if (!planned.changed) {
    return {
      written: 0,
      changed: false,
      dryRun,
      serversWritten: [],
      targetPaths,
      resolvedPath,
      format: loc.format,
      reason: 'no-change',
    };
  }

  if (!dryRun) {
    await atomicWrite(resolvedPath, planned.written);
  }

  return {
    written: planned.touched.length,
    changed: true,
    dryRun,
    serversWritten: planned.touched,
    targetPaths,
    resolvedPath,
    format: loc.format,
    bytesChanged: planned.written.length - original.length,
  };
}
