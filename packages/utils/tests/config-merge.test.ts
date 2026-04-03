import { describe, expect, it } from 'vitest';
import { mergeAndFreezeConfigObjects } from '../lib/config-helpers/helpers';

describe('mergeAndFreezeConfigObjects', () => {
  it('partial override preserves unspecified base fields', () => {
    const base = { a: 1, b: 2, c: 3 };
    const override = { b: 20 };

    const result = mergeAndFreezeConfigObjects(base, override);

    expect(result).toEqual({ a: 1, b: 20, c: 3 });
  });

  it('array fields are replaced entirely, not concatenated', () => {
    const base = { items: [1, 2, 3], name: 'test' };
    const override = { items: [4, 5] };

    const result = mergeAndFreezeConfigObjects(base, override);

    expect(result.items).toEqual([4, 5]);
    expect(result.name).toBe('test');
  });

  it('nested object fields are deep merged', () => {
    const base = {
      outer: {
        a: 1,
        inner: { x: 10, y: 20 },
      },
    };
    const override = {
      outer: {
        inner: { y: 99 },
      },
    };

    const result = mergeAndFreezeConfigObjects(base, override);

    expect(result.outer.a).toBe(1);
    expect(result.outer.inner.x).toBe(10);
    expect(result.outer.inner.y).toBe(99);
  });

  it('result is frozen and mutations throw in strict mode', () => {
    const base = { a: 1, nested: { b: 2 } };
    const override = { a: 5 };

    const result = mergeAndFreezeConfigObjects(base, override);

    expect(Object.isFrozen(result)).toBe(true);
    expect(() => {
      (result as any).a = 100;
    }).toThrow();
    // Nested objects should also be frozen (deep freeze)
    expect(Object.isFrozen((result as any).nested)).toBe(true);
    expect(() => {
      (result as any).nested.b = 100;
    }).toThrow();
  });

  it('override with empty array replaces base array', () => {
    const base = { tags: ['alpha', 'beta', 'gamma'] };
    const override = { tags: [] as string[] };

    const result = mergeAndFreezeConfigObjects(base, override);

    expect(result.tags).toEqual([]);
  });

  it('null/undefined override values do not clobber base', () => {
    const base = { a: 'hello', b: 42, c: true };
    const override = { a: undefined, b: null };

    const result = mergeAndFreezeConfigObjects(base, override);

    // lodash mergeWith skips undefined source values
    expect(result.a).toBe('hello');
    // null is a valid value that replaces the base
    expect(result.b).toBeNull();
    expect(result.c).toBe(true);
  });
});
