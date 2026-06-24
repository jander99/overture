/**
 * Public @overture/config surface.
 *
 * Exports the Zod schema for `overture.jsonc`, the XDG path resolver for
 * the user-level config, a small loader that reads + parses + validates
 * the config file at the resolved path, and a writer that atomically
 * creates the canonical `overture.jsonc` with generated comments.
 *
 * Supported platforms: Linux (native + WSL1 + WSL2) and macOS. Both use
 * the same XDG layout — `${XDG_CONFIG_HOME:-~/.config}/overture/...`.
 * Windows is explicitly out of scope for v1.
 */
export * from './schema.js';
export * from './paths.js';
export * from './loader.js';
export * from './writer.js';
