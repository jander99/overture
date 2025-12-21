/**
 * User Interaction Prompts
 *
 * Provides consistent interfaces for confirmation, selection, and text input
 * using inquirer.
 *
 * @module @overture/utils/prompts
 */

import inquirer from 'inquirer';

/**
 * User interaction prompts using inquirer.
 * Provides consistent interfaces for confirmation, selection, and text input.
 *
 * @example
 * ```typescript
 * // Confirmation prompt
 * const confirmed = await Prompts.confirm('Continue?');
 *
 * // Selection prompt
 * const choice = await Prompts.select('Choose option:', [
 *   { name: 'Option A', value: 'a' },
 *   { name: 'Option B', value: 'b' }
 * ]);
 *
 * // Text input prompt
 * const name = await Prompts.input('Enter name:', 'default');
 * ```
 */
export class Prompts {
  /**
   * Prompt the user for a yes/no confirmation.
   * @param message - The question to ask
   * @param defaultValue - The default value (default: true)
   * @returns Promise resolving to the user's choice
   *
   * @example
   * ```typescript
   * const proceed = await Prompts.confirm('Continue with operation?');
   * if (proceed) {
   *   // User confirmed
   * }
   * ```
   */
  static async confirm(message: string, defaultValue = true): Promise<boolean> {
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message,
        default: defaultValue,
      },
    ]);
    return confirmed;
  }

  /**
   * Prompt the user to select one option from a list.
   * @param message - The question to ask
   * @param choices - Array of choices with name and value
   * @returns Promise resolving to the selected value
   *
   * @example
   * ```typescript
   * const projectType = await Prompts.select('Select project type:', [
   *   { name: 'Python Backend', value: 'python-backend' },
   *   { name: 'Node API', value: 'node-api' },
   *   { name: 'TypeScript Tooling', value: 'typescript-tooling' }
   * ]);
   * ```
   */
  static async select<T extends string>(
    message: string,
    choices: Array<{ name: string; value: T }>,
  ): Promise<T> {
    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message,
        choices,
      },
    ]);
    return selected;
  }

  /**
   * Prompt the user to select multiple options from a list.
   * @param message - The question to ask
   * @param choices - Array of choices with name, value, and optional checked state
   * @returns Promise resolving to an array of selected values
   *
   * @example
   * ```typescript
   * const clients = await Prompts.multiSelect('Select clients to configure:', [
   *   { name: 'Claude Code', value: 'claude-code', checked: true },
   *   { name: 'Cursor', value: 'cursor' },
   *   { name: 'VS Code', value: 'vscode' }
   * ]);
   * ```
   */
  static async multiSelect<T extends string>(
    message: string,
    choices: Array<{ name: string; value: T; checked?: boolean }>,
  ): Promise<T[]> {
    const { selected } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selected',
        message,
        choices,
      },
    ]);
    return selected;
  }

  /**
   * Prompt the user for text input.
   * @param message - The question to ask
   * @param defaultValue - Optional default value
   * @returns Promise resolving to the user's input
   *
   * @example
   * ```typescript
   * const projectName = await Prompts.input('Project name:', 'my-project');
   * ```
   */
  static async input(message: string, defaultValue?: string): Promise<string> {
    const { value } = await inquirer.prompt([
      {
        type: 'input',
        name: 'value',
        message,
        default: defaultValue,
      },
    ]);
    return value;
  }
}
