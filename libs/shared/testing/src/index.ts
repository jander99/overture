/**
 * @overture/testing
 *
 * Shared testing utilities for Overture monorepo.
 * Provides mocks, fixtures, and builders for consistent testing across all libraries.
 *
 * @module @overture/testing
 */

// Mocks
export * from './lib/mocks/filesystem.mock.js';
export * from './lib/mocks/process.mock.js';
export * from './lib/mocks/adapter.mock.js';
export * from './lib/mocks/platform.mock.js';

// Fixtures
export * from './lib/fixtures/config.fixtures.js';

// Builders
export * from './lib/builders/config.builder.js';
