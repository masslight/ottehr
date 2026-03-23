import { describe, expect, it } from 'vitest';
import { Schema20250925 } from './schema-20250925';

describe('Schema20250925', () => {
  describe('duplicate detection', () => {
    it('throws error when zambda key exists in multiple spec files', () => {
      const baseSpec = {
        path: 'base/zambdas.json',
        spec: {
          'schema-version': '2025-09-25',
          zambdas: { 'MY-ZAMBDA': { name: 'my-zambda', type: 'http_auth' } },
        },
      };
      const envSpec = {
        path: 'env/local/zambdas.json',
        spec: {
          'schema-version': '2025-09-25',
          zambdas: { 'MY-ZAMBDA': { name: 'my-zambda', type: 'cron' } }, // Duplicate!
        },
      };

      expect(() => new Schema20250925([baseSpec, envSpec], {}, '/out', '/zambdas')).toThrow(
        'duplicate resource name "MY-ZAMBDA"'
      );
    });

    it('merges unique zambdas from multiple specs successfully', () => {
      const baseSpec = {
        path: 'base/zambdas.json',
        spec: {
          'schema-version': '2025-09-25',
          zambdas: { 'BASE-ZAMBDA': { name: 'base', type: 'http_auth' } },
        },
      };
      const envSpec = {
        path: 'env/local/zambdas.json',
        spec: {
          'schema-version': '2025-09-25',
          zambdas: { 'ENV-ZAMBDA': { name: 'env', type: 'cron' } },
        },
      };

      const schema = new Schema20250925([baseSpec, envSpec], {}, '/out', '/zambdas');
      expect(Object.keys(schema.resources.zambdas)).toEqual(['BASE-ZAMBDA', 'ENV-ZAMBDA']);
    });

    it('throws error when app key exists in multiple spec files', () => {
      const spec1 = {
        path: 'apps1.json',
        spec: {
          'schema-version': '2025-09-25',
          apps: { 'MY-APP': { name: 'my-app' } },
        },
      };
      const spec2 = {
        path: 'apps2.json',
        spec: {
          'schema-version': '2025-09-25',
          apps: { 'MY-APP': { name: 'my-app-duplicate' } },
        },
      };

      expect(() => new Schema20250925([spec1, spec2], {}, '/out', '/zambdas')).toThrow(
        'duplicate resource name "MY-APP"'
      );
    });
  });

  // NOTE: Schema version validation is done in generate-oystehr-resources.ts,
  // not in the Schema class itself. The Schema class trusts that all specs
  // passed to it have been pre-validated to have the same schema version.

  describe('multiple specs merge', () => {
    it('merges zambdas from multiple specs with same schema version', () => {
      const spec1 = {
        path: 'a.json',
        spec: { 'schema-version': '2025-09-25', zambdas: { A: { name: 'a' } } },
      };
      const spec2 = {
        path: 'b.json',
        spec: { 'schema-version': '2025-09-25', zambdas: { B: { name: 'b' } } },
      };

      const schema = new Schema20250925([spec1, spec2], {}, '/out', '/zambdas');
      expect(Object.keys(schema.resources.zambdas)).toEqual(['A', 'B']);
    });
  });

  describe('unknown key detection', () => {
    it('throws error when spec has unknown top-level key', () => {
      const spec = {
        path: 'bad.json',
        spec: {
          'schema-version': '2025-09-25',
          zambdas: {},
          unknownKey: {},
        },
      };

      expect(() => new Schema20250925([spec], {}, '/out', '/zambdas')).toThrow('unknown top-level key: unknownKey');
    });
  });

  describe('resource type validation', () => {
    it('throws error when spec has no resource types', () => {
      const spec = {
        path: 'empty.json',
        spec: {
          'schema-version': '2025-09-25',
        },
      };

      expect(() => new Schema20250925([spec], {}, '/out', '/zambdas')).toThrow(
        'must have at least one of the following top-level keys'
      );
    });
  });
});
