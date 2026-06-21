/**
 * Fingerprint rendering and URL redaction helpers for the C2 detailed scan
 * human report.
 *
 * Pure, dependency-free: every helper takes data, returns a string. The
 * `RenderableServer` union captures the shapes a downstream row can hold;
 * the type guards narrow safely without `any` so the call sites stay
 * exhaustively typed.
 */

export type RenderableServer =
  | {
      readonly type: 'stdio';
      readonly command?: string;
      readonly args?: readonly string[];
      readonly env?: Readonly<Record<string, string>>;
      readonly reason?: string;
    }
  | {
      readonly type: 'remote';
      readonly url?: string;
      readonly headers?: Readonly<Record<string, string>>;
      readonly reason?: string;
    }
  | {
      readonly type?: string;
      readonly reason?: string;
    };

/**
 * Render a single server entry as a redaction-safe fingerprint. Stdio
 * servers show `command`, `args` count, and `env` count; remote servers
 * show the URL with its query string and fragment redacted, plus the
 * header count. Unknown / shape-conflict shapes fall through to a
 * `<unknown>` or `shape-conflict reason=…` marker.
 */
export function renderFingerprint(server: unknown): string {
  if (!isRenderableServer(server)) {
    return '<unknown>';
  }
  if (isStdioRenderableServer(server)) {
    const command = server.command ?? '<unknown>';
    const args = server.args?.length ?? 0;
    const env = server.env === undefined ? 0 : Object.keys(server.env).length;
    return `stdio command=${command} args=${args} env=${env}`;
  }
  if (isRemoteRenderableServer(server)) {
    const headers =
      server.headers === undefined ? 0 : Object.keys(server.headers).length;
    return `remote url=${redactUrl(server.url ?? '')} headers=${headers}`;
  }
  if (server.reason !== undefined) {
    return `shape-conflict reason=${server.reason}`;
  }
  return '<unknown>';
}

/**
 * Redact a URL's query string and fragment so secret-bearing values never
 * leak to stdout. Malformed URLs return the literal `<invalid-url>` token
 * rather than throwing.
 */
export function redactUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    let result = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
    if (parsed.search !== '') {
      result += '?…';
    }
    if (parsed.hash !== '') {
      result += '#…';
    }
    return result;
  } catch {
    return '<invalid-url>';
  }
}

function isRenderableServer(server: unknown): server is RenderableServer {
  return typeof server === 'object' && server !== null;
}

function isStdioRenderableServer(
  server: RenderableServer,
): server is Extract<RenderableServer, { readonly type: 'stdio' }> {
  return server.type === 'stdio';
}

function isRemoteRenderableServer(
  server: RenderableServer,
): server is Extract<RenderableServer, { readonly type: 'remote' }> {
  return server.type === 'remote';
}
