/**
 * Mock Strategy Examples
 *
 * This file demonstrates mock patterns for plugin sync testing.
 * Use these examples as reference when writing actual tests.
 *
 * @module core/__tests__/mock-examples.spec
 */

import * as fs from 'fs/promises';
import { ProcessExecutor } from '../../infrastructure/process-executor';
import {
  loadFixture,
  loadJsonFixture,
  loadYamlFixture
} from '../__fixtures__/fixture-loader';
import {
  buildInstalledPlugin,
  buildConfigWithPlugins,
  buildExecResult,
  buildClaudeSettings
} from './mock-builders';

// Mock all external dependencies
jest.mock('fs/promises');
jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));
jest.mock('../../infrastructure/process-executor');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockInquirer = { prompt: jest.fn() };
const mockProcessExecutor = ProcessExecutor as jest.MockedClass<typeof ProcessExecutor>;

describe('Mock Strategy Examples', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('File System Mocking', () => {
    it('should mock fs.readFile with fixture', async () => {
      // Load fixture at test time
      const fixture = await loadFixture('plugin-sync/claude-settings/valid-settings.json');

      // Mock fs to return fixture
      mockFs.readFile.mockResolvedValue(fixture);

      // Test code would call fs.readFile
      const result = await fs.readFile('/path/to/.claude/settings.json', 'utf-8');

      expect(result).toBe(fixture);
      expect(mockFs.readFile).toHaveBeenCalledWith(
        '/path/to/.claude/settings.json',
        'utf-8'
      );
    });

    it('should mock file not found error', async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT', message: 'File not found' });

      await expect(
        fs.readFile('/nonexistent/file.json', 'utf-8')
      ).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('should mock permission denied error', async () => {
      mockFs.readFile.mockRejectedValue({ code: 'EACCES', message: 'Permission denied' });

      await expect(
        fs.readFile('/protected/file.json', 'utf-8')
      ).rejects.toMatchObject({ code: 'EACCES' });
    });

    it('should mock writeFile and verify content', async () => {
      mockFs.writeFile.mockResolvedValue(undefined);

      await fs.writeFile('/path/to/config.yaml', 'version: "2.0"\n');

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/path/to/config.yaml',
        expect.stringContaining('version: "2.0"')
      );
    });
  });

  describe('Process Execution Mocking', () => {
    it('should mock successful command execution', async () => {
      mockProcessExecutor.exec.mockResolvedValue(
        buildExecResult('Plugin installed successfully\n')
      );

      const result = await ProcessExecutor.exec('claude', ['plugin', 'install', 'test@marketplace']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Plugin installed successfully');
      expect(mockProcessExecutor.exec).toHaveBeenCalledWith(
        'claude',
        ['plugin', 'install', 'test@marketplace']
      );
    });

    it('should mock command failure', async () => {
      mockProcessExecutor.exec.mockRejectedValue(
        new Error('Command execution failed: Plugin not found')
      );

      await expect(
        ProcessExecutor.exec('claude', ['plugin', 'install', 'bad@marketplace'])
      ).rejects.toThrow('Plugin not found');
    });

    it('should mock command-specific responses', async () => {
      mockProcessExecutor.exec.mockImplementation(async (command, args) => {
        if (command === 'claude' && args[0] === 'plugin') {
          if (args[1] === 'install') {
            return buildExecResult(`Installing ${args[2]}...\nDone!\n`);
          }
          if (args[1] === 'marketplace' && args[2] === 'add') {
            return buildExecResult(`Marketplace ${args[3]} added\n`);
          }
        }
        throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
      });

      const installResult = await ProcessExecutor.exec('claude', ['plugin', 'install', 'test@marketplace']);
      expect(installResult.stdout).toContain('Installing test@marketplace');

      const marketplaceResult = await ProcessExecutor.exec('claude', ['plugin', 'marketplace', 'add', 'test/repo']);
      expect(marketplaceResult.stdout).toContain('Marketplace test/repo added');
    });

    it('should mock binary detection', async () => {
      mockProcessExecutor.commandExists.mockResolvedValue(true);

      const exists = await ProcessExecutor.commandExists('claude');

      expect(exists).toBe(true);
      expect(mockProcessExecutor.commandExists).toHaveBeenCalledWith('claude');
    });
  });

  describe('Interactive Prompts Mocking', () => {
    it('should mock checkbox selection', async () => {
      mockInquirer.prompt.mockResolvedValue({
        selectedPlugins: ['python-development', 'backend-development']
      });

      const result = await mockInquirer.prompt([
        {
          type: 'checkbox',
          name: 'selectedPlugins',
          message: 'Select plugins to export:',
          choices: ['python-development', 'backend-development', 'custom-plugin']
        }
      ]);

      expect(result.selectedPlugins).toHaveLength(2);
      expect(result.selectedPlugins).toContain('python-development');
    });

    it('should mock confirmation prompt', async () => {
      mockInquirer.prompt.mockResolvedValue({ confirm: true });

      const result = await mockInquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Update config?'
        }
      ]);

      expect(result.confirm).toBe(true);
    });

    it('should mock dynamic prompts', async () => {
      mockInquirer.prompt.mockImplementation(async (questions: any) => {
        const question = Array.isArray(questions) ? questions[0] : questions;

        if (question.name === 'selectedPlugins') {
          return { selectedPlugins: ['python-development'] };
        }
        if (question.name === 'confirm') {
          return { confirm: true };
        }
        return {};
      });

      const selectResult = await mockInquirer.prompt([
        { type: 'checkbox', name: 'selectedPlugins', message: 'Select:' }
      ]);
      expect(selectResult.selectedPlugins).toEqual(['python-development']);

      const confirmResult = await mockInquirer.prompt([
        { type: 'confirm', name: 'confirm', message: 'Confirm?' }
      ]);
      expect(confirmResult.confirm).toBe(true);
    });
  });

  describe.skip('Fixture Loading', () => {
    // Note: These tests are skipped because they conflict with fs mocking
    // In real tests, load fixtures before mocking fs or use fixture data directly

    it('should load raw text fixture', async () => {
      const output = await loadFixture('plugin-sync/command-outputs/install-success.txt');

      expect(output).toContain('Plugin installed successfully');
      expect(output).toContain('python-development');
    });

    it('should load and parse JSON fixture', async () => {
      const settings = await loadJsonFixture('plugin-sync/claude-settings/valid-settings.json');

      expect(settings.plugins).toBeDefined();
      expect(settings.plugins['python-development']).toMatchObject({
        marketplace: 'claude-code-workflows',
        enabled: true
      });
    });

    it('should load and parse YAML fixture', async () => {
      const config = await loadYamlFixture('plugin-sync/configs/user-with-plugins.yaml');

      expect(config.version).toBe('2.0');
      expect(config.plugins['python-development']).toBeDefined();
      expect(config.plugins['python-development'].marketplace).toBe('claude-code-workflows');
    });
  });

  describe('Mock Builders', () => {
    it('should build installed plugin mock', () => {
      const plugin = buildInstalledPlugin({
        name: 'python-development',
        marketplace: 'claude-code-workflows'
      });

      expect(plugin).toMatchObject({
        name: 'python-development',
        marketplace: 'claude-code-workflows',
        enabled: true
      });
      expect(plugin.installedAt).toBeDefined();
    });

    it('should build config with plugins', () => {
      const config = buildConfigWithPlugins({
        'python-development': {
          marketplace: 'claude-code-workflows',
          enabled: true,
          mcps: ['python-repl']
        }
      });

      expect(config.version).toBe('2.0');
      expect(config.plugins).toBeDefined();
      expect(config.plugins['python-development']).toMatchObject({
        marketplace: 'claude-code-workflows',
        enabled: true,
        mcps: ['python-repl']
      });
    });

    it('should build Claude settings object', () => {
      const settings = buildClaudeSettings(
        {
          'python-development': {
            marketplace: 'claude-code-workflows',
            enabled: true
          }
        },
        ['anthropics/claude-code-workflows']
      );

      expect(settings.plugins['python-development']).toBeDefined();
      expect(settings.marketplaces).toContain('anthropics/claude-code-workflows');
    });
  });

  describe('Combined Mock Patterns', () => {
    it('should demonstrate full test scenario', async () => {
      // Arrange: Set up all mocks
      const settingsFixture = buildClaudeSettings({
        'python-development': {
          marketplace: 'claude-code-workflows',
          enabled: true,
          installedAt: '2025-01-15T10:00:00Z'
        }
      });
      mockFs.readFile.mockResolvedValue(JSON.stringify(settingsFixture));

      mockProcessExecutor.exec.mockResolvedValue(
        buildExecResult('Plugin installed successfully\n')
      );

      mockInquirer.prompt.mockResolvedValue({
        selectedPlugins: ['python-development']
      });

      // Act: Test code would use these mocks
      const settings = JSON.parse(
        await fs.readFile('/home/user/.claude/settings.json', 'utf-8')
      );

      const installResult = await ProcessExecutor.exec(
        'claude',
        ['plugin', 'install', 'test@marketplace']
      );

      const userSelection = await mockInquirer.prompt([
        { type: 'checkbox', name: 'selectedPlugins', message: 'Select:' }
      ]);

      // Assert: Verify behavior
      expect(settings.plugins['python-development']).toBeDefined();
      expect(installResult.exitCode).toBe(0);
      expect(userSelection.selectedPlugins).toContain('python-development');
    });
  });
});
