import type { FilesystemPort } from '@overture/ports-filesystem';
import type {
  AgentsCheckResult,
  AgentSyncStatus,
} from '@overture/diagnostics-types';

/**
 * AgentsChecker - Validates agent YAML/MD pairs
 *
 * Never throws errors - always returns results with error messages.
 */
export class AgentsChecker {
  constructor(private readonly filesystem: FilesystemPort) {}

  /**
   * Check agents directories and validate agent files
   */
  async checkAgents(
    configRepoPath: string,
    configRepoExists: boolean,
    projectRoot: string | null,
  ): Promise<AgentsCheckResult> {
    const globalAgentsPath = `${configRepoPath}/agents`;
    const modelsConfigPath = `${configRepoPath}/models.yaml`;

    const globalAgentsDirExists =
      configRepoExists && (await this.filesystem.exists(globalAgentsPath));
    const modelsConfigExists =
      configRepoExists && (await this.filesystem.exists(modelsConfigPath));

    // Validate global agents
    const { agentCount: globalAgentCount, errors: globalAgentErrors } =
      await this.validateAgents(globalAgentsPath, globalAgentsDirExists);

    // Validate project agents (if in a project)
    let projectAgentsPath: string | null = null;
    let projectAgentsDirExists = false;
    let projectAgentCount = 0;
    let projectAgentErrors: string[] = [];

    if (projectRoot) {
      projectAgentsPath = `${projectRoot}/.overture/agents`;
      projectAgentsDirExists = await this.filesystem.exists(projectAgentsPath);
      const projectAgentData = await this.validateAgents(
        projectAgentsPath,
        projectAgentsDirExists,
      );
      projectAgentCount = projectAgentData.agentCount;
      projectAgentErrors = projectAgentData.errors;
    }

    // Validate models.yaml
    let modelsConfigValid = false;
    let modelsConfigError: string | null = null;

    if (modelsConfigExists) {
      try {
        const content = await this.filesystem.readFile(modelsConfigPath);
        const yaml = await import('js-yaml');
        const parsed = yaml.load(content);

        if (
          typeof parsed !== 'object' ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          modelsConfigError = 'models.yaml must contain a YAML object';
        } else {
          modelsConfigValid = true;
        }
      } catch (error) {
        modelsConfigError = (error as Error).message;
      }
    }

    // Detect sync status (only if in a project with both global and project agents)
    let syncStatus: AgentSyncStatus | undefined = undefined;
    if (
      projectRoot &&
      globalAgentsDirExists &&
      projectAgentsDirExists &&
      projectAgentsPath
    ) {
      syncStatus = await this.detectSyncStatus(
        globalAgentsPath,
        projectAgentsPath,
      );
    }

    return {
      globalAgentsPath,
      globalAgentsDirExists,
      globalAgentCount,
      globalAgentErrors,
      projectAgentsPath,
      projectAgentsDirExists,
      projectAgentCount,
      projectAgentErrors,
      modelsConfigPath,
      modelsConfigExists,
      modelsConfigValid,
      modelsConfigError,
      syncStatus,
    };
  }

  /**
   * Validate agent YAML/MD pairs in a directory
   */
  private async validateAgents(
    agentsPath: string,
    agentsDirExists: boolean,
  ): Promise<{ agentCount: number; errors: string[] }> {
    const errors: string[] = [];
    let agentCount = 0;

    if (!agentsDirExists) {
      return { agentCount, errors };
    }

    try {
      const files = await this.filesystem.readdir(agentsPath);
      const yamlFiles = files.filter(
        (f) => f.endsWith('.yaml') || f.endsWith('.yml'),
      );

      for (const yamlFile of yamlFiles) {
        const name = yamlFile.replace(/\.ya?ml$/, '');
        const mdFile = `${name}.md`;

        const yamlPath = `${agentsPath}/${yamlFile}`;
        const mdPath = `${agentsPath}/${mdFile}`;

        // Check if corresponding .md file exists
        const hasMdFile = await this.filesystem.exists(mdPath);
        if (!hasMdFile) {
          errors.push(`${yamlFile}: Missing corresponding ${mdFile} file`);
          continue;
        }

        // Validate YAML syntax
        try {
          const yamlContent = await this.filesystem.readFile(yamlPath);
          const yaml = await import('js-yaml');
          const parsed = yaml.load(yamlContent);

          if (
            typeof parsed !== 'object' ||
            parsed === null ||
            Array.isArray(parsed)
          ) {
            errors.push(`${yamlFile}: Invalid YAML structure`);
            continue;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (!(parsed as any).name) {
            errors.push(`${yamlFile}: Missing required 'name' field`);
            continue;
          }

          // Successfully validated
          agentCount++;
        } catch (error) {
          errors.push(`${yamlFile}: ${(error as Error).message}`);
        }
      }
    } catch (error) {
      errors.push(
        `Failed to read agents directory: ${(error as Error).message}`,
      );
    }

    return { agentCount, errors };
  }

  /**
   * Detect agent sync status by comparing global and project directories
   */
  private async detectSyncStatus(
    globalAgentsPath: string,
    projectAgentsPath: string,
  ): Promise<AgentSyncStatus> {
    try {
      // Get agent names from both directories
      const globalAgents = await this.getAgentNames(globalAgentsPath);
      const projectAgents = await this.getAgentNames(projectAgentsPath);

      const inSync: string[] = [];
      const outOfSync: string[] = [];

      // Check agents that exist in both directories
      for (const agentName of globalAgents) {
        if (projectAgents.includes(agentName)) {
          // Compare content to determine if in sync
          const isInSync = await this.compareAgentContent(
            globalAgentsPath,
            projectAgentsPath,
            agentName,
          );
          if (isInSync) {
            inSync.push(agentName);
          } else {
            outOfSync.push(agentName);
          }
        }
      }

      // Determine unique agents
      const onlyInGlobal = globalAgents.filter(
        (name) => !projectAgents.includes(name),
      );
      const onlyInProject = projectAgents.filter(
        (name) => !globalAgents.includes(name),
      );

      const isInitialized = projectAgents.length > 0;

      return {
        isInitialized,
        globalAgents,
        projectAgents,
        inSync,
        outOfSync,
        onlyInGlobal,
        onlyInProject,
      };
    } catch {
      // Never throw - return safe default
      return {
        isInitialized: false,
        globalAgents: [],
        projectAgents: [],
        inSync: [],
        outOfSync: [],
        onlyInGlobal: [],
        onlyInProject: [],
      };
    }
  }

  /**
   * Get agent names from a directory
   */
  private async getAgentNames(agentsPath: string): Promise<string[]> {
    try {
      const files = await this.filesystem.readdir(agentsPath);
      const yamlFiles = files.filter(
        (f) => f.endsWith('.yaml') || f.endsWith('.yml'),
      );
      return yamlFiles.map((f) => f.replace(/\.ya?ml$/, ''));
    } catch {
      return [];
    }
  }

  /**
   * Compare agent content between global and project directories
   */
  private async compareAgentContent(
    globalAgentsPath: string,
    projectAgentsPath: string,
    agentName: string,
  ): Promise<boolean> {
    try {
      // Find the actual files (could be .yaml or .yml)
      const globalFiles = await this.filesystem.readdir(globalAgentsPath);
      const projectFiles = await this.filesystem.readdir(projectAgentsPath);

      const globalYamlFile =
        globalFiles.find(
          (f) => f === `${agentName}.yaml` || f === `${agentName}.yml`,
        ) || '';
      const projectYamlFile =
        projectFiles.find(
          (f) => f === `${agentName}.yaml` || f === `${agentName}.yml`,
        ) || '';

      if (!globalYamlFile || !projectYamlFile) {
        return false;
      }

      // Compare YAML content
      const globalYamlContent = await this.filesystem.readFile(
        `${globalAgentsPath}/${globalYamlFile}`,
      );
      const projectYamlContent = await this.filesystem.readFile(
        `${projectAgentsPath}/${projectYamlFile}`,
      );

      // Compare MD content
      const globalMdContent = await this.filesystem.readFile(
        `${globalAgentsPath}/${agentName}.md`,
      );
      const projectMdContent = await this.filesystem.readFile(
        `${projectAgentsPath}/${agentName}.md`,
      );

      return (
        globalYamlContent === projectYamlContent &&
        globalMdContent === projectMdContent
      );
    } catch {
      return false;
    }
  }
}
