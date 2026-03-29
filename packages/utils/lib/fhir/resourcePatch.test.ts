import { AddOperation, ReplaceOperation } from 'fast-json-patch';
import { Resource } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  getPatchBinary,
  getPatchOperationForNewMetaTag,
  getPatchOperationsForNewMetaTags,
  getPatchOperationToRemoveMetaTags,
  getPatchOperationToUpdateExtension,
  normalizePhoneNumber,
} from './resourcePatch';

describe('resourcePatch', () => {
  describe('getPatchBinary', () => {
    it('should create a PATCH request with encoded operations', () => {
      const result = getPatchBinary({
        resourceId: 'enc-123',
        resourceType: 'Encounter',
        patchOperations: [{ op: 'replace', path: '/status', value: 'finished' }],
      });
      expect(result.method).toBe('PATCH');
      expect(result.url).toBe('/Encounter/enc-123');
      expect('resource' in result).toBe(true);
      if ('resource' in result) {
        expect(result.resource.resourceType).toBe('Binary');
        expect(result.resource.contentType).toBe('application/json-patch+json');
        const decoded = JSON.parse(decodeURIComponent(escape(atob(result.resource.data!))));
        expect(decoded).toEqual([{ op: 'replace', path: '/status', value: 'finished' }]);
      }
    });
  });

  describe('getPatchOperationForNewMetaTag', () => {
    const newTag = { system: 'http://example.com', code: 'test-code' };

    it('should add /meta when resource has no meta', () => {
      const resource = { resourceType: 'Patient' } as Resource;
      const op = getPatchOperationForNewMetaTag(resource, newTag);
      expect(op.op).toBe('add');
      expect(op.path).toBe('/meta');
      if (op.op === 'add') {
        expect(op.value).toEqual({ tag: [{ system: 'http://example.com', code: 'test-code' }] });
      }
    });

    it('should add /meta/tag when resource has meta but no tags', () => {
      const resource = { resourceType: 'Patient', meta: {} } as Resource;
      const op = getPatchOperationForNewMetaTag(resource, newTag);
      expect(op.op).toBe('add');
      expect(op.path).toBe('/meta/tag');
      if (op.op === 'add') {
        expect(op.value).toEqual([{ system: 'http://example.com', code: 'test-code' }]);
      }
    });

    it('should replace existing tag with same system', () => {
      const resource = {
        resourceType: 'Patient',
        meta: { tag: [{ system: 'http://example.com', code: 'old-code' }] },
      } as Resource;
      const op = getPatchOperationForNewMetaTag(resource, newTag);
      expect(op.op).toBe('replace');
      expect(op.path).toBe('/meta/tag/0/code');
      if (op.op === 'replace') {
        expect(op.value).toBe('test-code');
      }
    });

    it('should append tag when no existing tag with same system', () => {
      const resource = {
        resourceType: 'Patient',
        meta: { tag: [{ system: 'http://other.com', code: 'other' }] },
      } as Resource;
      const op = getPatchOperationForNewMetaTag(resource, newTag);
      expect(op.op).toBe('add');
      expect(op.path).toBe('/meta/tag/-');
      if (op.op === 'add') {
        expect(op.value).toEqual(newTag);
      }
    });
  });

  describe('getPatchOperationsForNewMetaTags', () => {
    const newTags = [
      { system: 'http://sys1.com', code: 'code1' },
      { system: 'http://sys2.com', code: 'code2' },
    ];

    it('should add /meta when resource has no meta', () => {
      const resource = { resourceType: 'Patient' } as Resource;
      const ops = getPatchOperationsForNewMetaTags(resource, newTags);
      expect(ops).toHaveLength(1);
      expect(ops[0].op).toBe('add');
      expect(ops[0].path).toBe('/meta');
      const addOp = ops[0] as AddOperation<unknown>;
      expect(addOp.value).toEqual({ tag: newTags });
    });

    it('should add /meta/tag when resource has meta but no tags', () => {
      const resource = { resourceType: 'Patient', meta: {} } as Resource;
      const ops = getPatchOperationsForNewMetaTags(resource, newTags);
      expect(ops).toHaveLength(1);
      expect(ops[0].op).toBe('add');
      expect(ops[0].path).toBe('/meta/tag');
      const addOp = ops[0] as AddOperation<unknown>;
      expect(addOp.value).toEqual(newTags);
    });

    it('should replace tags, filtering out ones with same system', () => {
      const resource = {
        resourceType: 'Patient',
        meta: {
          tag: [
            { system: 'http://sys1.com', code: 'old' },
            { system: 'http://keep.com', code: 'keep' },
          ],
        },
      } as Resource;
      const ops = getPatchOperationsForNewMetaTags(resource, newTags);
      expect(ops).toHaveLength(1);
      expect(ops[0].op).toBe('replace');
      expect(ops[0].path).toBe('/meta/tag');
      const replaceOp = ops[0] as ReplaceOperation<unknown>;
      expect(replaceOp.value).toEqual([{ system: 'http://keep.com', code: 'keep' }, ...newTags]);
    });
  });

  describe('getPatchOperationToRemoveMetaTags', () => {
    const tagsToRemove = [{ system: 'http://sys1.com', code: 'code1' }];

    it('should add empty meta when resource has no meta', () => {
      const resource = { resourceType: 'Patient' } as Resource;
      const op = getPatchOperationToRemoveMetaTags(resource, tagsToRemove);
      expect(op.op).toBe('add');
      expect(op.path).toBe('/meta');
      if (op.op === 'add') {
        expect(op.value).toEqual({ tag: [] });
      }
    });

    it('should add empty tag array when resource has no tags', () => {
      const resource = { resourceType: 'Patient', meta: {} } as Resource;
      const op = getPatchOperationToRemoveMetaTags(resource, tagsToRemove);
      expect(op.op).toBe('add');
      expect(op.path).toBe('/meta/tag');
      if (op.op === 'add') {
        expect(op.value).toEqual([]);
      }
    });

    it('should filter out matching tags', () => {
      const resource = {
        resourceType: 'Patient',
        meta: {
          tag: [
            { system: 'http://sys1.com', code: 'code1' },
            { system: 'http://keep.com', code: 'keep' },
          ],
        },
      } as Resource;
      const op = getPatchOperationToRemoveMetaTags(resource, tagsToRemove);
      expect(op.op).toBe('replace');
      expect(op.path).toBe('/meta/tag');
      if (op.op === 'replace') {
        expect(op.value).toEqual([{ system: 'http://keep.com', code: 'keep' }]);
      }
    });
  });

  describe('getPatchOperationToUpdateExtension', () => {
    it('should add /extension when resource has no extensions', () => {
      const resource = {};
      const op = getPatchOperationToUpdateExtension(resource, {
        url: 'http://ext.com/test',
        valueString: 'hello',
      });
      expect(op).toBeDefined();
      expect(op!.op).toBe('add');
      expect(op!.path).toBe('/extension');
      const addOp = op as AddOperation<unknown>;
      expect(addOp.value).toEqual([{ url: 'http://ext.com/test', valueString: 'hello' }]);
    });

    it('should replace extension when existing value differs', () => {
      const resource = {
        extension: [{ url: 'http://ext.com/test', valueString: 'old' }],
      };
      const op = getPatchOperationToUpdateExtension(resource, {
        url: 'http://ext.com/test',
        valueString: 'new',
      });
      expect(op?.op).toBe('replace');
      expect(op?.path).toBe('/extension');
    });

    it('should return undefined when value has not changed', () => {
      const resource = {
        extension: [{ url: 'http://ext.com/test', valueString: 'same' }],
      };
      const op = getPatchOperationToUpdateExtension(resource, {
        url: 'http://ext.com/test',
        valueString: 'same',
      });
      expect(op).toBeUndefined();
    });

    it('should add new extension when url not found', () => {
      const resource = {
        extension: [{ url: 'http://ext.com/other', valueString: 'x' }],
      };
      const op = getPatchOperationToUpdateExtension(resource, {
        url: 'http://ext.com/new',
        valueBoolean: true,
      });
      expect(op?.op).toBe('replace');
      expect(op?.path).toBe('/extension');
    });
  });

  describe('normalizePhoneNumber', () => {
    it('should normalize 10-digit US number', () => {
      expect(normalizePhoneNumber('2125551234')).toBe('+12125551234');
    });

    it('should normalize 11-digit US number starting with 1', () => {
      expect(normalizePhoneNumber('12125551234')).toBe('+12125551234');
    });

    it('should strip non-digit characters', () => {
      expect(normalizePhoneNumber('(212) 555-1234')).toBe('+12125551234');
    });

    it('should return empty string for undefined', () => {
      expect(normalizePhoneNumber(undefined)).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(normalizePhoneNumber('')).toBe('');
    });
  });
});
