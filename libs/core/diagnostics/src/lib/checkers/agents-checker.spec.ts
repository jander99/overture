/**
 * AgentsChecker Tests
 *
 * @module checkers/agents-checker.spec
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mocked } from 'vitest';
import type { FilesystemPort } from '@overture/ports-filesystem';
import { AgentsChecker } from './agents-checker.js';

describe('AgentsChecker', () => {
  let mockFilesystem: Mocked<FilesystemPort>;
  let checker: AgentsChecker;

  beforeEach(() => {
    mockFilesystem = {
      exists: vi.fn(),
      readFile: vi.fn(),
      readdir: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      stat: vi.fn(),
      rm: vi.fn(),
    };

    checker = new AgentsChecker(mockFilesystem);
  });

  describe('checkAgents', () => {
    it('should return default result when config repo does not exist', async () => {
      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        false,
        null,
      );

      expect(result).toEqual({
        globalAgentsPath: '/home/user/.config/overture/agents',
        globalAgentsDirExists: false,
        globalAgentCount: 0,
        globalAgentErrors: [],
        projectAgentsPath: null,
        projectAgentsDirExists: false,
        projectAgentCount: 0,
        projectAgentErrors: [],
        modelsConfigPath: '/home/user/.config/overture/models.yaml',
        modelsConfigExists: false,
        modelsConfigValid: false,
        modelsConfigError: null,
      });

      expect(mockFilesystem.exists).not.toHaveBeenCalled();
    });

    it('should check global agents only when no project root provided', async () => {
      mockFilesystem.exists.mockResolvedValue(true);
      mockFilesystem.readdir.mockResolvedValue(['agent1.yaml', 'agent1.md']);
      mockFilesystem.readFile.mockResolvedValue('name: TestAgent');

      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        true,
        null,
      );

      expect(result.globalAgentsDirExists).toBe(true);
      expect(result.globalAgentCount).toBe(1);
      expect(result.globalAgentErrors).toEqual([]);
      expect(result.projectAgentsPath).toBeNull();
      expect(result.projectAgentsDirExists).toBe(false);
      expect(result.projectAgentCount).toBe(0);
    });

    it('should check both global and project agents when project root provided', async () => {
      mockFilesystem.exists.mockResolvedValue(true);
      mockFilesystem.readdir.mockImplementation(async (path: string) => {
        if (path.includes('/home/user/.config/overture/agents')) {
          return ['global-agent.yaml', 'global-agent.md'];
        }
        if (path.includes('/project/.overture/agents')) {
          return ['project-agent.yaml', 'project-agent.md'];
        }
        return [];
      });
      mockFilesystem.readFile.mockResolvedValue('name: TestAgent');

      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        true,
        '/project',
      );

      expect(result.globalAgentCount).toBe(1);
      expect(result.projectAgentsPath).toBe('/project/.overture/agents');
      expect(result.projectAgentsDirExists).toBe(true);
      expect(result.projectAgentCount).toBe(1);
      expect(result.projectAgentErrors).toEqual([]);
    });

    it('should handle project agents directory not existing', async () => {
      mockFilesystem.exists.mockImplementation(async (path: string) => {
        if (path.includes('/project/.overture/agents')) {
          return false;
        }
        return true;
      });
      mockFilesystem.readdir.mockResolvedValue(['agent.yaml', 'agent.md']);
      mockFilesystem.readFile.mockResolvedValue('name: TestAgent');

      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        true,
        '/project',
      );

      expect(result.projectAgentsDirExists).toBe(false);
      expect(result.projectAgentCount).toBe(0);
      expect(result.projectAgentErrors).toEqual([]);
    });

    it('should validate models.yaml when it exists and is valid', async () => {
      mockFilesystem.exists.mockImplementation(async (path: string) => {
        if (path.includes('models.yaml')) {
          return true;
        }
        if (path.includes('/agents')) {
          return false;
        }
        return false;
      });
      mockFilesystem.readFile.mockResolvedValue('default_model: claude-3-opus');

      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        true,
        null,
      );

      expect(result.modelsConfigExists).toBe(true);
      expect(result.modelsConfigValid).toBe(true);
      expect(result.modelsConfigError).toBeNull();
    });

    it('should detect invalid models.yaml (not an object)', async () => {
      mockFilesystem.exists.mockImplementation(async (path: string) => {
        if (path.includes('models.yaml')) {
          return true;
        }
        if (path.includes('/agents')) {
          return false;
        }
        return false;
      });
      mockFilesystem.readFile.mockResolvedValue('- item1\n- item2');

      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        true,
        null,
      );

      expect(result.modelsConfigExists).toBe(true);
      expect(result.modelsConfigValid).toBe(false);
      expect(result.modelsConfigError).toBe(
        'models.yaml must contain a YAML object',
      );
    });

    it('should detect invalid models.yaml (parse error)', async () => {
      mockFilesystem.exists.mockImplementation(async (path: string) => {
        if (path.includes('models.yaml')) {
          return true;
        }
        if (path.includes('/agents')) {
          return false;
        }
        return false;
      });
      mockFilesystem.readFile.mockResolvedValue('invalid: yaml: content:');

      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        true,
        null,
      );

      expect(result.modelsConfigExists).toBe(true);
      expect(result.modelsConfigValid).toBe(false);
      expect(result.modelsConfigError).toBeTruthy();
    });
  });

  describe('validateAgents', () => {
    it('should return empty result when agents directory does not exist', async () => {
      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        true,
        null,
      );

      mockFilesystem.exists.mockResolvedValue(false);

      expect(result.globalAgentCount).toBe(0);
      expect(result.globalAgentErrors).toEqual([]);
    });

    it('should successfully validate agent with valid YAML and MD pair', async () => {
      mockFilesystem.exists.mockResolvedValue(true);
      mockFilesystem.readdir.mockResolvedValue(['test-agent.yaml']);
      mockFilesystem.readFile.mockResolvedValue(
        'name: TestAgent\ndescription: A test agent',
      );

      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        true,
        null,
      );

      expect(result.globalAgentCount).toBe(1);
      expect(result.globalAgentErrors).toEqual([]);
    });

    it('should detect missing MD file', async () => {
      mockFilesystem.exists.mockImplementation(async (path: string) => {
        if (path.endsWith('.md')) {
          return false;
        }
        return true;
      });
      mockFilesystem.readdir.mockResolvedValue(['test-agent.yaml']);

      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        true,
        null,
      );

      expect(result.globalAgentCount).toBe(0);
      expect(result.globalAgentErrors).toContain(
        'test-agent.yaml: Missing corresponding test-agent.md file',
      );
    });

    it('should detect invalid YAML structure (not an object)', async () => {
      mockFilesystem.exists.mockResolvedValue(true);
      mockFilesystem.readdir.mockResolvedValue(['test-agent.yaml']);
      mockFilesystem.readFile.mockResolvedValue('- item1\n- item2');

      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        true,
        null,
      );

      expect(result.globalAgentCount).toBe(0);
      expect(result.globalAgentErrors).toContain(
        'test-agent.yaml: Invalid YAML structure',
      );
    });

    it('should detect missing name field in YAML', async () => {
      mockFilesystem.exists.mockResolvedValue(true);
      mockFilesystem.readdir.mockResolvedValue(['test-agent.yaml']);
      mockFilesystem.readFile.mockResolvedValue('description: No name field');

      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        true,
        null,
      );

      expect(result.globalAgentCount).toBe(0);
      expect(result.globalAgentErrors).toContain(
        "test-agent.yaml: Missing required 'name' field",
      );
    });

    it('should handle YAML parse errors gracefully', async () => {
      mockFilesystem.exists.mockResolvedValue(true);
      mockFilesystem.readdir.mockResolvedValue(['test-agent.yaml']);
      mockFilesystem.readFile.mockResolvedValue('invalid: yaml: content:');

      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        true,
        null,
      );

      expect(result.globalAgentCount).toBe(0);
      expect(result.globalAgentErrors.length).toBeGreaterThan(0);
      expect(result.globalAgentErrors[0]).toContain('test-agent.yaml:');
    });

    it('should process multiple agent files', async () => {
      mockFilesystem.exists.mockResolvedValue(true);
      mockFilesystem.readdir.mockResolvedValue([
        'agent1.yaml',
        'agent1.md',
        'agent2.yaml',
        'agent2.md',
        'agent3.yml',
        'agent3.md',
      ]);
      mockFilesystem.readFile.mockImplementation(async (path: string) => {
        if (path.includes('agent1')) {
          return 'name: Agent1';
        }
        if (path.includes('agent2')) {
          return 'name: Agent2';
        }
        if (path.includes('agent3')) {
          return 'name: Agent3';
        }
        return '';
      });

      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        true,
        null,
      );

      expect(result.globalAgentCount).toBe(3);
      expect(result.globalAgentErrors).toEqual([]);
    });

    it('should handle both .yaml and .yml extensions', async () => {
      mockFilesystem.exists.mockResolvedValue(true);
      mockFilesystem.readdir.mockResolvedValue([
        'agent1.yaml',
        'agent2.yml',
        'agent1.md',
        'agent2.md',
      ]);
      mockFilesystem.readFile.mockResolvedValue('name: TestAgent');

      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        true,
        null,
      );

      expect(result.globalAgentCount).toBe(2);
      expect(result.globalAgentErrors).toEqual([]);
    });

    it('should ignore non-YAML files in agents directory', async () => {
      mockFilesystem.exists.mockResolvedValue(true);
      mockFilesystem.readdir.mockResolvedValue([
        'agent.yaml',
        'agent.md',
        'README.md',
        'script.sh',
        '.gitignore',
      ]);
      mockFilesystem.readFile.mockResolvedValue('name: TestAgent');

      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        true,
        null,
      );

      expect(result.globalAgentCount).toBe(1);
      expect(result.globalAgentErrors).toEqual([]);
    });

    it('should handle readdir errors gracefully', async () => {
      mockFilesystem.exists.mockResolvedValue(true);
      mockFilesystem.readdir.mockRejectedValue(new Error('Permission denied'));

      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        true,
        null,
      );

      expect(result.globalAgentCount).toBe(0);
      expect(result.globalAgentErrors).toContain(
        'Failed to read agents directory: Permission denied',
      );
    });

    it('should continue validating other agents when one fails', async () => {
      mockFilesystem.exists.mockResolvedValue(true);
      mockFilesystem.readdir.mockResolvedValue([
        'good-agent.yaml',
        'good-agent.md',
        'bad-agent.yaml',
        'bad-agent.md',
        'another-good.yaml',
        'another-good.md',
      ]);
      mockFilesystem.readFile.mockImplementation(async (path: string) => {
        if (path.includes('bad-agent')) {
          return 'no_name_field: true';
        }
        return 'name: GoodAgent';
      });

      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        true,
        null,
      );

      expect(result.globalAgentCount).toBe(2);
      expect(result.globalAgentErrors).toHaveLength(1);
      expect(result.globalAgentErrors[0]).toContain('bad-agent.yaml');
    });
  });

  describe('edge cases', () => {
    it('should handle empty agents directory', async () => {
      mockFilesystem.exists.mockResolvedValue(true);
      mockFilesystem.readdir.mockResolvedValue([]);

      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        true,
        null,
      );

      expect(result.globalAgentCount).toBe(0);
      expect(result.globalAgentErrors).toEqual([]);
    });

    it('should handle agents directory with only MD files', async () => {
      mockFilesystem.exists.mockResolvedValue(true);
      mockFilesystem.readdir.mockResolvedValue([
        'agent1.md',
        'agent2.md',
        'README.md',
      ]);

      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        true,
        null,
      );

      expect(result.globalAgentCount).toBe(0);
      expect(result.globalAgentErrors).toEqual([]);
    });

    it('should handle null parsed YAML', async () => {
      mockFilesystem.exists.mockResolvedValue(true);
      mockFilesystem.readdir.mockResolvedValue(['null-agent.yaml']);
      mockFilesystem.readFile.mockResolvedValue('null');

      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        true,
        null,
      );

      expect(result.globalAgentCount).toBe(0);
      expect(result.globalAgentErrors).toContain(
        'null-agent.yaml: Invalid YAML structure',
      );
    });

    it('should handle YAML with empty name field', async () => {
      mockFilesystem.exists.mockResolvedValue(true);
      mockFilesystem.readdir.mockResolvedValue(['empty-name.yaml']);
      mockFilesystem.readFile.mockResolvedValue('name: ""');

      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        true,
        null,
      );

      // Empty string is falsy, so it should fail the name check
      expect(result.globalAgentCount).toBe(0);
      expect(result.globalAgentErrors).toContain(
        "empty-name.yaml: Missing required 'name' field",
      );
    });

    it('should handle multiple errors in same agent file', async () => {
      mockFilesystem.exists.mockImplementation(async (path: string) => {
        if (path.endsWith('.md')) {
          return false;
        }
        return true;
      });
      mockFilesystem.readdir.mockResolvedValue(['problematic.yaml']);

      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        true,
        null,
      );

      // Should report missing MD file first and skip YAML validation
      expect(result.globalAgentCount).toBe(0);
      expect(result.globalAgentErrors).toHaveLength(1);
      expect(result.globalAgentErrors[0]).toContain(
        'problematic.yaml: Missing corresponding problematic.md file',
      );
    });
  });

  describe('models.yaml validation', () => {
    it('should handle models.yaml not existing', async () => {
      mockFilesystem.exists.mockResolvedValue(false);

      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        true,
        null,
      );

      expect(result.modelsConfigExists).toBe(false);
      expect(result.modelsConfigValid).toBe(false);
      expect(result.modelsConfigError).toBeNull();
    });

    it('should validate complex models.yaml structure', async () => {
      mockFilesystem.exists.mockImplementation(async (path: string) => {
        if (path.includes('models.yaml')) {
          return true;
        }
        return false;
      });
      mockFilesystem.readFile.mockResolvedValue(`
default_model: claude-3-opus
models:
  - name: claude-3-opus
    provider: anthropic
  - name: gpt-4
    provider: openai
      `);

      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        true,
        null,
      );

      expect(result.modelsConfigExists).toBe(true);
      expect(result.modelsConfigValid).toBe(true);
      expect(result.modelsConfigError).toBeNull();
    });

    it('should reject models.yaml with primitive value', async () => {
      mockFilesystem.exists.mockImplementation(async (path: string) => {
        if (path.includes('models.yaml')) {
          return true;
        }
        return false;
      });
      mockFilesystem.readFile.mockResolvedValue('just a string');

      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        true,
        null,
      );

      expect(result.modelsConfigExists).toBe(true);
      expect(result.modelsConfigValid).toBe(false);
      expect(result.modelsConfigError).toBe(
        'models.yaml must contain a YAML object',
      );
    });

    it('should handle empty models.yaml file', async () => {
      mockFilesystem.exists.mockImplementation(async (path: string) => {
        if (path.includes('models.yaml')) {
          return true;
        }
        return false;
      });
      mockFilesystem.readFile.mockResolvedValue('');

      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        true,
        null,
      );

      expect(result.modelsConfigExists).toBe(true);
      expect(result.modelsConfigValid).toBe(false);
      expect(result.modelsConfigError).toBe(
        'models.yaml must contain a YAML object',
      );
    });

    it('should handle models.yaml with null content', async () => {
      mockFilesystem.exists.mockImplementation(async (path: string) => {
        if (path.includes('models.yaml')) {
          return true;
        }
        return false;
      });
      mockFilesystem.readFile.mockResolvedValue('null');

      const result = await checker.checkAgents(
        '/home/user/.config/overture',
        true,
        null,
      );

      expect(result.modelsConfigExists).toBe(true);
      expect(result.modelsConfigValid).toBe(false);
      expect(result.modelsConfigError).toBe(
        'models.yaml must contain a YAML object',
      );
    });
  });

  describe('agent sync detection', () => {
    describe('when both global and project agents exist', () => {
      it('should detect all agents are in sync', async () => {
        const agentYamlContent = 'name: TestAgent\ndescription: Test';
        const agentMdContent = '# TestAgent\n\nThis is a test agent.';

        mockFilesystem.exists.mockResolvedValue(true);
        mockFilesystem.readdir.mockImplementation(async (path: string) => {
          if (path.includes('/home/user/.config/overture/agents')) {
            return ['agent1.yaml', 'agent2.yaml'];
          }
          if (path.includes('/project/.overture/agents')) {
            return ['agent1.yaml', 'agent2.yaml'];
          }
          return [];
        });
        mockFilesystem.readFile.mockImplementation(async (path: string) => {
          if (path.endsWith('.yaml')) {
            return agentYamlContent;
          }
          if (path.endsWith('.md')) {
            return agentMdContent;
          }
          return '';
        });

        const result = await checker.checkAgents(
          '/home/user/.config/overture',
          true,
          '/project',
        );

        expect(result.syncStatus).toBeDefined();
        expect(result.syncStatus?.isInitialized).toBe(true);
        expect(result.syncStatus?.globalAgents).toEqual(['agent1', 'agent2']);
        expect(result.syncStatus?.projectAgents).toEqual(['agent1', 'agent2']);
        expect(result.syncStatus?.inSync).toEqual(['agent1', 'agent2']);
        expect(result.syncStatus?.outOfSync).toEqual([]);
        expect(result.syncStatus?.onlyInGlobal).toEqual([]);
        expect(result.syncStatus?.onlyInProject).toEqual([]);
      });

      it('should detect agents that are out of sync (modified)', async () => {
        mockFilesystem.exists.mockResolvedValue(true);
        mockFilesystem.readdir.mockImplementation(async (path: string) => {
          if (path.includes('/home/user/.config/overture/agents')) {
            return ['agent1.yaml'];
          }
          if (path.includes('/project/.overture/agents')) {
            return ['agent1.yaml'];
          }
          return [];
        });
        mockFilesystem.readFile.mockImplementation(async (path: string) => {
          if (path.includes('home/user/.config/overture/agents/agent1.yaml')) {
            return 'name: Agent1\ndescription: Updated global version';
          }
          if (path.includes('/project/.overture/agents/agent1.yaml')) {
            return 'name: Agent1\ndescription: Old project version';
          }
          if (path.endsWith('.md')) {
            return '# Agent\n\nContent';
          }
          return '';
        });

        const result = await checker.checkAgents(
          '/home/user/.config/overture',
          true,
          '/project',
        );

        expect(result.syncStatus).toBeDefined();
        expect(result.syncStatus?.isInitialized).toBe(true);
        expect(result.syncStatus?.inSync).toEqual([]);
        expect(result.syncStatus?.outOfSync).toEqual(['agent1']);
        expect(result.syncStatus?.onlyInGlobal).toEqual([]);
        expect(result.syncStatus?.onlyInProject).toEqual([]);
      });

      it('should detect agents only in global (not yet synced)', async () => {
        mockFilesystem.exists.mockResolvedValue(true);
        mockFilesystem.readdir.mockImplementation(async (path: string) => {
          if (path.includes('/home/user/.config/overture/agents')) {
            return ['agent1.yaml', 'agent2.yaml', 'agent3.yaml'];
          }
          if (path.includes('/project/.overture/agents')) {
            return ['agent1.yaml'];
          }
          return [];
        });
        mockFilesystem.readFile.mockResolvedValue('name: TestAgent');

        const result = await checker.checkAgents(
          '/home/user/.config/overture',
          true,
          '/project',
        );

        expect(result.syncStatus).toBeDefined();
        expect(result.syncStatus?.globalAgents).toEqual([
          'agent1',
          'agent2',
          'agent3',
        ]);
        expect(result.syncStatus?.projectAgents).toEqual(['agent1']);
        expect(result.syncStatus?.onlyInGlobal).toContain('agent2');
        expect(result.syncStatus?.onlyInGlobal).toContain('agent3');
      });

      it('should detect agents only in project (custom agents)', async () => {
        mockFilesystem.exists.mockResolvedValue(true);
        mockFilesystem.readdir.mockImplementation(async (path: string) => {
          if (path.includes('/home/user/.config/overture/agents')) {
            return ['agent1.yaml'];
          }
          if (path.includes('/project/.overture/agents')) {
            return ['agent1.yaml', 'custom-agent.yaml'];
          }
          return [];
        });
        mockFilesystem.readFile.mockResolvedValue('name: TestAgent');

        const result = await checker.checkAgents(
          '/home/user/.config/overture',
          true,
          '/project',
        );

        expect(result.syncStatus).toBeDefined();
        expect(result.syncStatus?.onlyInProject).toEqual(['custom-agent']);
      });

      it('should handle .yml extension in sync detection', async () => {
        const yamlContent = 'name: TestAgent';
        const mdContent = '# Test';

        mockFilesystem.exists.mockResolvedValue(true);
        mockFilesystem.readdir.mockImplementation(async (path: string) => {
          if (path.includes('/home/user/.config/overture/agents')) {
            return ['agent1.yml'];
          }
          if (path.includes('/project/.overture/agents')) {
            return ['agent1.yml'];
          }
          return [];
        });
        mockFilesystem.readFile.mockImplementation(async (path: string) => {
          if (path.endsWith('.yml')) {
            return yamlContent;
          }
          if (path.endsWith('.md')) {
            return mdContent;
          }
          return '';
        });

        const result = await checker.checkAgents(
          '/home/user/.config/overture',
          true,
          '/project',
        );

        expect(result.syncStatus?.inSync).toEqual(['agent1']);
      });

      it('should detect MD file differences even with same YAML', async () => {
        mockFilesystem.exists.mockResolvedValue(true);
        mockFilesystem.readdir.mockImplementation(async (path: string) => {
          if (path.includes('/home/user/.config/overture/agents')) {
            return ['agent1.yaml'];
          }
          if (path.includes('/project/.overture/agents')) {
            return ['agent1.yaml'];
          }
          return [];
        });
        mockFilesystem.readFile.mockImplementation(async (path: string) => {
          if (path.endsWith('.yaml')) {
            return 'name: TestAgent';
          }
          if (path.includes('home/user/.config/overture/agents/agent1.md')) {
            return '# Agent\n\nUpdated global content';
          }
          if (path.includes('/project/.overture/agents/agent1.md')) {
            return '# Agent\n\nOld project content';
          }
          return '';
        });

        const result = await checker.checkAgents(
          '/home/user/.config/overture',
          true,
          '/project',
        );

        expect(result.syncStatus?.outOfSync).toEqual(['agent1']);
      });
    });

    describe('when sync status should not be detected', () => {
      it('should not detect sync when no project root provided', async () => {
        mockFilesystem.exists.mockResolvedValue(true);
        mockFilesystem.readdir.mockResolvedValue(['agent1.yaml']);
        mockFilesystem.readFile.mockResolvedValue('name: TestAgent');

        const result = await checker.checkAgents(
          '/home/user/.config/overture',
          true,
          null,
        );

        expect(result.syncStatus).toBeUndefined();
      });

      it('should not detect sync when global agents directory does not exist', async () => {
        mockFilesystem.exists.mockImplementation(async (path: string) => {
          if (path.includes('/home/user/.config/overture/agents')) {
            return false;
          }
          return true;
        });
        mockFilesystem.readdir.mockResolvedValue(['agent1.yaml']);
        mockFilesystem.readFile.mockResolvedValue('name: TestAgent');

        const result = await checker.checkAgents(
          '/home/user/.config/overture',
          true,
          '/project',
        );

        expect(result.syncStatus).toBeUndefined();
      });

      it('should not detect sync when project agents directory does not exist', async () => {
        mockFilesystem.exists.mockImplementation(async (path: string) => {
          if (path.includes('/project/.overture/agents')) {
            return false;
          }
          return true;
        });
        mockFilesystem.readdir.mockResolvedValue(['agent1.yaml']);
        mockFilesystem.readFile.mockResolvedValue('name: TestAgent');

        const result = await checker.checkAgents(
          '/home/user/.config/overture',
          true,
          '/project',
        );

        expect(result.syncStatus).toBeUndefined();
      });

      it('should detect sync as not initialized when project has no agents', async () => {
        mockFilesystem.exists.mockResolvedValue(true);
        mockFilesystem.readdir.mockImplementation(async (path: string) => {
          if (path.includes('/home/user/.config/overture/agents')) {
            return ['agent1.yaml'];
          }
          if (path.includes('/project/.overture/agents')) {
            return [];
          }
          return [];
        });
        mockFilesystem.readFile.mockResolvedValue('name: TestAgent');

        const result = await checker.checkAgents(
          '/home/user/.config/overture',
          true,
          '/project',
        );

        expect(result.syncStatus).toBeDefined();
        expect(result.syncStatus?.isInitialized).toBe(false);
        expect(result.syncStatus?.projectAgents).toEqual([]);
        expect(result.syncStatus?.onlyInGlobal).toEqual(['agent1']);
      });
    });

    describe('error handling in sync detection', () => {
      it('should handle readdir failure gracefully', async () => {
        mockFilesystem.exists.mockResolvedValue(true);
        mockFilesystem.readdir.mockImplementation(async (path: string) => {
          if (path.includes('/home/user/.config/overture/agents')) {
            return ['agent1.yaml'];
          }
          if (path.includes('/project/.overture/agents')) {
            throw new Error('Permission denied');
          }
          return [];
        });
        mockFilesystem.readFile.mockResolvedValue('name: TestAgent');

        const result = await checker.checkAgents(
          '/home/user/.config/overture',
          true,
          '/project',
        );

        // When project readdir fails, getAgentNames returns [] for project
        // but global readdir succeeds, so we get partial data
        expect(result.syncStatus).toBeDefined();
        expect(result.syncStatus?.globalAgents).toEqual(['agent1']);
        expect(result.syncStatus?.projectAgents).toEqual([]);
        expect(result.syncStatus?.isInitialized).toBe(false); // No project agents
        expect(result.syncStatus?.onlyInGlobal).toEqual(['agent1']);
      });

      it('should handle comparison errors gracefully', async () => {
        mockFilesystem.exists.mockResolvedValue(true);
        mockFilesystem.readdir.mockImplementation(async (path: string) => {
          if (path.includes('/home/user/.config/overture/agents')) {
            return ['agent1.yaml'];
          }
          if (path.includes('/project/.overture/agents')) {
            return ['agent1.yaml'];
          }
          return [];
        });
        mockFilesystem.readFile.mockRejectedValue(new Error('File read error'));

        const result = await checker.checkAgents(
          '/home/user/.config/overture',
          true,
          '/project',
        );

        // Should not crash - agents exist but comparison fails
        // Comparison failure means they're treated as out of sync
        expect(result.syncStatus).toBeDefined();
        expect(result.syncStatus?.globalAgents).toEqual(['agent1']);
        expect(result.syncStatus?.projectAgents).toEqual(['agent1']);
      });
    });
  });
});
