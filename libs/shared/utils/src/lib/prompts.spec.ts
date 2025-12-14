/**
 * Prompts Tests
 *
 * @module @overture/utils/prompts.spec
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Prompts } from './prompts.js';
import inquirer from 'inquirer';

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

describe('Prompts', () => {
  const mockPrompt = vi.mocked(inquirer.prompt);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('confirm', () => {
    it('should return true when user confirms', async () => {
      mockPrompt.mockResolvedValueOnce({ confirmed: true });

      const result = await Prompts.confirm('Continue?');

      expect(result).toBe(true);
      expect(mockPrompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'confirm',
          name: 'confirmed',
          message: 'Continue?',
          default: true,
        }),
      ]);
    });

    it('should return false when user declines', async () => {
      mockPrompt.mockResolvedValueOnce({ confirmed: false });

      const result = await Prompts.confirm('Continue?');

      expect(result).toBe(false);
    });

    it('should use custom default value', async () => {
      mockPrompt.mockResolvedValueOnce({ confirmed: false });

      await Prompts.confirm('Continue?', false);

      expect(mockPrompt).toHaveBeenCalledWith([
        expect.objectContaining({
          default: false,
        }),
      ]);
    });
  });

  describe('select', () => {
    it('should return selected value', async () => {
      mockPrompt.mockResolvedValueOnce({ selected: 'option-a' });

      const result = await Prompts.select('Choose:', [
        { name: 'Option A', value: 'option-a' },
        { name: 'Option B', value: 'option-b' },
      ]);

      expect(result).toBe('option-a');
      expect(mockPrompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'list',
          name: 'selected',
          message: 'Choose:',
          choices: [
            { name: 'Option A', value: 'option-a' },
            { name: 'Option B', value: 'option-b' },
          ],
        }),
      ]);
    });

    it('should handle different value types', async () => {
      type ProjectType = 'python-backend' | 'node-api' | 'typescript-tooling';
      mockPrompt.mockResolvedValueOnce({ selected: 'python-backend' });

      const result = await Prompts.select<ProjectType>('Select project type:', [
        { name: 'Python Backend', value: 'python-backend' },
        { name: 'Node API', value: 'node-api' },
        { name: 'TypeScript Tooling', value: 'typescript-tooling' },
      ]);

      expect(result).toBe('python-backend');
    });
  });

  describe('multiSelect', () => {
    it('should return array of selected values', async () => {
      mockPrompt.mockResolvedValueOnce({
        selected: ['option-a', 'option-c'],
      });

      const result = await Prompts.multiSelect('Choose multiple:', [
        { name: 'Option A', value: 'option-a', checked: true },
        { name: 'Option B', value: 'option-b' },
        { name: 'Option C', value: 'option-c', checked: true },
      ]);

      expect(result).toEqual(['option-a', 'option-c']);
      expect(mockPrompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'checkbox',
          name: 'selected',
          message: 'Choose multiple:',
          choices: [
            { name: 'Option A', value: 'option-a', checked: true },
            { name: 'Option B', value: 'option-b' },
            { name: 'Option C', value: 'option-c', checked: true },
          ],
        }),
      ]);
    });

    it('should return empty array when nothing selected', async () => {
      mockPrompt.mockResolvedValueOnce({ selected: [] });

      const result = await Prompts.multiSelect('Choose:', [
        { name: 'Option A', value: 'option-a' },
      ]);

      expect(result).toEqual([]);
    });
  });

  describe('input', () => {
    it('should return user input', async () => {
      mockPrompt.mockResolvedValueOnce({ value: 'my-project' });

      const result = await Prompts.input('Project name:');

      expect(result).toBe('my-project');
      expect(mockPrompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'input',
          name: 'value',
          message: 'Project name:',
          default: undefined,
        }),
      ]);
    });

    it('should use default value', async () => {
      mockPrompt.mockResolvedValueOnce({ value: 'default-name' });

      await Prompts.input('Project name:', 'default-name');

      expect(mockPrompt).toHaveBeenCalledWith([
        expect.objectContaining({
          default: 'default-name',
        }),
      ]);
    });

    it('should return empty string when user provides empty input', async () => {
      mockPrompt.mockResolvedValueOnce({ value: '' });

      const result = await Prompts.input('Project name:');

      expect(result).toBe('');
    });
  });
});
