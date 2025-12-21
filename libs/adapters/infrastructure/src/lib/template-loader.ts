import * as Handlebars from 'handlebars';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { FsUtils } from './fs-utils.js';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class TemplateLoader {
  private static templateDir = path.join(
    __dirname,
    '..',
    'assets',
    'templates',
  );

  /**
   * Render template with data
   */
  static async render(
    templateName: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    const templatePath = path.join(this.templateDir, templateName);
    const templateContent = await FsUtils.readFile(templatePath);
    const template = Handlebars.compile(templateContent);
    return template(data);
  }

  /**
   * Register custom Handlebars helpers
   */
  static registerHelpers(): void {
    Handlebars.registerHelper('json', (context) => {
      return new Handlebars.SafeString(JSON.stringify(context, null, 2));
    });

    Handlebars.registerHelper('yaml', (context) => {
      // Simple YAML serialization (or use js-yaml)
      return new Handlebars.SafeString(JSON.stringify(context, null, 2));
    });

    Handlebars.registerHelper('eq', (a, b) => {
      return a === b;
    });
  }
}

// Register helpers on module load
// NOTE: Disabled to avoid ESM/CJS compatibility issues
// Call manually if needed: TemplateLoader.registerHelpers();
// TemplateLoader.registerHelpers();
