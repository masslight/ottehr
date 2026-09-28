import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { SURFACES } from './actions';
import {
  actionBranchesOf,
  buildResponseSchema,
  buildReviewResponseSchema,
  coerceNumericFields,
  findNumberTypedFields,
  toWire,
} from './schema';

describe('coerceNumericFields', () => {
  it('restores the numeric contract the digit-loop guard removed', () => {
    const action: Record<string, unknown> = { followUpInDays: '7', display: 'x' };
    coerceNumericFields(action);
    expect(action).toEqual({ followUpInDays: 7, display: 'x' });
  });

  it('deletes an empty or non-numeric value rather than charting NaN', () => {
    const action: Record<string, unknown> = { value: '', systolic: 'about 120', followUpInDays: 'a week' };
    coerceNumericFields(action, ['value', 'systolic', 'followUpInDays']);
    expect(action).toEqual({});
  });

  it('leaves already-numeric and unrelated fields alone', () => {
    const action: Record<string, unknown> = { value: 7, display: '100.4 F', isPrimary: true };
    coerceNumericFields(action);
    expect(action).toEqual({ value: 7, display: '100.4 F', isPrimary: true });
  });

  it('honours an explicit field list', () => {
    const action: Record<string, unknown> = { score: '88', value: '5' };
    coerceNumericFields(action, ['score']);
    expect(action).toEqual({ score: 88, value: '5' });
  });
});

describe('findNumberTypedFields', () => {
  it('finds a number anywhere in a schema, so the guard cannot be bypassed by nesting', () => {
    expect(findNumberTypedFields({ type: 'object', properties: { a: { type: 'number' } } })).toEqual([
      '$.properties.a',
    ]);
    expect(findNumberTypedFields({ type: 'object', properties: { a: { type: 'string' } } })).toEqual([]);
  });
});

describe('review response schema', () => {
  it('declares no numeric field', () => {
    expect(findNumberTypedFields(buildReviewResponseSchema())).toEqual([]);
  });

  it('carries its own actions[] on every suggestion, so accepting one needs no new charting logic', () => {
    const item = (buildReviewResponseSchema().properties as any).suggestions.items;
    expect(item.required).toContain('actions');
    expect(item.properties.actions).toEqual((buildResponseSchema('review').properties as any).actions);
  });

  it('REQUIRES isPrimary on the review add-diagnosis branch only', () => {
    const review = actionBranchesOf(buildResponseSchema('review'));
    expect(review['add-diagnosis'].required).toContain('isPrimary');
    expect(review['remove-diagnosis'].required).toEqual(['kind', 'display']);
    expect(actionBranchesOf(buildResponseSchema('plan'))['add-diagnosis'].required).toEqual(['kind', 'display']);
  });

  it('never offers a kind a field it does not declare', () => {
    const review = actionBranchesOf(buildResponseSchema('review'));
    expect(review['add-diagnosis'].properties.text).toBeUndefined();
    expect(review['set-disposition'].properties.display).toBeUndefined();
  });
});

describe('toWire refuses the constructs behind traps 1 and 3 at build time', () => {
  it('refuses z.number()', () => {
    expect(() => toWire(z.object({ value: z.number() }))).toThrow(/trap 1/);
  });
  it('refuses an uncapped string', () => {
    expect(() => toWire(z.object({ text: z.string() }))).toThrow(/trap 3/);
  });
  it('serializes a guarded number as a capped string', () => {
    expect(actionBranchesOf(buildResponseSchema('plan'))['set-disposition'].properties.followUpInDays).toEqual({
      type: 'string',
      maxLength: 60,
    });
  });
  it('serializes a closed vocabulary as an enum', () => {
    expect(actionBranchesOf(buildResponseSchema('plan'))['set-vital'].properties.field).toEqual({
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

// Trap 3: every string must carry a bound, including the ones nested in arrays and in the review card.
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

  it('across every surface schema', () => {
    for (const surface of SURFACES) {
      expect(uncapped(buildResponseSchema(surface))).toEqual([]);
    }
  });

  it('across the review card schema, cards and nested arrays included', () => {
    expect(uncapped(buildReviewResponseSchema())).toEqual([]);
  });
});
