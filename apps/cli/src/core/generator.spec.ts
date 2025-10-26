import * as path from 'path';
import { Generator } from './generator';
import { FsUtils } from '../infrastructure/fs-utils';
import { TemplateLoader } from '../infrastructure/template-loader';
import { Logger } from '../utils/logger';
import type { OvertureConfig } from '../domain/types';

// Mock infrastructure dependencies
jest.mock('../infrastructure/fs-utils');
jest.mock('../infrastructure/template-loader');
jest.mock('../utils/logger');

describe('Generator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateMcpJson', () => {
    it('should include only enabled MCPs with command defined', () => {
      const config: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {},
        mcp: {
          'python-repl': {
            command: 'uvx',
            args: ['mcp-server-python-repl'],
            scope: 'project',
            enabled: true,
          },
          'ruff': {
            command: 'uvx',
            args: ['mcp-server-ruff'],
            scope: 'project',
            enabled: true,
          },
        },
      };

      const result = Generator.generateMcpJson(config);

      expect(result.mcpServers).toHaveProperty('python-repl');
      expect(result.mcpServers).toHaveProperty('ruff');
      expect(Object.keys(result.mcpServers)).toHaveLength(2);
    });

    it('should filter out disabled MCPs', () => {
      const config: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {},
        mcp: {
          'enabled-mcp': {
            command: 'test-command',
            scope: 'project',
            enabled: true,
          },
          'disabled-mcp': {
            command: 'disabled-command',
            scope: 'project',
            enabled: false,
          },
        },
      };

      const result = Generator.generateMcpJson(config);

      expect(result.mcpServers).toHaveProperty('enabled-mcp');
      expect(result.mcpServers).not.toHaveProperty('disabled-mcp');
      expect(Object.keys(result.mcpServers)).toHaveLength(1);
    });

    it('should exclude MCPs without command defined', () => {
      const config: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {},
        mcp: {
          'valid-mcp': {
            command: 'valid-command',
            scope: 'project',
          },
          'no-command-mcp': {
            scope: 'project',
          },
        },
      };

      const result = Generator.generateMcpJson(config);

      expect(result.mcpServers).toHaveProperty('valid-mcp');
      expect(result.mcpServers).not.toHaveProperty('no-command-mcp');
    });

    it('should include args when present', () => {
      const config: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {},
        mcp: {
          'mcp-with-args': {
            command: 'uvx',
            args: ['mcp-server-python-repl', '--version'],
            scope: 'project',
          },
        },
      };

      const result = Generator.generateMcpJson(config);

      expect(result.mcpServers['mcp-with-args']).toEqual({
        command: 'uvx',
        args: ['mcp-server-python-repl', '--version'],
      });
    });

    it('should include env when present', () => {
      const config: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {},
        mcp: {
          'mcp-with-env': {
            command: 'mcp-server-github',
            env: {
              GITHUB_TOKEN: '${GITHUB_TOKEN}',
              LOG_LEVEL: 'debug',
            },
            scope: 'project',
          },
        },
      };

      const result = Generator.generateMcpJson(config);

      expect(result.mcpServers['mcp-with-env']).toEqual({
        command: 'mcp-server-github',
        env: {
          GITHUB_TOKEN: '${GITHUB_TOKEN}',
          LOG_LEVEL: 'debug',
        },
      });
    });

    it('should include both args and env when present', () => {
      const config: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {},
        mcp: {
          'mcp-full': {
            command: 'uvx',
            args: ['mcp-server-python-repl'],
            env: {
              DEBUG: 'true',
            },
            scope: 'project',
          },
        },
      };

      const result = Generator.generateMcpJson(config);

      expect(result.mcpServers['mcp-full']).toEqual({
        command: 'uvx',
        args: ['mcp-server-python-repl'],
        env: { DEBUG: 'true' },
      });
    });

    it('should return empty mcpServers object when no enabled MCPs exist', () => {
      const config: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {},
        mcp: {
          'disabled-only': {
            command: 'test',
            scope: 'project',
            enabled: false,
          },
        },
      };

      const result = Generator.generateMcpJson(config);

      expect(result.mcpServers).toEqual({});
      expect(Object.keys(result.mcpServers)).toHaveLength(0);
    });

    it('should return proper McpJson structure', () => {
      const config: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {},
        mcp: {
          'test-mcp': {
            command: 'test-cmd',
            scope: 'project',
          },
        },
      };

      const result = Generator.generateMcpJson(config);

      expect(result).toHaveProperty('mcpServers');
      expect(typeof result.mcpServers).toBe('object');
      expect(result.mcpServers).not.toBeNull();
    });

    it('should handle multiple MCPs with mixed configurations', () => {
      const config: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {},
        mcp: {
          'mcp1': {
            command: 'cmd1',
            args: ['arg1'],
            scope: 'project',
            enabled: true,
          },
          'mcp2': {
            command: 'cmd2',
            env: { VAR: 'value' },
            scope: 'global',
            enabled: true,
          },
          'mcp3': {
            command: 'cmd3',
            args: ['arg1', 'arg2'],
            env: { VAR1: 'value1', VAR2: 'value2' },
            scope: 'project',
            enabled: true,
          },
          'mcp4': {
            command: 'cmd4',
            scope: 'project',
            enabled: false,
          },
        },
      };

      const result = Generator.generateMcpJson(config);

      expect(Object.keys(result.mcpServers)).toHaveLength(3);
      expect(result.mcpServers['mcp1']).toHaveProperty('args');
      expect(result.mcpServers['mcp2']).toHaveProperty('env');
      expect(result.mcpServers['mcp3']).toHaveProperty('args');
      expect(result.mcpServers['mcp3']).toHaveProperty('env');
      expect(result.mcpServers).not.toHaveProperty('mcp4');
    });

    it('should default enabled to true when not specified', () => {
      const config: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {},
        mcp: {
          'mcp-default-enabled': {
            command: 'test-cmd',
            scope: 'project',
          },
        },
      };

      const result = Generator.generateMcpJson(config);

      expect(result.mcpServers).toHaveProperty('mcp-default-enabled');
    });
  });

  describe('generateClaudeMd', () => {
    it('should render template with correct template name', async () => {
      const mockTemplate = '# CLAUDE.md\nProject: test-project';
      (TemplateLoader.render as jest.Mock).mockResolvedValue(mockTemplate);

      const config: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {},
        mcp: {},
      };

      const result = await Generator.generateClaudeMd(config);

      expect(TemplateLoader.render).toHaveBeenCalledWith(
        'claude-md.hbs',
        expect.any(Object)
      );
      expect(result).toBe(mockTemplate);
    });

    it('should pass project data to template', async () => {
      const mockTemplate = 'rendered content';
      (TemplateLoader.render as jest.Mock).mockResolvedValue(mockTemplate);

      const config: OvertureConfig = {
        version: '1.0',
        project: {
          name: 'my-project',
          type: 'python-backend',
          description: 'Test project description',
        },
        plugins: {},
        mcp: {},
      };

      await Generator.generateClaudeMd(config);

      const callArgs = (TemplateLoader.render as jest.Mock).mock.calls[0][1];
      expect(callArgs).toHaveProperty('projectName', 'my-project');
      expect(callArgs).toHaveProperty('projectType', 'python-backend');
      expect(callArgs).toHaveProperty('projectDescription', 'Test project description');
    });

    it('should include all enabled plugins in template data', async () => {
      (TemplateLoader.render as jest.Mock).mockResolvedValue('rendered');

      const config: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {
          'python-development': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            mcps: ['python-repl', 'ruff'],
          },
          'nodejs-backend': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            mcps: ['nodejs-repl'],
          },
        },
        mcp: {},
      };

      await Generator.generateClaudeMd(config);

      const callArgs = (TemplateLoader.render as jest.Mock).mock.calls[0][1];
      expect(callArgs.plugins).toHaveLength(2);
      expect(callArgs.plugins).toContainEqual(
        expect.objectContaining({ name: 'python-development' })
      );
      expect(callArgs.plugins).toContainEqual(
        expect.objectContaining({ name: 'nodejs-backend' })
      );
    });

    it('should include all MCP servers in template data', async () => {
      (TemplateLoader.render as jest.Mock).mockResolvedValue('rendered');

      const config: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {},
        mcp: {
          'python-repl': {
            command: 'uvx',
            scope: 'project',
            enabled: true,
          },
          'ruff': {
            command: 'uvx',
            scope: 'project',
            enabled: true,
          },
        },
      };

      await Generator.generateClaudeMd(config);

      const callArgs = (TemplateLoader.render as jest.Mock).mock.calls[0][1];
      expect(callArgs.mcps).toHaveLength(2);
      expect(callArgs.mcps).toContainEqual(
        expect.objectContaining({ name: 'python-repl' })
      );
      expect(callArgs.mcps).toContainEqual(
        expect.objectContaining({ name: 'ruff' })
      );
    });

    it('should mark plugins as enabled in template data', async () => {
      (TemplateLoader.render as jest.Mock).mockResolvedValue('rendered');

      const config: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {
          'active-plugin': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            mcps: [],
          },
          'inactive-plugin': {
            marketplace: 'claude-code-workflows',
            enabled: false,
            mcps: [],
          },
        },
        mcp: {},
      };

      await Generator.generateClaudeMd(config);

      const callArgs = (TemplateLoader.render as jest.Mock).mock.calls[0][1];
      const activePlugin = callArgs.plugins.find((p: any) => p.name === 'active-plugin');
      const inactivePlugin = callArgs.plugins.find((p: any) => p.name === 'inactive-plugin');

      expect(activePlugin.enabled).toBe(true);
      expect(inactivePlugin.enabled).toBe(false);
    });

    it('should handle missing project name with default', async () => {
      (TemplateLoader.render as jest.Mock).mockResolvedValue('rendered');

      const config: OvertureConfig = {
        version: '1.0',
        plugins: {},
        mcp: {},
      };

      await Generator.generateClaudeMd(config);

      const callArgs = (TemplateLoader.render as jest.Mock).mock.calls[0][1];
      expect(callArgs.projectName).toBe('Project');
    });

    it('should return rendered template content', async () => {
      const expectedContent = '# CLAUDE.md\n\n## Project\n\nContent here';
      (TemplateLoader.render as jest.Mock).mockResolvedValue(expectedContent);

      const config: OvertureConfig = {
        version: '1.0',
        project: { name: 'test' },
        plugins: {},
        mcp: {},
      };

      const result = await Generator.generateClaudeMd(config);

      expect(result).toBe(expectedContent);
    });
  });

  describe('preserveCustomSections', () => {
    it('should return new content if no existing file exists', async () => {
      (FsUtils.exists as jest.Mock).mockResolvedValue(false);

      const newContent = '# New Content';
      const existingPath = '/path/to/CLAUDE.md';

      const result = await Generator.preserveCustomSections(newContent, existingPath);

      expect(result).toBe(newContent);
      expect(FsUtils.exists).toHaveBeenCalledWith(existingPath);
      expect(FsUtils.readFile).not.toHaveBeenCalled();
    });

    it('should preserve content after custom marker', async () => {
      const customMarker = '<!-- Custom sections below this comment will be preserved -->';
      const existingContent = `Generated content
${customMarker}
Custom section 1
Custom section 2`;

      (FsUtils.exists as jest.Mock).mockResolvedValue(true);
      (FsUtils.readFile as jest.Mock).mockResolvedValue(existingContent);

      const newContent = '# New Generated Content';
      const existingPath = '/path/to/CLAUDE.md';

      const result = await Generator.preserveCustomSections(newContent, existingPath);

      expect(result).toContain(newContent);
      expect(result).toContain('Custom section 1');
      expect(result).toContain('Custom section 2');
    });

    it('should append custom content with newlines', async () => {
      const customMarker = '<!-- Custom sections below this comment will be preserved -->';
      const customPart = '\nCustom content here';
      const existingContent = `Generated\n${customMarker}${customPart}`;

      (FsUtils.exists as jest.Mock).mockResolvedValue(true);
      (FsUtils.readFile as jest.Mock).mockResolvedValue(existingContent);

      const newContent = 'New generated content';
      const existingPath = '/path/to/CLAUDE.md';

      const result = await Generator.preserveCustomSections(newContent, existingPath);

      expect(result).toBe(newContent + '\n\n' + customPart);
    });

    it('should return new content if marker not found', async () => {
      const existingContent = 'Existing content without marker';

      (FsUtils.exists as jest.Mock).mockResolvedValue(true);
      (FsUtils.readFile as jest.Mock).mockResolvedValue(existingContent);

      const newContent = '# New Content';
      const existingPath = '/path/to/CLAUDE.md';

      const result = await Generator.preserveCustomSections(newContent, existingPath);

      expect(result).toBe(newContent);
    });

    it('should handle empty custom section', async () => {
      const customMarker = '<!-- Custom sections below this comment will be preserved -->';
      const existingContent = `Generated content\n${customMarker}`;

      (FsUtils.exists as jest.Mock).mockResolvedValue(true);
      (FsUtils.readFile as jest.Mock).mockResolvedValue(existingContent);

      const newContent = 'New generated content';
      const existingPath = '/path/to/CLAUDE.md';

      const result = await Generator.preserveCustomSections(newContent, existingPath);

      expect(result).toContain(newContent);
    });

    it('should preserve multi-line custom content', async () => {
      const customMarker = '<!-- Custom sections below this comment will be preserved -->';
      const customContent = `
## Custom Section
This is custom content that should be preserved.

### Subsection
More custom content here.`;

      const existingContent = `Generated content\n${customMarker}${customContent}`;

      (FsUtils.exists as jest.Mock).mockResolvedValue(true);
      (FsUtils.readFile as jest.Mock).mockResolvedValue(existingContent);

      const newContent = 'New content';
      const existingPath = '/path/to/CLAUDE.md';

      const result = await Generator.preserveCustomSections(newContent, existingPath);

      expect(result).toContain('Custom Section');
      expect(result).toContain('Subsection');
      expect(result).toContain('More custom content here.');
    });

    it('should call FsUtils.exists with correct path', async () => {
      (FsUtils.exists as jest.Mock).mockResolvedValue(false);

      const existingPath = '/custom/path/CLAUDE.md';
      await Generator.preserveCustomSections('new content', existingPath);

      expect(FsUtils.exists).toHaveBeenCalledWith(existingPath);
    });

    it('should call FsUtils.readFile with correct path when file exists', async () => {
      const existingPath = '/custom/path/CLAUDE.md';
      const customMarker = '<!-- Custom sections below this comment will be preserved -->';
      const existingContent = `Content\n${customMarker}\nCustom`;

      (FsUtils.exists as jest.Mock).mockResolvedValue(true);
      (FsUtils.readFile as jest.Mock).mockResolvedValue(existingContent);

      await Generator.preserveCustomSections('new content', existingPath);

      expect(FsUtils.readFile).toHaveBeenCalledWith(existingPath);
    });
  });

  describe('generateFiles', () => {
    it('should generate both .mcp.json and CLAUDE.md', async () => {
      const mockMcpJson = {
        mcpServers: {
          'test-mcp': {
            command: 'test-cmd',
          },
        },
      };
      const mockClaudeMd = '# CLAUDE.md';

      (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);
      (FsUtils.exists as jest.Mock).mockResolvedValue(false);
      jest.spyOn(Generator, 'generateMcpJson').mockReturnValue(mockMcpJson);
      jest.spyOn(Generator, 'generateClaudeMd').mockResolvedValue(mockClaudeMd);

      const config: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        plugins: {},
        mcp: {
          'test-mcp': {
            command: 'test-cmd',
            scope: 'project',
          },
        },
      };

      const outputDir = '/output';
      const result = await Generator.generateFiles(config, outputDir);

      expect(FsUtils.writeFile).toHaveBeenCalledTimes(2);
      expect(result.filesWritten).toHaveLength(2);
    });

    it('should write .mcp.json with 2-space indentation', async () => {
      (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);
      (FsUtils.exists as jest.Mock).mockResolvedValue(false);
      jest.spyOn(Generator, 'generateMcpJson').mockReturnValue({
        mcpServers: {
          'test-mcp': { command: 'test-cmd' },
        },
      });
      jest.spyOn(Generator, 'generateClaudeMd').mockResolvedValue('content');

      const config: OvertureConfig = {
        version: '1.0',
        project: { name: 'test' },
        plugins: {},
        mcp: {
          'test-mcp': {
            command: 'test-cmd',
            scope: 'project',
          },
        },
      };

      await Generator.generateFiles(config, '/output');

      const writeCall = (FsUtils.writeFile as jest.Mock).mock.calls[0];
      const mcpContent = writeCall[1];

      // Should have 2-space indentation
      expect(mcpContent).toContain('  "mcpServers"');
      expect(mcpContent).toContain('    "test-mcp"');
    });

    it('should write CLAUDE.md with preserved custom sections', async () => {
      const preservedContent = 'Generated CLAUDE.md with custom';
      (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);
      (FsUtils.exists as jest.Mock).mockResolvedValue(false);
      jest.spyOn(Generator, 'generateMcpJson').mockReturnValue({
        mcpServers: {},
      });
      jest.spyOn(Generator, 'generateClaudeMd').mockResolvedValue('Generated CLAUDE.md');
      jest.spyOn(Generator, 'preserveCustomSections').mockResolvedValue(preservedContent);

      const config: OvertureConfig = {
        version: '1.0',
        project: { name: 'test' },
        plugins: {},
        mcp: {},
      };

      const outputDir = '/output';
      await Generator.generateFiles(config, outputDir);

      const claudeMdPath = path.join(outputDir, 'CLAUDE.md');
      expect(Generator.preserveCustomSections).toHaveBeenCalledWith(
        'Generated CLAUDE.md',
        claudeMdPath
      );

      const claudeMdWrite = (FsUtils.writeFile as jest.Mock).mock.calls[1];
      expect(claudeMdWrite[0]).toBe(claudeMdPath);
      expect(claudeMdWrite[1]).toBe(preservedContent);
    });

    it('should return GeneratorResult with correct structure', async () => {
      const mockMcpJson = {
        mcpServers: { 'test-mcp': { command: 'test' } },
      };
      const mockClaudeMd = '# CLAUDE.md';

      (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);
      (FsUtils.exists as jest.Mock).mockResolvedValue(false);
      jest.spyOn(Generator, 'generateMcpJson').mockReturnValue(mockMcpJson);
      jest.spyOn(Generator, 'generateClaudeMd').mockResolvedValue(mockClaudeMd);
      jest.spyOn(Generator, 'preserveCustomSections').mockResolvedValue(mockClaudeMd);

      const config: OvertureConfig = {
        version: '1.0',
        project: { name: 'test' },
        plugins: {},
        mcp: {
          'test-mcp': {
            command: 'test',
            scope: 'project',
          },
        },
      };

      const result = await Generator.generateFiles(config, '/output');

      expect(result).toHaveProperty('mcpJson');
      expect(result).toHaveProperty('claudeMd');
      expect(result).toHaveProperty('filesWritten');
      expect(result.mcpJson).toEqual(mockMcpJson);
      expect(result.claudeMd).toBe(mockClaudeMd);
    });

    it('should return filesWritten with correct paths', async () => {
      (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);
      (FsUtils.exists as jest.Mock).mockResolvedValue(false);
      jest.spyOn(Generator, 'generateMcpJson').mockReturnValue({ mcpServers: {} });
      jest.spyOn(Generator, 'generateClaudeMd').mockResolvedValue('content');

      const outputDir = '/custom/output';
      const config: OvertureConfig = {
        version: '1.0',
        project: { name: 'test' },
        plugins: {},
        mcp: {},
      };

      const result = await Generator.generateFiles(config, outputDir);

      expect(result.filesWritten).toContain(path.join(outputDir, '.mcp.json'));
      expect(result.filesWritten).toContain(path.join(outputDir, 'CLAUDE.md'));
    });

    it('should use process.cwd() as default output directory', async () => {
      (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);
      (FsUtils.exists as jest.Mock).mockResolvedValue(false);
      jest.spyOn(Generator, 'generateMcpJson').mockReturnValue({ mcpServers: {} });
      jest.spyOn(Generator, 'generateClaudeMd').mockResolvedValue('content');

      const config: OvertureConfig = {
        version: '1.0',
        project: { name: 'test' },
        plugins: {},
        mcp: {},
      };

      const result = await Generator.generateFiles(config);

      const expectedDir = process.cwd();
      expect(result.filesWritten[0]).toContain(expectedDir);
      expect(result.filesWritten[1]).toContain(expectedDir);
    });

    it('should log info message at start', async () => {
      (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);
      (FsUtils.exists as jest.Mock).mockResolvedValue(false);
      jest.spyOn(Generator, 'generateMcpJson').mockReturnValue({ mcpServers: {} });
      jest.spyOn(Generator, 'generateClaudeMd').mockResolvedValue('content');

      const config: OvertureConfig = {
        version: '1.0',
        project: { name: 'test' },
        plugins: {},
        mcp: {},
      };

      await Generator.generateFiles(config);

      expect(Logger.info).toHaveBeenCalledWith('Generating configuration files...');
    });

    it('should log success messages for generated files', async () => {
      (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);
      (FsUtils.exists as jest.Mock).mockResolvedValue(false);
      jest.spyOn(Generator, 'generateMcpJson').mockReturnValue({ mcpServers: {} });
      jest.spyOn(Generator, 'generateClaudeMd').mockResolvedValue('content');

      const config: OvertureConfig = {
        version: '1.0',
        project: { name: 'test' },
        plugins: {},
        mcp: {},
      };

      await Generator.generateFiles(config);

      expect(Logger.success).toHaveBeenCalledWith(
        expect.stringContaining('.mcp.json')
      );
      expect(Logger.success).toHaveBeenCalledWith(
        expect.stringContaining('CLAUDE.md')
      );
      expect(Logger.success).toHaveBeenCalledTimes(2);
    });

    it('should construct paths in correct output directory', async () => {
      (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);
      (FsUtils.exists as jest.Mock).mockResolvedValue(false);
      jest.spyOn(Generator, 'generateMcpJson').mockReturnValue({ mcpServers: {} });
      jest.spyOn(Generator, 'generateClaudeMd').mockResolvedValue('content');

      const outputDir = '/custom/path/to/output';
      const config: OvertureConfig = {
        version: '1.0',
        project: { name: 'test' },
        plugins: {},
        mcp: {},
      };

      const result = await Generator.generateFiles(config, outputDir);

      expect(result.filesWritten[0]).toBe(path.join(outputDir, '.mcp.json'));
      expect(result.filesWritten[1]).toBe(path.join(outputDir, 'CLAUDE.md'));
    });

    it('should handle complex configuration with multiple MCPs and plugins', async () => {
      (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);
      (FsUtils.exists as jest.Mock).mockResolvedValue(false);

      const mockMcpJson = {
        mcpServers: {
          'python-repl': { command: 'uvx', args: ['mcp-server-python-repl'] },
          'ruff': { command: 'uvx', args: ['mcp-server-ruff'] },
        },
      };

      jest.spyOn(Generator, 'generateMcpJson').mockReturnValue(mockMcpJson);
      jest.spyOn(Generator, 'generateClaudeMd').mockResolvedValue('# CLAUDE.md');

      const config: OvertureConfig = {
        version: '1.0',
        project: {
          name: 'complex-project',
          type: 'python-backend',
          description: 'A complex test project',
        },
        plugins: {
          'python-development': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            mcps: ['python-repl', 'ruff'],
          },
        },
        mcp: {
          'python-repl': {
            command: 'uvx',
            args: ['mcp-server-python-repl'],
            scope: 'project',
            enabled: true,
          },
          'ruff': {
            command: 'uvx',
            args: ['mcp-server-ruff'],
            scope: 'project',
            enabled: true,
          },
        },
      };

      const result = await Generator.generateFiles(config, '/output');

      expect(result.mcpJson).toEqual(mockMcpJson);
      expect(result.filesWritten).toHaveLength(2);
      expect(Logger.success).toHaveBeenCalledTimes(2);
    });
  });

  describe('integration scenarios', () => {
    it('should generate files from valid config', async () => {
      (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);
      (FsUtils.exists as jest.Mock).mockResolvedValue(false);

      const config: OvertureConfig = {
        version: '1.0',
        project: { name: 'test-project', type: 'python-backend' },
        plugins: {
          'python-development': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            mcps: ['python-repl', 'ruff'],
          },
        },
        mcp: {
          'python-repl': {
            command: 'uvx',
            args: ['mcp-server-python-repl'],
            scope: 'project',
          },
          'ruff': {
            command: 'uvx',
            args: ['mcp-server-ruff'],
            scope: 'project',
          },
        },
      };

      // Use real methods for integration
      jest.spyOn(Generator, 'generateClaudeMd').mockResolvedValue('# Generated CLAUDE.md');

      const result = await Generator.generateFiles(config, '/test-output');

      expect(result).toHaveProperty('mcpJson');
      expect(result).toHaveProperty('claudeMd');
      expect(result).toHaveProperty('filesWritten');
      expect(result.filesWritten).toHaveLength(2);
    });

    it('should preserve existing custom sections when regenerating', async () => {
      const customMarker = '<!-- Custom sections below this comment will be preserved -->';
      const existingClaudeMd = `Generated content
${customMarker}
## Custom Documentation
This is custom user content.`;
      const expectedPreservedContent = '# New Generated Content\n\n## Custom Documentation\nThis is custom user content.';

      (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);
      (FsUtils.exists as jest.Mock).mockResolvedValue(true);
      (FsUtils.readFile as jest.Mock).mockResolvedValue(existingClaudeMd);

      jest.spyOn(Generator, 'generateMcpJson').mockReturnValue({ mcpServers: {} });
      jest.spyOn(Generator, 'generateClaudeMd').mockResolvedValue('# New Generated Content');
      jest.spyOn(Generator, 'preserveCustomSections').mockResolvedValue(expectedPreservedContent);

      const config: OvertureConfig = {
        version: '1.0',
        project: { name: 'test' },
        plugins: {},
        mcp: {},
      };

      const result = await Generator.generateFiles(config, '/output');

      expect(result.claudeMd).toContain('New Generated Content');
      expect(result.claudeMd).toContain('Custom Documentation');
    });
  });
});
