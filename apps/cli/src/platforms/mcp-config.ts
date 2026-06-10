import { createRequire } from 'node:module';
import {
  parse as parseJsonc,
  type ParseError,
} from 'jsonc-parser/lib/esm/main.js';
import type { McpLocationFormat } from '@overture/agents';

// `smol-toml` is published as ESM-first but ships a CJS build at
// `./dist/index.cjs` (reachable via the `require` condition in its
// `package.json` `exports` field). The CLI bundle targets CJS, and a CJS
// module cannot statically `import` an ESM-only module under
// `module: nodenext`, so we load the CJS build through `createRequire`
// to keep the public API synchronous.
//
// For npm consumers, `smol-toml` is listed as a runtime `dependency` in
// `apps/cli/package.json`, so `npm install @jander99/overture` installs
// it alongside the CLI. `createRequire(__filename)` then resolves it
// from the standard `node_modules` lookup path that npm sets up.
interface SmolTomlCjsModule {
  parse: (text: string, options?: unknown) => Record<string, unknown>;
}
const smolTomlCjsModule = createRequire(__filename)(
  'smol-toml',
) as unknown as SmolTomlCjsModule;
createRequire(__filename)('smol-toml');
function parseToml(text: string): Record<string, unknown> {
  return smolTomlCjsModule.parse(text);
}

export interface McpConfigParseResult {
  /** True if the expected top-level key/table is present and non-empty. */
  configured: boolean;
  /** True if the file was readable AND parseable without error. */
  parsed: boolean;
  /** Parser-reported error message (if any). */
  parseError?: string;
  /**
   * The parsed top-level document, when the parse succeeded and the
   * configured top-level key was present and non-empty. Set ONLY when
   * `parsed && configured` is true; undefined on empty, missing-key,
   * parse-error, or topLevelKey-required paths.
   *
   * The per-agent MCP reader casts this into the agent's `*McpConfig`
   * shape without re-parsing the file.
   */
  readonly document?: unknown;
}

export interface ParseMcpConfigOptions {
  /** File contents as a UTF-8 string. */
  contents: string;
  /** Parser format. */
  format: McpLocationFormat;
  /** The top-level key/table that indicates MCP configuration. E.g., 'mcpServers', 'mcp', 'servers', 'context_servers', 'mcp_servers'. */
  topLevelKey: string;
}

function isJsonLike(format: McpLocationFormat): boolean {
  return format === 'json' || format === 'jsonc';
}

function isContainer(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyContainer(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (isContainer(value)) {
    return Object.keys(value).length > 0;
  }
  return false;
}

function stripBom(contents: string): string {
  return contents.charCodeAt(0) === 0xfeff ? contents.slice(1) : contents;
}

export function parseMcpConfig(
  options: ParseMcpConfigOptions,
): McpConfigParseResult {
  const { contents, format, topLevelKey } = options;

  if (topLevelKey === '') {
    return {
      configured: false,
      parsed: false,
      parseError: 'topLevelKey required',
    };
  }

  if (contents === '') {
    return { configured: false, parsed: true };
  }

  if (isJsonLike(format)) {
    const cleaned = stripBom(contents);
    const errors: ParseError[] = [];
    let result: unknown;
    try {
      result = parseJsonc(cleaned, errors, {
        allowTrailingComma: true,
        disallowComments: false,
      });
    } catch (err) {
      return {
        configured: false,
        parsed: false,
        parseError: err instanceof Error ? err.message : String(err),
      };
    }
    if (errors.length > 0) {
      const first = errors[0];
      const offset = first?.offset ?? 0;
      return {
        configured: false,
        parsed: false,
        parseError: `${first?.error ?? 'parse error'} at offset ${offset}`,
      };
    }
    if (!isContainer(result)) {
      return { configured: false, parsed: true };
    }
    const section = result[topLevelKey];
    if (!nonEmptyContainer(section)) {
      return { configured: false, parsed: true };
    }
    return {
      configured: true,
      parsed: true,
      document: result,
    };
  }

  if (format === 'toml') {
    const cleaned = stripBom(contents);
    let result: unknown;
    try {
      result = parseToml(cleaned);
    } catch (err) {
      return {
        configured: false,
        parsed: false,
        parseError: err instanceof Error ? err.message : String(err),
      };
    }
    if (!isContainer(result)) {
      return { configured: false, parsed: true };
    }
    const section = result[topLevelKey];
    if (!isContainer(section)) {
      return { configured: false, parsed: true };
    }
    if (Object.keys(section).length === 0) {
      return { configured: false, parsed: true };
    }
    return {
      configured: true,
      parsed: true,
      document: result,
    };
  }

  return { configured: false, parsed: false, parseError: 'unsupported format' };
}
