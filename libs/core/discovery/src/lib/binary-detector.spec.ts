/**
 * BinaryDetector Tests
 *
 * @module lib/binary-detector.spec
 */

import { describe, it, expect } from 'vitest';
import { BinaryDetector } from './binary-detector.js';
import {
  createMockProcessPort,
  createMockEnvironmentPort,
  createMockFilesystem,
  createFilesystemFunctions,
  createMockAdapter,
} from './test-helpers.js';

describe('BinaryDetector', () => {
  describe('detectBinary', () => {
    it('should detect binary in PATH with version', async () => {
      const execResults = new Map([
        ['which claude', { stdout: '/usr/local/bin/claude\n', stderr: '', exitCode: 0 }],
        ['claude --version', { stdout: 'Claude Code 2.1.0\n', stderr: '', exitCode: 0 }],
      ]);
      const commandExists = new Map([['claude', true]]);

      const processPort = createMockProcessPort(execResults, commandExists);
      const environmentPort = createMockEnvironmentPort('linux');
      const detector = new BinaryDetector(
        processPort,
        environmentPort,
        () => false,
        () => ''
      );

      const result = await detector.detectBinary('claude');

      expect(result.found).toBe(true);
      expect(result.path).toBe('/usr/local/bin/claude');
      expect(result.version).toBe('2.1.0');
    });

    it('should detect binary on Windows using where command', async () => {
      const execResults = new Map([
        ['where claude', { stdout: 'C:\\Program Files\\Claude\\claude.exe\n', stderr: '', exitCode: 0 }],
        ['claude --version', { stdout: '2.1.0\n', stderr: '', exitCode: 0 }],
      ]);
      const commandExists = new Map([['claude', true]]);

      const processPort = createMockProcessPort(execResults, commandExists);
      const environmentPort = createMockEnvironmentPort('win32');
      const detector = new BinaryDetector(
        processPort,
        environmentPort,
        () => false,
        () => ''
      );

      const result = await detector.detectBinary('claude');

      expect(result.found).toBe(true);
      expect(result.path).toBe('C:\\Program Files\\Claude\\claude.exe');
      expect(result.version).toBe('2.1.0');
    });

    it('should return not found when binary does not exist', async () => {
      const processPort = createMockProcessPort();
      const environmentPort = createMockEnvironmentPort();
      const detector = new BinaryDetector(
        processPort,
        environmentPort,
        () => false,
        () => ''
      );

      const result = await detector.detectBinary('nonexistent');

      expect(result.found).toBe(false);
      expect(result.path).toBeUndefined();
      expect(result.version).toBeUndefined();
    });

    it('should detect binary even if version command fails', async () => {
      const execResults = new Map([
        ['which claude', { stdout: '/usr/local/bin/claude\n', stderr: '', exitCode: 0 }],
        ['claude --version', { stdout: '', stderr: 'error', exitCode: 1 }],
      ]);
      const commandExists = new Map([['claude', true]]);

      const processPort = createMockProcessPort(execResults, commandExists);
      const environmentPort = createMockEnvironmentPort('linux');
      const detector = new BinaryDetector(
        processPort,
        environmentPort,
        () => false,
        () => ''
      );

      const result = await detector.detectBinary('claude');

      expect(result.found).toBe(true);
      expect(result.path).toBe('/usr/local/bin/claude');
      expect(result.version).toBeUndefined();
    });
  });

  describe('detectAppBundle', () => {
    it('should detect app bundle when path exists', async () => {
      const fs = createMockFilesystem();
      fs.directories.add('/Applications/Claude.app');

      const { fileExists } = createFilesystemFunctions(fs);

      const processPort = createMockProcessPort();
      const environmentPort = createMockEnvironmentPort();
      const detector = new BinaryDetector(
        processPort,
        environmentPort,
        fileExists,
        () => ''
      );

      const result = await detector.detectAppBundle(['/Applications/Claude.app']);

      expect(result.found).toBe(true);
      expect(result.path).toBe('/Applications/Claude.app');
    });

    it('should return not found when no app bundle paths exist', async () => {
      const processPort = createMockProcessPort();
      const environmentPort = createMockEnvironmentPort();
      const detector = new BinaryDetector(
        processPort,
        environmentPort,
        () => false,
        () => ''
      );

      const result = await detector.detectAppBundle([
        '/Applications/Claude.app',
        '/Applications/Claude2.app',
      ]);

      expect(result.found).toBe(false);
      expect(result.path).toBeUndefined();
    });

    it('should return first existing app bundle', async () => {
      const fs = createMockFilesystem();
      fs.directories.add('/Applications/Claude2.app');

      const { fileExists } = createFilesystemFunctions(fs);

      const processPort = createMockProcessPort();
      const environmentPort = createMockEnvironmentPort();
      const detector = new BinaryDetector(
        processPort,
        environmentPort,
        fileExists,
        () => ''
      );

      const result = await detector.detectAppBundle([
        '/Applications/Claude.app',
        '/Applications/Claude2.app',
      ]);

      expect(result.found).toBe(true);
      expect(result.path).toBe('/Applications/Claude2.app');
    });
  });

  describe('validateConfigFile', () => {
    it('should validate valid JSON config', () => {
      const fs = createMockFilesystem();
      fs.files.set('/config.json', '{"mcpServers": {}}');

      const { fileExists, readFile } = createFilesystemFunctions(fs);

      const processPort = createMockProcessPort();
      const environmentPort = createMockEnvironmentPort();
      const detector = new BinaryDetector(
        processPort,
        environmentPort,
        fileExists,
        readFile
      );

      const result = detector.validateConfigFile('/config.json');

      expect(result).toBe(true);
    });

    it('should return false for invalid JSON', () => {
      const fs = createMockFilesystem();
      fs.files.set('/config.json', '{ invalid json }');

      const { fileExists, readFile } = createFilesystemFunctions(fs);

      const processPort = createMockProcessPort();
      const environmentPort = createMockEnvironmentPort();
      const detector = new BinaryDetector(
        processPort,
        environmentPort,
        fileExists,
        readFile
      );

      const result = detector.validateConfigFile('/config.json');

      expect(result).toBe(false);
    });

    it('should return false for nonexistent file', () => {
      const processPort = createMockProcessPort();
      const environmentPort = createMockEnvironmentPort();
      const detector = new BinaryDetector(
        processPort,
        environmentPort,
        () => false,
        () => ''
      );

      const result = detector.validateConfigFile('/nonexistent.json');

      expect(result).toBe(false);
    });
  });

  describe('detectClient', () => {
    it('should detect client with binary and config', async () => {
      const execResults = new Map([
        ['which claude', { stdout: '/usr/local/bin/claude\n', stderr: '', exitCode: 0 }],
        ['claude --version', { stdout: '2.1.0\n', stderr: '', exitCode: 0 }],
      ]);
      const commandExists = new Map([['claude', true]]);

      const fs = createMockFilesystem();
      fs.files.set('/home/testuser/.claude.json', '{"mcpServers": {}}');

      const { fileExists, readFile } = createFilesystemFunctions(fs);

      const processPort = createMockProcessPort(execResults, commandExists);
      const environmentPort = createMockEnvironmentPort('linux');
      const detector = new BinaryDetector(
        processPort,
        environmentPort,
        fileExists,
        readFile
      );

      const adapter = createMockAdapter('claude-code', {
        getBinaryNames: () => ['claude'],
        detectConfigPath: () => '/home/testuser/.claude.json',
      });

      const result = await detector.detectClient(adapter, 'linux');

      expect(result.status).toBe('found');
      expect(result.binaryPath).toBe('/usr/local/bin/claude');
      expect(result.version).toBe('2.1.0');
      expect(result.configPath).toBe('/home/testuser/.claude.json');
      expect(result.configValid).toBe(true);
    });

    it('should return not-found when required binary is missing', async () => {
      const processPort = createMockProcessPort();
      const environmentPort = createMockEnvironmentPort();
      const detector = new BinaryDetector(
        processPort,
        environmentPort,
        () => false,
        () => ''
      );

      const adapter = createMockAdapter('claude-code', {
        getBinaryNames: () => ['claude'],
        requiresBinary: () => true,
      });

      const result = await detector.detectClient(adapter, 'linux');

      expect(result.status).toBe('not-found');
      expect(result.warnings).toContain("Required binary 'claude' not found in PATH");
    });

    it('should detect app bundle when binary is not required', async () => {
      const fs = createMockFilesystem();
      fs.directories.add('/Applications/Claude.app');

      const { fileExists } = createFilesystemFunctions(fs);

      const processPort = createMockProcessPort();
      const environmentPort = createMockEnvironmentPort('darwin');
      const detector = new BinaryDetector(
        processPort,
        environmentPort,
        fileExists,
        () => ''
      );

      const adapter = createMockAdapter('claude-desktop', {
        getBinaryNames: () => [],
        getAppBundlePaths: () => ['/Applications/Claude.app'],
        requiresBinary: () => false,
      });

      const result = await detector.detectClient(adapter, 'darwin');

      expect(result.status).toBe('found');
      expect(result.appBundlePath).toBe('/Applications/Claude.app');
    });

    it('should warn about invalid config but still report found', async () => {
      const execResults = new Map([
        ['which claude', { stdout: '/usr/local/bin/claude\n', stderr: '', exitCode: 0 }],
        ['claude --version', { stdout: '2.1.0\n', stderr: '', exitCode: 0 }],
      ]);
      const commandExists = new Map([['claude', true]]);

      const fs = createMockFilesystem();
      fs.files.set('/home/testuser/.claude.json', '{ invalid }');

      const { fileExists, readFile } = createFilesystemFunctions(fs);

      const processPort = createMockProcessPort(execResults, commandExists);
      const environmentPort = createMockEnvironmentPort('linux');
      const detector = new BinaryDetector(
        processPort,
        environmentPort,
        fileExists,
        readFile
      );

      const adapter = createMockAdapter('claude-code', {
        getBinaryNames: () => ['claude'],
        detectConfigPath: () => '/home/testuser/.claude.json',
      });

      const result = await detector.detectClient(adapter, 'linux');

      expect(result.status).toBe('found');
      expect(result.configValid).toBe(false);
      expect(result.warnings?.[0]).toContain('Config file exists but is invalid JSON');
    });
  });
});
