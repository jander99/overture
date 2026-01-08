/**
 * @module utility-types
 */

/**
 * Process Lock
 *
 * Lock file to prevent concurrent Overture runs.
 */
export interface ProcessLock {
  /**
   * Process ID
   */
  pid: number;

  /**
   * Lock timestamp
   */
  timestamp: Date;

  /**
   * Command being executed
   */
  command: string;

  /**
   * Lock file path
   */
  lockPath: string;
}

/**
 * Type for JSON values that can appear in MCP configs
 *
 * Represents any valid JSON value type for MCP configuration serialization.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonArray;

/**
 * JSON object type for MCP configurations
 */
export interface JsonObject {
  [key: string]: JsonValue;
}

/**
 * JSON array type for MCP configurations
 */
export type JsonArray = JsonValue[];
