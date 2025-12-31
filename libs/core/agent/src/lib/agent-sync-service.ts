import * as yaml from 'js-yaml';
import {
  AgentDefinition,
  AgentConfig,
  ClientName,
  ModelMapping,
  Scope,
  AgentSyncResult,
  AgentSyncSummary,
} from '@overture/config-types';
import { AgentConfigSchema, ModelMappingSchema } from '@overture/config-schema';
import { FilesystemPort } from '@overture/ports-filesystem';
import { OutputPort } from '@overture/ports-output';
import { AgentTransformer } from './agent-transformer.js';

export interface AgentSyncOptions {
  dryRun?: boolean;
  projectRoot?: string;
  clients?: ClientName[];
}

/**
 * AgentSyncService - Discovers and synchronizes AI agents across clients.
 */
export class AgentSyncService {
  private transformer: AgentTransformer;

  constructor(
    private filesystem: FilesystemPort,
    private output: OutputPort,
    private homeDir: string,
    private xdgConfigHome: string,
  ) {
    this.transformer = new AgentTransformer();
  }

  /**
   * Syncs all agents from global and project locations.
   */
  async syncAgents(options: AgentSyncOptions = {}): Promise<AgentSyncSummary> {
    const results: AgentSyncResult[] = [];

    // 1. Load Model Mapping
    const modelMapping = await this.loadModelMapping();

    // 2. Discover Agents
    const agents = await this.discoverAgents(options.projectRoot);

    const targetClients =
      options.clients ||
      (['claude-code', 'copilot-cli', 'opencode'] as ClientName[]);

    // 3. Sync each agent
    for (const agentDef of agents) {
      const agentResult: AgentSyncResult = {
        agent: agentDef.config.name,
        success: true,
        clientResults: {} as any,
      };

      for (const client of targetClients) {
        try {
          const { content, filename } = this.transformer.transform(
            agentDef,
            client,
            modelMapping,
          );
          const targetPath = await this.getClientAgentPath(
            client,
            filename,
            options.projectRoot,
          );

          if (targetPath) {
            if (!options.dryRun) {
              const targetDir = targetPath.substring(
                0,
                targetPath.lastIndexOf('/'),
              );
              await this.filesystem.mkdir(targetDir, { recursive: true });
              await this.filesystem.writeFile(targetPath, content);
            }
            agentResult.clientResults[client] = {
              success: true,
              path: targetPath,
            };
          }
        } catch (error) {
          agentResult.success = false;
          agentResult.clientResults[client] = {
            success: false,
            error: (error as Error).message,
          };
        }
      }
      results.push(agentResult);
    }

    const synced = results.filter((r) => r.success).length;
    return {
      total: agents.length,
      synced,
      failed: agents.length - synced,
      results,
    };
  }

  /**
   * Discovers agents in global and project directories.
   */
  private async discoverAgents(
    projectRoot?: string,
  ): Promise<AgentDefinition[]> {
    const agents: AgentDefinition[] = [];

    // Global agents
    const globalAgentsDir = `${this.xdgConfigHome}/overture/agents`;
    if (await this.filesystem.exists(globalAgentsDir)) {
      const globalAgents = await this.loadAgentsFromDir(
        globalAgentsDir,
        'global',
      );
      agents.push(...globalAgents);
    }

    // Project agents
    if (projectRoot) {
      const projectAgentsDir = `${projectRoot}/.overture/agents`;
      if (await this.filesystem.exists(projectAgentsDir)) {
        const projectAgents = await this.loadAgentsFromDir(
          projectAgentsDir,
          'project',
        );
        agents.push(...projectAgents);
      }
    }

    return agents;
  }

  /**
   * Loads all agent definitions from a directory.
   */
  private async loadAgentsFromDir(
    dir: string,
    scope: Scope,
  ): Promise<AgentDefinition[]> {
    const files = await this.filesystem.readdir(dir);
    const yamlFiles = files.filter(
      (f) => f.endsWith('.yaml') || f.endsWith('.yml'),
    );
    const definitions: AgentDefinition[] = [];

    for (const yamlFile of yamlFiles) {
      const name = yamlFile.replace(/\.ya?ml$/, '');
      const mdFile = `${name}.md`;

      const yamlPath = `${dir}/${yamlFile}`;
      const mdPath = `${dir}/${mdFile}`;

      if (await this.filesystem.exists(mdPath)) {
        try {
          const yamlContent = await this.filesystem.readFile(yamlPath);
          const mdContent = await this.filesystem.readFile(mdPath);

          const parsedYaml = yaml.load(yamlContent);
          const config = AgentConfigSchema.parse(parsedYaml) as AgentConfig;

          definitions.push({
            config,
            body: mdContent,
            scope,
            sourceDir: dir,
          });
        } catch (error) {
          this.output.error(
            `Failed to load agent ${name} from ${dir}: ${(error as Error).message}`,
          );
        }
      }
    }

    return definitions;
  }

  /**
   * Loads the model mapping from ~/.config/overture/models.yaml
   */
  private async loadModelMapping(): Promise<ModelMapping> {
    const mappingPath = `${this.xdgConfigHome}/overture/models.yaml`;
    if (!(await this.filesystem.exists(mappingPath))) {
      return {};
    }

    try {
      const content = await this.filesystem.readFile(mappingPath);
      const parsed = yaml.load(content);
      return ModelMappingSchema.parse(parsed) as ModelMapping;
    } catch (error) {
      this.output.warn(
        `Failed to load model mapping from ${mappingPath}: ${(error as Error).message}`,
      );
      return {};
    }
  }

  /**
   * Resolves the target path for a client agent file.
   */
  private async getClientAgentPath(
    client: ClientName,
    filename: string,
    projectRoot?: string,
  ): Promise<string | null> {
    switch (client) {
      case 'claude-code':
        return `${this.homeDir}/.claude/agents/${filename}`;
      case 'opencode':
        return `${this.homeDir}/.config/opencode/agent/${filename}`;
      case 'copilot-cli':
        if (!projectRoot) return null; // Copilot agents are project-scoped
        return `${projectRoot}/.github/agents/${filename}`;
      default:
        return null;
    }
  }
}
