/**
 * @module sync-types
 */

import type { ClientName, BinaryDetectionResult } from './base-types.js';

/**
 * Result of sync operation across all clients
 *
 * Contains aggregated results from syncing MCP configurations
 * to all detected clients.
 */
export interface SyncResult {
  /**
   * Whether sync completed successfully
   */
  success: boolean;

  /**
   * Results per client
   */
  clients: Record<ClientName, ClientSyncResult>;

  /**
   * Overall summary
   */
  summary: {
    totalClients: number;
    successfulClients: number;
    failedClients: number;
    totalMcps: number;
    syncedMcps: number;
    skippedMcps: number;
  };

  /**
   * Errors encountered
   */
  errors: Error[];
}

/**
 * Client-specific sync result
 */
export interface ClientSyncResult {
  /**
   * Whether client sync succeeded
   */
  success: boolean;

  /**
   * MCP servers synced to this client
   */
  synced: string[];

  /**
   * MCP servers skipped (excluded)
   */
  skipped: string[];

  /**
   * Backup file path (if created)
   */
  backupPath?: string;

  /**
   * Binary detection result for this client
   */
  binaryDetection?: BinaryDetectionResult;

  /**
   * Error if sync failed
   */
  error?: Error;
}

/**
 * Backup Metadata
 *
 * Metadata for a configuration backup.
 */
export interface BackupMetadata {
  /**
   * Client name
   */
  client: ClientName;

  /**
   * Backup file path
   */
  path: string;

  /**
   * Backup timestamp
   */
  timestamp: Date;

  /**
   * Original config file path
   */
  originalPath: string;

  /**
   * File size in bytes
   */
  size: number;

  /**
   * Checksum (for integrity verification)
   */
  checksum?: string;
}

/**
 * Audit Result
 *
 * Result of auditing client configurations for unmanaged MCPs.
 */
export interface AuditResult {
  /**
   * MCPs managed by Overture
   */
  managed: string[];

  /**
   * MCPs found in clients but not in Overture config
   */
  unmanaged: Record<ClientName, string[]>;

  /**
   * Total unmanaged MCPs across all clients
   */
  totalUnmanaged: number;

  /**
   * Suggestions for consolidation
   */
  suggestions: string[];
}
