import { describe, expect, it } from 'vitest';
import { arePropsEqualInObjects, dedupeObjectsByKey, dedupeObjectsByNestedKeys, deepFreezeObject } from './objects';

describe('objects', () => {
  describe('arePropsEqualInObjects', () => {
    it('should return true when all specified props match', () => {
      const obj1 = { a: 1, b: 'hello', c: true };
      const obj2 = { a: 1, b: 'hello', c: false };
      expect(arePropsEqualInObjects(obj1, obj2, ['a', 'b'])).toBe(true);
    });

    it('should return false when any specified prop differs', () => {
      const obj1 = { a: 1, b: 'hello' };
      const obj2 = { a: 1, b: 'world' };
      expect(arePropsEqualInObjects(obj1, obj2, ['a', 'b'])).toBe(false);
    });

    it('should return true for empty props array', () => {
      const obj1 = { a: 1 };
      const obj2 = { a: 2 };
      expect(arePropsEqualInObjects(obj1, obj2, [])).toBe(true);
    });
  });

  describe('deepFreezeObject', () => {
    it('should freeze top-level properties', () => {
      const obj = deepFreezeObject({ a: 1, b: 'hello' });
      expect(Object.isFrozen(obj)).toBe(true);
    });

    it('should freeze nested objects', () => {
      const input = { nested: { deep: { value: 42 } } };
      const obj = deepFreezeObject(input);
      expect(Object.isFrozen(obj)).toBe(true);
      expect(Object.isFrozen(obj.nested)).toBe(true);
      expect(Object.isFrozen(obj.nested.deep)).toBe(true);
    });

    it('should throw when modifying frozen object in strict mode', () => {
      'use strict';
      const obj = deepFreezeObject({ a: 1 }) as { a: number };
      expect(() => {
        obj.a = 2;
      }).toThrow();
    });
  });

  describe('dedupeObjectsByKey', () => {
    it('should deduplicate by specified key', () => {
      const arr = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 1, name: 'Alice Copy' },
      ];
      const result = dedupeObjectsByKey(arr, 'id');
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Alice');
    });

    it('should return empty array for empty input', () => {
      expect(dedupeObjectsByKey([], 'id' as never)).toEqual([]);
    });

    it('should keep first occurrence', () => {
      const arr = [
        { name: 'first', val: 1 },
        { name: 'second', val: 2 },
        { name: 'first', val: 3 },
      ];
      const result = dedupeObjectsByKey(arr, 'name');
      expect(result).toHaveLength(2);
      expect(result[0].val).toBe(1);
    });
  });

  describe('dedupeObjectsByNestedKeys', () => {
    it('should deduplicate by nested key path', () => {
      const arr = [{ data: { ref: { id: 'a' } } }, { data: { ref: { id: 'b' } } }, { data: { ref: { id: 'a' } } }];
      const result = dedupeObjectsByNestedKeys(arr, ['data', 'ref', 'id']);
      expect(result).toHaveLength(2);
    });

    it('should handle missing nested keys gracefully', () => {
      const arr = [{ data: { ref: { id: 'a' } } }, { data: {} }, { other: 'value' }];
      const result = dedupeObjectsByNestedKeys(arr, ['data', 'ref', 'id']);
      // 'a', undefined (from {}), undefined (from missing data) — the two undefineds dedupe
      expect(result).toHaveLength(2);
    });

    it('should return empty array for empty input', () => {
      expect(dedupeObjectsByNestedKeys([], ['a', 'b'])).toEqual([]);
    });
  });
});
