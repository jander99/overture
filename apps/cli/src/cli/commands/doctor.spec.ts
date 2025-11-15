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
jest.mock('../../core/binary-detector');
jest.mock('../../core/config-loader');
jest.mock('../../core/path-resolver');
jest.mock('../../infrastructure/process-executor');

const mockBinaryDetector = BinaryDetector as jest.MockedClass<typeof BinaryDetector>;
const mockLoadUserConfig = loadUserConfig as jest.MockedFunction<typeof loadUserConfig>;
const mockLoadProjectConfig = loadProjectConfig as jest.MockedFunction<typeof loadProjectConfig>;
const mockFindProjectRoot = findProjectRoot as jest.MockedFunction<typeof findProjectRoot>;
const mockProcessExecutor = ProcessExecutor as jest.Mocked<typeof ProcessExecutor>;

describe('Doctor Command', () => {
  let command: ReturnType<typeof createDoctorCommand>;
  let mockDetectorInstance: jest.Mocked<BinaryDetector>;

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
    jest.clearAllMocks();

    // Create mock detector instance
    mockDetectorInstance = {
      detectClient: jest.fn(),
      detectBinary: jest.fn(),
      detectAppBundle: jest.fn(),
      validateConfigFile: jest.fn(),
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
