import inquirer from 'inquirer';

/**
 * User interaction prompts using inquirer.
 * Provides consistent interfaces for confirmation, selection, and text input.
 */
export class Prompts {
  /**
   * Prompt the user for a yes/no confirmation.
   * @param message - The question to ask
   * @param defaultValue - The default value (default: true)
   * @returns Promise resolving to the user's choice
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
   */
  static async select<T extends string>(
    message: string,
    choices: Array<{ name: string; value: T }>
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
   */
  static async multiSelect<T extends string>(
    message: string,
    choices: Array<{ name: string; value: T; checked?: boolean }>
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
   */
  static async input(
    message: string,
    defaultValue?: string
  ): Promise<string> {
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
