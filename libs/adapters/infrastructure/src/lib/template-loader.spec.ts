import type { Mock, Mocked, MockedObject, MockedFunction, MockInstance } from 'vitest';
import * as Handlebars from 'handlebars';
import * as path from 'path';
import { TemplateLoader } from './template-loader';
import { FsUtils } from './fs-utils';
import { ConfigError } from '@overture/errors';

// Mock FsUtils
vi.mock('./fs-utils', () => ({
  FsUtils: {
    readFile: vi.fn(),
  },
}));

describe('TemplateLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerHelpers', () => {
    it('should register json helper on module load', () => {
      expect((Handlebars as any).helpers.json).toBeDefined();
    });

    it('should register yaml helper on module load', () => {
      expect((Handlebars as any).helpers.yaml).toBeDefined();
    });

    it('json helper should stringify object with 2-space indent', () => {
      const jsonHelper = (Handlebars as any).helpers.json;
      const testObj = { name: 'test', value: 42 };
      const result = jsonHelper(testObj).string;
      const expected = JSON.stringify(testObj, null, 2);
      expect(result).toBe(expected);
      expect(result).toContain('"name": "test"');
      expect(result).toContain('"value": 42');
    });

    it('json helper should format nested objects with proper indentation', () => {
      const jsonHelper = (Handlebars as any).helpers.json;
      const testObj = {
        project: {
          name: 'my-app',
          plugins: ['plugin1', 'plugin2'],
        },
      };
      const result = jsonHelper(testObj).string;
      const expected = JSON.stringify(testObj, null, 2);
      expect(result).toBe(expected);
      expect(result).toContain('  "project"');
      expect(result).toContain('    "name"');
    });

    it('yaml helper should stringify object with 2-space indent', () => {
      const yamlHelper = (Handlebars as any).helpers.yaml;
      const testObj = { name: 'test', value: 42 };
      const result = yamlHelper(testObj).string;
      expect(result).toBe(JSON.stringify(testObj, null, 2));
    });

    it('should handle null values in json helper', () => {
      const jsonHelper = (Handlebars as any).helpers.json;
      const result = jsonHelper(null).string;
      expect(result).toBe('null');
    });

    it('should handle arrays in json helper', () => {
      const jsonHelper = (Handlebars as any).helpers.json;
      const testArray = ['item1', 'item2', 'item3'];
      const result = jsonHelper(testArray).string;
      expect(result).toBe(JSON.stringify(testArray, null, 2));
    });
  });

  describe('render', () => {
    it('should render template with simple variable substitution', async () => {
      const templateContent = 'Hello {{name}}!';
      const data = { name: 'World' };

      (FsUtils.readFile as Mock).mockResolvedValue(templateContent);

      const result = await TemplateLoader.render('greeting.hbs', data);

      expect(result).toBe('Hello World!');
      expect(FsUtils.readFile).toHaveBeenCalledWith(
        expect.stringContaining('greeting.hbs')
      );
    });

    it('should render template with multiple variables', async () => {
      const templateContent =
        'Project {{projectName}} with type {{projectType}}';
      const data = { projectName: 'my-app', projectType: 'backend' };

      (FsUtils.readFile as Mock).mockResolvedValue(templateContent);

      const result = await TemplateLoader.render('config.hbs', data);

      expect(result).toBe('Project my-app with type backend');
    });

    it('should render template with conditional blocks (if true)', async () => {
      const templateContent =
        '{{#if enabled}}Feature is enabled{{else}}Feature is disabled{{/if}}';
      const data = { enabled: true };

      (FsUtils.readFile as Mock).mockResolvedValue(templateContent);

      const result = await TemplateLoader.render('feature.hbs', data);

      expect(result).toBe('Feature is enabled');
    });

    it('should render template with conditional blocks (if false)', async () => {
      const templateContent =
        '{{#if enabled}}Feature is enabled{{else}}Feature is disabled{{/if}}';
      const data = { enabled: false };

      (FsUtils.readFile as Mock).mockResolvedValue(templateContent);

      const result = await TemplateLoader.render('feature.hbs', data);

      expect(result).toBe('Feature is disabled');
    });

    it('should render template with loops (each)', async () => {
      const templateContent =
        'Plugins: {{#each plugins}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}';
      const data = { plugins: ['auth', 'logging', 'cache'] };

      (FsUtils.readFile as Mock).mockResolvedValue(templateContent);

      const result = await TemplateLoader.render('plugins.hbs', data);

      expect(result).toBe('Plugins: auth, logging, cache');
    });

    it('should render template with nested object iteration', async () => {
      const templateContent =
        '{{#each items}}Item: {{name}} ({{value}}\n{{/each}}';
      const data = {
        items: [
          { name: 'first', value: 1 },
          { name: 'second', value: 2 },
        ],
      };

      (FsUtils.readFile as Mock).mockResolvedValue(templateContent);

      const result = await TemplateLoader.render('items.hbs', data);

      expect(result).toContain('Item: first (1');
      expect(result).toContain('Item: second (2');
    });

    it('should render template using custom json helper', async () => {
      const templateContent = '{{{json data}}}';
      const data = {
        data: { key: 'value', nested: { prop: 42 } },
      };

      (FsUtils.readFile as Mock).mockResolvedValue(templateContent);

      const result = await TemplateLoader.render('json-data.hbs', data);

      const expectedJson = JSON.stringify(data.data, null, 2);
      expect(result).toBe(expectedJson);
    });

    it('should render template using custom yaml helper', async () => {
      const templateContent = '{{{yaml config}}}';
      const data = {
        config: { environment: 'production', debug: false },
      };

      (FsUtils.readFile as Mock).mockResolvedValue(templateContent);

      const result = await TemplateLoader.render('yaml-config.hbs', data);

      const expectedYaml = JSON.stringify(data.config, null, 2);
      expect(result).toBe(expectedYaml);
    });

    it('should construct template path correctly', async () => {
      const templateContent = 'Test content';
      (FsUtils.readFile as Mock).mockResolvedValue(templateContent);

      await TemplateLoader.render('my-template.hbs', {});

      const callArgs = (FsUtils.readFile as Mock).mock.calls[0][0];
      expect(callArgs).toContain('my-template.hbs');
      expect(callArgs).toContain('templates');
      expect(callArgs).toContain('assets');
    });

    it('should handle missing template file error from FsUtils', async () => {
      const error = new ConfigError('ENOENT: no such file', 'missing.hbs');
      (FsUtils.readFile as Mock).mockRejectedValue(error);

      await expect(
        TemplateLoader.render('missing.hbs', {})
      ).rejects.toThrow(ConfigError);
      await expect(
        TemplateLoader.render('missing.hbs', {})
      ).rejects.toThrow('ENOENT');
    });

    it('should handle empty template', async () => {
      const templateContent = '';
      (FsUtils.readFile as Mock).mockResolvedValue(templateContent);

      const result = await TemplateLoader.render('empty.hbs', {});

      expect(result).toBe('');
    });

    it('should handle template with no variables or data', async () => {
      const templateContent = 'Static content here';
      (FsUtils.readFile as Mock).mockResolvedValue(templateContent);

      const result = await TemplateLoader.render('static.hbs', {});

      expect(result).toBe('Static content here');
    });

    it('should handle complex template with multiple patterns', async () => {
      const templateContent = `Project: {{projectName}}
Type: {{projectType}}
{{#if hasPlugins}}Plugins:
{{#each plugins}}- {{this}}
{{/each}}{{/if}}Config:
{{json config}}`;
      const data = {
        projectName: 'my-api',
        projectType: 'backend',
        hasPlugins: true,
        plugins: ['auth', 'logging'],
        config: { port: 3000, env: 'dev' },
      };

      (FsUtils.readFile as Mock).mockResolvedValue(templateContent);

      const result = await TemplateLoader.render('complex.hbs', data);

      expect(result).toContain('Project: my-api');
      expect(result).toContain('Type: backend');
      expect(result).toContain('- auth');
      expect(result).toContain('- logging');
      expect(result).toContain('"port": 3000');
    });

    it('should handle undefined data properties gracefully', async () => {
      const templateContent = '{{#if missing}}exists{{else}}missing{{/if}}';
      const data = {};

      (FsUtils.readFile as Mock).mockResolvedValue(templateContent);

      const result = await TemplateLoader.render('undefined.hbs', data);

      expect(result).toBe('missing');
    });
  });
});
