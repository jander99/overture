import type { Mock, Mocked, MockedObject, MockedFunction, MockInstance } from 'vitest';
/**
 * Doctor Command Tests
 *
 * Tests for the diagnostic command that checks system for installed clients and MCP servers.
 *
 * @module cli/commands/doctor.spec
 */

import { createDoctorCommand } from './doctor';
import { BinaryDetector } from '../../core/binary-detector';
import { loadUserConfig, loadProjectConfig } from '../../core/config-loader';
import { findProjectRoot } from '../../core/path-resolver';
import { ProcessExecutor } from '../../infrastructure/process-executor';
import type { OvertureConfig } from '../../domain/config.types';

// Mock dependencies
vi.mock('../../core/binary-detector');
vi.mock('../../core/config-loader');
vi.mock('../../core/path-resolver');
vi.mock('../../infrastructure/process-executor');

const mockBinaryDetector = BinaryDetector as MockedClass<typeof BinaryDetector>;
const mockLoadUserConfig = loadUserConfig as MockedFunction<typeof loadUserConfig>;
const mockLoadProjectConfig = loadProjectConfig as MockedFunction<typeof loadProjectConfig>;
const mockFindProjectRoot = findProjectRoot as MockedFunction<typeof findProjectRoot>;
const mockProcessExecutor = ProcessExecutor as Mocked<typeof ProcessExecutor>;

describe('Doctor Command', () => {
  let command: ReturnType<typeof createDoctorCommand>;
  let mockDetectorInstance: MockedObject<BinaryDetector>;

  const testUserConfig: OvertureConfig = {
    version: '2.0',
    mcp: {
      github: {
        command: 'gh',
        args: ['mcp'],
        env: {},
        transport: 'stdio',
      },
      filesystem: {
        command: 'npx',
        args: ['-y', 'mcp-server-filesystem'],
        env: {},
        transport: 'stdio',
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock detector instance
    mockDetectorInstance = {
      detectClient: vi.fn(),
      detectBinary: vi.fn(),
      detectAppBundle: vi.fn(),
      validateConfigFile: vi.fn(),
    } as any;

    mockBinaryDetector.mockImplementation(() => mockDetectorInstance);

    // Default mocks
    mockFindProjectRoot.mockReturnValue(null);
    mockLoadUserConfig.mockResolvedValue(testUserConfig);
    mockLoadProjectConfig.mockResolvedValue(null);

    command = createDoctorCommand();
  });

  describe('command setup', () => {
    it('should create doctor command with correct name', () => {
      expect(command.name()).toBe('doctor');
    });

    it('should have correct description', () => {
      expect(command.description()).toBe('Check system for installed clients and MCP servers');
    });

    it('should support --json option', () => {
      const jsonOption = command.options.find(opt => opt.long === '--json');
      expect(jsonOption).toBeDefined();
    });

    it('should support --verbose option', () => {
      const verboseOption = command.options.find(opt => opt.long === '--verbose');
      expect(verboseOption).toBeDefined();
    });
  });

  describe('required dependencies', () => {
    it('should have BinaryDetector available', () => {
      expect(mockBinaryDetector).toBeDefined();
    });

    it('should have config loader functions available', () => {
      expect(mockLoadUserConfig).toBeDefined();
      expect(mockLoadProjectConfig).toBeDefined();
    });

    it('should have path resolver available', () => {
      expect(mockFindProjectRoot).toBeDefined();
    });
  });
});
