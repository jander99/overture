/**
 * Tests for Composition Root
 *
 * Ensures dependency injection setup is correct.
 */

import { describe, it, expect } from 'vitest';
import { createAppDependencies } from './composition-root';

describe('createAppDependencies', () => {
  it('should create all required dependencies', () => {
    const deps = createAppDependencies();

    // Verify all required dependencies are present
    expect(deps).toBeDefined();
    expect(deps.syncEngine).toBeDefined();
    expect(deps.output).toBeDefined();
    expect(deps.configLoader).toBeDefined();
    expect(deps.pathResolver).toBeDefined();
    expect(deps.adapterRegistry).toBeDefined();
    expect(deps.pluginDetector).toBeDefined();
    expect(deps.pluginInstaller).toBeDefined();
    expect(deps.pluginExporter).toBeDefined();
    expect(deps.backupService).toBeDefined();
    expect(deps.restoreService).toBeDefined();
    expect(deps.importService).toBeDefined();
    expect(deps.cleanupService).toBeDefined();
    expect(deps.auditService).toBeDefined();
    expect(deps.skillDiscovery).toBeDefined();
    expect(deps.skillSyncService).toBeDefined();
    expect(deps.skillCopyService).toBeDefined();
  });

  it('should create output port with Logger implementation', () => {
    const deps = createAppDependencies();

    // Verify output has required methods
    expect(typeof deps.output.info).toBe('function');
    expect(typeof deps.output.success).toBe('function');
    expect(typeof deps.output.warn).toBe('function');
    expect(typeof deps.output.error).toBe('function');
  });

  it('should create filesystem port', () => {
    const deps = createAppDependencies();

    // Verify filesystem methods are available
    expect(deps.filesystem).toBeDefined();
    expect(typeof deps.filesystem.readFile).toBe('function');
    expect(typeof deps.filesystem.writeFile).toBe('function');
    expect(typeof deps.filesystem.exists).toBe('function');
  });

  it('should create process and environment ports', () => {
    const deps = createAppDependencies();

    // Verify process methods are available
    expect(deps.process).toBeDefined();
    expect(deps.environment).toBeDefined();
  });

  it('should create all services with proper dependencies', () => {
    const deps = createAppDependencies();

    // Sync engine should be functional
    expect(deps.syncEngine).toBeDefined();
    expect(typeof deps.syncEngine.syncClients).toBe('function');

    // Discovery service should be functional
    expect(deps.discoveryService).toBeDefined();

    // Skill sync service should be functional
    expect(deps.skillSyncService).toBeDefined();
  });
});
