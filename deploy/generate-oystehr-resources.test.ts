import fs from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fs module before importing the module under test
vi.mock('node:fs/promises');

vi.mock('utils', () => ({
  BRANDING_CONFIG: { projectName: 'test-project' },
  SENDGRID_CONFIG: { templates: {} },
}));

// Import after mocks are set up
import {
  GenerateFhirResourcesArgs,
  generateOystehrResources,
  isObject,
  validSchemas,
} from './generate-oystehr-resources';

// Type definitions for test data
interface ZambdaSpec {
  name: string;
  type: 'http_auth' | 'http_open' | 'cron' | 'subscription';
  runtime: string;
  src: string;
  zip: string;
  timeout?: string;
  memorySize?: string;
  schedule?: { expression: string };
  subscription?: { criteria: string; reason: string; event?: string };
}

interface SpecFile {
  'schema-version': string;
  zambdas?: Record<string, ZambdaSpec>;
  apps?: Record<string, unknown>;
  roles?: Record<string, unknown>;
}

type VarsFile = Record<string, string>;

// Helper to create mock Dirent objects
const createMockDirent = (
  name: string,
  isFile: boolean
): { name: string; isFile: () => boolean; isDirectory: () => boolean } => ({
  name,
  isFile: () => isFile,
  isDirectory: () => !isFile,
});

// Helper to create ENOENT error
const createEnoentError = (): NodeJS.ErrnoException => {
  const error = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
  error.code = 'ENOENT';
  return error;
};

// Helper to create test args
const createTestArgs = (overrides: Partial<GenerateFhirResourcesArgs> = {}): GenerateFhirResourcesArgs => ({
  configDir: '/config/oystehr',
  varFile: '/packages/zambdas/.env/local.json',
  outputPath: '/output',
  env: 'local',
  ...overrides,
});

// Type-safe mock setup helpers
const mockFsForSuccess = (): void => {
  vi.mocked(fs.mkdir).mockResolvedValue(undefined);
  vi.mocked(fs.writeFile).mockResolvedValue(undefined);
  vi.mocked(fs.rm).mockResolvedValue(undefined);
};

describe('generate-oystehr-resources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isObject', () => {
    it('returns true for plain objects', () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ key: 'value' })).toBe(true);
    });

    it('returns false for arrays', () => {
      expect(isObject([])).toBe(false);
      expect(isObject([1, 2, 3])).toBe(false);
    });

    it('returns false for null and undefined', () => {
      expect(isObject(null)).toBeFalsy();
      expect(isObject(undefined)).toBeFalsy();
    });

    it('returns false for primitives', () => {
      expect(isObject('string')).toBe(false);
      expect(isObject(123)).toBe(false);
      expect(isObject(true)).toBe(false);
    });
  });

  describe('validSchemas', () => {
    it('contains expected schema versions', () => {
      expect(validSchemas).toContain('2025-03-19');
      expect(validSchemas).toContain('2025-09-25');
      expect(validSchemas).toHaveLength(2);
    });
  });

  describe('generateOystehrResources', () => {
    describe('environment-specific config loading', () => {
      it('loads env-specific configs when directory exists', async () => {
        const baseSpec: SpecFile = {
          'schema-version': '2025-09-25',
          zambdas: {
            'BASE-ZAMBDA': {
              name: 'base',
              type: 'http_auth',
              runtime: 'nodejs20.x',
              src: 'src/test/index',
              zip: '.dist/zips/base.zip',
            },
          },
        };
        const envSpec: SpecFile = {
          'schema-version': '2025-09-25',
          zambdas: {
            'ENV-ZAMBDA': {
              name: 'env',
              type: 'cron',
              runtime: 'nodejs20.x',
              src: 'src/test/index',
              zip: '.dist/zips/env.zip',
              schedule: { expression: 'cron(0 * * * ? *)' },
            },
          },
        };
        const vars: VarsFile = { TEST_VAR: 'value' };

        mockFsForSuccess();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(fs.readdir).mockImplementation(async (dirPath: any) => {
          const pathStr = String(dirPath);
          if (pathStr === '/config/oystehr') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return [createMockDirent('zambdas.json', true)] as any;
          }
          if (pathStr === '/config/oystehr/env/local') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return [createMockDirent('zambdas.json', true)] as any;
          }
          return [];
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(fs.readFile).mockImplementation(async (filePath: any) => {
          const pathStr = String(filePath);
          if (pathStr === '/config/oystehr/zambdas.json') {
            return JSON.stringify(baseSpec);
          }
          if (pathStr === '/config/oystehr/env/local/zambdas.json') {
            return JSON.stringify(envSpec);
          }
          if (pathStr.includes('.env/local.json')) {
            return JSON.stringify(vars);
          }
          throw new Error(`Unexpected file read: ${pathStr}`);
        });

        await generateOystehrResources(createTestArgs());

        expect(fs.readFile).toHaveBeenCalledWith('/config/oystehr/zambdas.json', 'utf-8');
        expect(fs.readFile).toHaveBeenCalledWith('/config/oystehr/env/local/zambdas.json', 'utf-8');
      });

      it('skips env-specific configs when directory does not exist (ENOENT)', async () => {
        const baseSpec: SpecFile = {
          'schema-version': '2025-09-25',
          zambdas: {
            'BASE-ZAMBDA': {
              name: 'base',
              type: 'http_auth',
              runtime: 'nodejs20.x',
              src: 'src/test/index',
              zip: '.dist/zips/base.zip',
            },
          },
        };
        const vars: VarsFile = { TEST_VAR: 'value' };

        mockFsForSuccess();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(fs.readdir).mockImplementation(async (dirPath: any) => {
          if (String(dirPath) === '/config/oystehr') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return [createMockDirent('zambdas.json', true)] as any;
          }
          return [];
        });

        vi.mocked(fs.stat).mockRejectedValue(createEnoentError());

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(fs.readFile).mockImplementation(async (filePath: any) => {
          const pathStr = String(filePath);
          if (pathStr === '/config/oystehr/zambdas.json') {
            return JSON.stringify(baseSpec);
          }
          if (pathStr.includes('.env/production.json')) {
            return JSON.stringify(vars);
          }
          throw new Error(`Unexpected file read: ${pathStr}`);
        });

        await expect(
          generateOystehrResources(
            createTestArgs({ env: 'production', varFile: '/packages/zambdas/.env/production.json' })
          )
        ).resolves.not.toThrow();

        expect(fs.stat).toHaveBeenCalledWith('/config/oystehr/env/production');
      });

      it('propagates non-ENOENT errors', async () => {
        mockFsForSuccess();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(fs.readdir).mockResolvedValue([createMockDirent('zambdas.json', true)] as any);

        const eaccesError = new Error('EACCES: permission denied') as NodeJS.ErrnoException;
        eaccesError.code = 'EACCES';
        vi.mocked(fs.stat).mockRejectedValue(eaccesError);

        await expect(generateOystehrResources(createTestArgs())).rejects.toThrow('EACCES');
      });
    });

    describe('schema version validation', () => {
      it('throws error when specs have different schema versions', async () => {
        const spec1: SpecFile = { 'schema-version': '2025-09-25', zambdas: {} };
        const spec2: SpecFile = { 'schema-version': '2025-03-19', zambdas: {} };
        const vars: VarsFile = {};

        mockFsForSuccess();
        vi.mocked(fs.readdir).mockResolvedValue([
          createMockDirent('spec1.json', true),
          createMockDirent('spec2.json', true),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ] as any);
        vi.mocked(fs.stat).mockRejectedValue(createEnoentError());

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(fs.readFile).mockImplementation(async (filePath: any) => {
          const pathStr = String(filePath);
          if (pathStr.endsWith('spec1.json')) return JSON.stringify(spec1);
          if (pathStr.endsWith('spec2.json')) return JSON.stringify(spec2);
          if (pathStr.includes('.env/')) return JSON.stringify(vars);
          throw new Error(`Unexpected file: ${pathStr}`);
        });

        await expect(generateOystehrResources(createTestArgs())).rejects.toThrow(
          'All spec files must have the same schema version'
        );
      });

      it('throws error for invalid schema version', async () => {
        const spec: SpecFile = { 'schema-version': '2099-01-01', zambdas: {} };
        const vars: VarsFile = {};

        mockFsForSuccess();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(fs.readdir).mockResolvedValue([createMockDirent('spec.json', true)] as any);
        vi.mocked(fs.stat).mockRejectedValue(createEnoentError());

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(fs.readFile).mockImplementation(async (filePath: any) => {
          const pathStr = String(filePath);
          if (pathStr.endsWith('spec.json')) return JSON.stringify(spec);
          if (pathStr.includes('.env/')) return JSON.stringify(vars);
          throw new Error(`Unexpected file: ${pathStr}`);
        });

        await expect(generateOystehrResources(createTestArgs())).rejects.toThrow('Invalid or missing schema version');
      });
    });

    describe('input validation', () => {
      it('throws error when configDir is empty', async () => {
        await expect(generateOystehrResources(createTestArgs({ configDir: '' }))).rejects.toThrow(
          'Config directory is required'
        );
      });

      it('throws error when varFile is empty', async () => {
        await expect(generateOystehrResources(createTestArgs({ varFile: '' }))).rejects.toThrow(
          'Variable file is required'
        );
      });

      it('throws error when outputPath is empty', async () => {
        await expect(generateOystehrResources(createTestArgs({ outputPath: '' }))).rejects.toThrow(
          'Output path is required'
        );
      });
    });

    describe('JSON parsing', () => {
      it('throws error for invalid JSON in spec file', async () => {
        mockFsForSuccess();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(fs.readdir).mockResolvedValue([createMockDirent('bad.json', true)] as any);
        vi.mocked(fs.stat).mockRejectedValue(createEnoentError());

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(fs.readFile).mockImplementation(async (filePath: any) => {
          const pathStr = String(filePath);
          if (pathStr.endsWith('bad.json')) return 'not valid json {{{';
          if (pathStr.includes('.env/')) return '{}';
          throw new Error(`Unexpected file: ${pathStr}`);
        });

        await expect(generateOystehrResources(createTestArgs())).rejects.toThrow('Error parsing JSON file');
      });

      it('throws error for invalid JSON in var file', async () => {
        const spec: SpecFile = { 'schema-version': '2025-09-25', zambdas: {} };

        mockFsForSuccess();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(fs.readdir).mockResolvedValue([createMockDirent('spec.json', true)] as any);
        vi.mocked(fs.stat).mockRejectedValue(createEnoentError());

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(fs.readFile).mockImplementation(async (filePath: any) => {
          const pathStr = String(filePath);
          if (pathStr.endsWith('spec.json')) return JSON.stringify(spec);
          if (pathStr.includes('.env/')) return 'not valid json';
          throw new Error(`Unexpected file: ${pathStr}`);
        });

        await expect(generateOystehrResources(createTestArgs())).rejects.toThrow('Error parsing variable file');
      });

      it('throws error when var file is not an object', async () => {
        const spec: SpecFile = { 'schema-version': '2025-09-25', zambdas: {} };

        mockFsForSuccess();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(fs.readdir).mockResolvedValue([createMockDirent('spec.json', true)] as any);
        vi.mocked(fs.stat).mockRejectedValue(createEnoentError());

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(fs.readFile).mockImplementation(async (filePath: any) => {
          const pathStr = String(filePath);
          if (pathStr.endsWith('spec.json')) return JSON.stringify(spec);
          if (pathStr.includes('.env/')) return JSON.stringify(['array', 'not', 'object']);
          throw new Error(`Unexpected file: ${pathStr}`);
        });

        await expect(generateOystehrResources(createTestArgs())).rejects.toThrow('is not a valid JSON map');
      });
    });
  });
});
