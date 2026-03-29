import { describe, expect, it } from 'vitest';
import {
  addEmptyArrOperation,
  addOperation,
  addOrReplaceOperation,
  removeOperation,
  replaceOperation,
} from './operations';

describe('operations', () => {
  describe('addOperation', () => {
    it('should create an add operation', () => {
      const op = addOperation('/extension/-', { url: 'test', valueString: 'value' });
      expect(op).toEqual({ op: 'add', path: '/extension/-', value: { url: 'test', valueString: 'value' } });
    });
  });

  describe('removeOperation', () => {
    it('should create a remove operation', () => {
      const op = removeOperation('/extension/0');
      expect(op).toEqual({ op: 'remove', path: '/extension/0' });
    });
  });

  describe('addEmptyArrOperation', () => {
    it('should create an add operation with empty array', () => {
      const op = addEmptyArrOperation('/extension');
      expect(op).toEqual({ op: 'add', path: '/extension', value: [] });
    });
  });

  describe('addOrReplaceOperation', () => {
    it('should create add operation when existing value is undefined', () => {
      const op = addOrReplaceOperation(undefined, '/status', 'active');
      expect(op.op).toBe('add');
      expect(op.path).toBe('/status');
      expect((op as any).value).toBe('active');
    });

    it('should create replace operation when existing value is defined', () => {
      const op = addOrReplaceOperation('old-value', '/status', 'active');
      expect(op.op).toBe('replace');
      expect(op.path).toBe('/status');
      expect((op as any).value).toBe('active');
    });

    it('should create replace when existing value is falsy but defined', () => {
      const op = addOrReplaceOperation(0, '/count', 1);
      expect(op.op).toBe('replace');
    });

    it('should create replace when existing value is empty string', () => {
      const op = addOrReplaceOperation('', '/name', 'John');
      expect(op.op).toBe('replace');
    });
  });

  describe('replaceOperation', () => {
    it('should create a replace operation', () => {
      const op = replaceOperation('/status', 'completed');
      expect(op).toEqual({ op: 'replace', path: '/status', value: 'completed' });
    });
  });
});
