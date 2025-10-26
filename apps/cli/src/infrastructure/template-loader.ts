import * as Handlebars from 'handlebars';
import * as path from 'path';
import { FsUtils } from './fs-utils';

export class TemplateLoader {
  private static templateDir = path.join(__dirname, '..', 'assets', 'templates');

  /**
   * Render template with data
   */
  static async render(
    templateName: string,
    data: Record<string, unknown>
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
      return JSON.stringify(context, null, 2);
    });

    Handlebars.registerHelper('yaml', (context) => {
      // Simple YAML serialization (or use js-yaml)
      return JSON.stringify(context, null, 2);
    });
  }
}

// Register helpers on module load
TemplateLoader.registerHelpers();
