import type { FilesystemPort } from '@overture/ports-filesystem';
import type { AdapterRegistry } from '@overture/client-adapters';
import type { Platform, ClientName } from '@overture/config-types';
import type {
  ClientsCheckResult,
  ClientCheckResult,
} from '@overture/diagnostics-types';

/**
 * ClientsChecker - Validates client installations and configs
 *
 * Never throws errors - always returns results.
 */
export class ClientsChecker {
  constructor(
    private readonly filesystem: FilesystemPort,
    private readonly adapterRegistry: AdapterRegistry,
  ) {}

  /**
   * Check all installed clients
   */
  async checkClients(
    discoveryReport: {
      clients: Array<{
        client: ClientName;
        detection: {
          status: string;
          binaryPath?: string;
          appBundlePath?: string;
          version?: string;
          warnings: string[];
        };
        source: string;
        environment?: string;
        windowsPath?: string;
      }>;
    },
    platform: Platform,
    projectRoot: string | null,
  ): Promise<ClientsCheckResult> {
    const clients: ClientCheckResult[] = [];

    const summary = {
      clientsDetected: 0,
      clientsMissing: 0,
      wsl2Detections: 0,
      configsValid: 0,
      configsInvalid: 0,
    };

    for (const clientDiscovery of discoveryReport.clients) {
      const clientName = clientDiscovery.client;
      const detection = clientDiscovery.detection;
      const adapter = this.adapterRegistry.get(clientName);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const configPath = (adapter as any)?.detectConfigPath?.(
        platform,
        projectRoot || undefined,
      );
      const configPathStr =
        typeof configPath === 'string'
          ? configPath
          : // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (configPath as any)?.user || undefined;

      const configValid = configPathStr
        ? await this.validateConfigFile(configPathStr)
        : false;

      const clientResult: ClientCheckResult = {
        client: clientName,
        status: detection.status as 'found' | 'not-found' | 'skipped',
        binaryPath: detection.binaryPath,
        appBundlePath: detection.appBundlePath,
        version: detection.version,
        configPath: configPathStr,
        configValid,
        warnings: detection.warnings,
        source: clientDiscovery.source,
        environment: clientDiscovery.environment,
        windowsPath: clientDiscovery.windowsPath,
      };

      clients.push(clientResult);

      // Update summary
      if (detection.status === 'found') {
        summary.clientsDetected++;
        if (clientDiscovery.source === 'wsl2-fallback') {
          summary.wsl2Detections++;
        }
      } else if (detection.status === 'not-found') {
        summary.clientsMissing++;
      }

      if (configValid) {
        summary.configsValid++;
      } else if (configPathStr) {
        summary.configsInvalid++;
      }
    }

    return {
      clients,
      summary,
    };
  }

  /**
   * Validate if a config file exists and contains valid JSON
   */
  private async validateConfigFile(filepath: string): Promise<boolean> {
    try {
      const fileExists = await this.filesystem.exists(filepath);
      if (!fileExists) {
        return false;
      }
      const content = await this.filesystem.readFile(filepath);
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  }
}
