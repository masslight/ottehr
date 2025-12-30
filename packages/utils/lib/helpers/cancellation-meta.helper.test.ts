import { Meta } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { CANCELLATION_TAG_SYSTEM, createCancellationTagOperations } from './cancellation-meta.helper';

describe('cancellation-meta.helper', () => {
  describe('createCancellationTagOperations', () => {
    it('should create operations when no meta exists', () => {
      const operations = createCancellationTagOperations('active', undefined);

      expect(operations).toHaveLength(1);
      expect(operations[0]).toEqual({
        op: 'add',
        path: '/meta',
        value: {
          tag: [
            {
              system: CANCELLATION_TAG_SYSTEM,
              code: 'active',
              display: 'active',
            },
          ],
        },
      });
    });

    it('should create operations when meta exists but no tags', () => {
      const meta: Meta = {
        versionId: '1',
      };

      const operations = createCancellationTagOperations('completed', meta);

      expect(operations).toHaveLength(1);
      expect(operations[0]).toEqual({
        op: 'add',
        path: '/meta/tag',
        value: [
          {
            system: CANCELLATION_TAG_SYSTEM,
            code: 'completed',
            display: 'completed',
          },
        ],
      });
    });

    it('should create operations when meta and tags exist', () => {
      const meta: Meta = {
        versionId: '1',
        tag: [
          {
            system: 'http://example.com',
            code: 'existing-tag',
          },
        ],
      };

      const operations = createCancellationTagOperations('in-progress', meta);

      expect(operations).toHaveLength(1);
      expect(operations[0]).toEqual({
        op: 'add',
        path: '/meta/tag/-',
        value: {
          system: CANCELLATION_TAG_SYSTEM,
          code: 'in-progress',
          display: 'in-progress',
        },
      });
    });

    it('should handle empty tags array', () => {
      const meta: Meta = {
        tag: [],
      };

      const operations = createCancellationTagOperations('draft', meta);

      expect(operations).toHaveLength(1);
      expect(operations[0]).toEqual({
        op: 'add',
        path: '/meta/tag',
        value: [
          {
            system: CANCELLATION_TAG_SYSTEM,
            code: 'draft',
            display: 'draft',
          },
        ],
      });
    });

    it('should preserve different status values', () => {
      const statuses = ['active', 'completed', 'in-progress', 'stopped-unsafe', 'revoked', 'entered-in-error'];

      statuses.forEach((status) => {
        const operations = createCancellationTagOperations(status, undefined);
        const operation = operations[0] as {
          op: 'add';
          path: string;
          value: { tag: Array<{ code: string; display: string }> };
        };
        expect(operation.value.tag[0].code).toBe(status);
        expect(operation.value.tag[0].display).toBe(status);
      });
    });
  });
});
