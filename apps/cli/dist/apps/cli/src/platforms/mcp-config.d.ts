import type { McpLocationFormat } from './types.js';
export interface McpConfigParseResult {
    /** True if the expected top-level key/table is present and non-empty. */
    configured: boolean;
    /** True if the file was readable AND parseable without error. */
    parsed: boolean;
    /** Parser-reported error message (if any). */
    parseError?: string;
}
export interface ParseMcpConfigOptions {
    /** File contents as a UTF-8 string. */
    contents: string;
    /** Parser format. */
    format: McpLocationFormat;
    /** The top-level key/table that indicates MCP configuration. E.g., 'mcpServers', 'mcp', 'servers', 'context_servers', 'mcp_servers'. */
    topLevelKey: string;
}
export declare function parseMcpConfig(options: ParseMcpConfigOptions): McpConfigParseResult;
//# sourceMappingURL=mcp-config.d.ts.map