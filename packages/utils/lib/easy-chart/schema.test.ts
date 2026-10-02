import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { actionBranchesOf, buildResponseSchema, findNumberTypedFields, toWire } from './schema';

describe('findNumberTypedFields', () => {
  it('finds a number anywhere in a schema, so the guard cannot be bypassed by nesting', () => {
    expect(findNumberTypedFields({ type: 'object', properties: { a: { type: 'number' } } })).toEqual([
      '$.properties.a',
    ]);
    expect(findNumberTypedFields({ type: 'object', properties: { a: { type: 'string' } } })).toEqual([]);
  });
});

describe('never offers a kind a field it does not declare', () => {
  it('leaves undeclared fields off a branch', () => {
    const branches = actionBranchesOf(buildResponseSchema());
    expect(branches['add-diagnosis'].properties.text).toBeUndefined();
    expect(branches['set-disposition'].properties.display).toBeUndefined();
  });
});

describe('toWire refuses the constructs behind traps 1 and 2 at build time', () => {
  it('refuses z.number()', () => {
    expect(() => toWire(z.object({ value: z.number() }))).toThrow(/trap 1/);
  });
  it('refuses an uncapped string', () => {
    expect(() => toWire(z.object({ text: z.string() }))).toThrow(/trap 2/);
  });
  it('serializes a guarded number as a capped string', () => {
    expect(actionBranchesOf(buildResponseSchema())['set-disposition'].properties.followUpInDays).toEqual({
      type: 'string',
      maxLength: 60,
    });
  });
  it('serializes a closed vocabulary as an enum', () => {
    expect(actionBranchesOf(buildResponseSchema())['set-vital'].properties.field).toEqual({
      type: 'string',
      enum: [
        'vital-temperature',
        'vital-heartbeat',
        'vital-respiration-rate',
        'vital-oxygen-sat',
        'vital-blood-pressure',
        'vital-weight',
        'vital-height',
      ],
    });
  });
});

// Trap 2: every string must carry a bound, including the ones nested in arrays.
describe('every string field is length-capped', () => {
  const uncapped = (schema: unknown, path = '$'): string[] => {
    if (schema == null || typeof schema !== 'object') return [];
    const node = schema as Record<string, unknown>;
    const found: string[] = [];
    // An enum is bounded by its own member list, so it needs no maxLength.
    if (node.type === 'string' && node.maxLength == null && !Array.isArray(node.enum)) found.push(path);
    for (const [key, value] of Object.entries(node)) {
      if (value && typeof value === 'object') found.push(...uncapped(value, `${path}.${key}`));
    }
    return found;
  };

  it('across the response schema', () => {
    expect(uncapped(buildResponseSchema())).toEqual([]);
  });
});
