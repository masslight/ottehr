import { describe, expect, it } from 'vitest';
import { buildResponseSchema, buildReviewResponseSchema, coerceNumericFields, findNumberTypedFields } from './schema';

describe('coerceNumericFields', () => {
  it('restores the numeric contract the digit-loop guard removed', () => {
    const action: Record<string, unknown> = { value: '5.8', systolic: '122', diastolic: '78', followUpInDays: '7' };
    coerceNumericFields(action);
    expect(action).toEqual({ value: 5.8, systolic: 122, diastolic: 78, followUpInDays: 7 });
  });

  // A half-parsed value must behave exactly as if the model had omitted the field: deleting it makes
  // the required-fields gate reject the action honestly instead of charting NaN.
  it('deletes an empty or non-numeric value rather than charting NaN', () => {
    const action: Record<string, unknown> = { value: '', systolic: 'about 120', followUpInDays: 'a week' };
    coerceNumericFields(action);
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
    const plan = (buildResponseSchema('review').properties as any).actions;
    // Same action shape as the surface's own schema, with one deliberate difference — see below.
    expect(item.properties.actions.items.properties).toEqual(plan.items.properties);
  });

  // A diagnosis-swap card is a remove+add pair whose add must restate the removed diagnosis's primary
  // status, or the note ends with no primary at all. Leaving the boolean optional is what made the
  // model express primacy in prose instead — the `(primary) (primary) …` string loop of trap 3.
  it('REQUIRES isPrimary on every review action, so primacy is never expressed as prose', () => {
    const actions = (buildReviewResponseSchema().properties as any).suggestions.items.properties.actions;
    expect(actions.items.required).toEqual(['kind', 'isPrimary']);
    // And the plan surface is untouched: there the whole-plan invariant handles a missing primary.
    expect((buildResponseSchema('review').properties as any).actions.items.required).toEqual(['kind']);
  });
});

// TRAP 3. A capped string makes a repetition loop terminate inside a valid value instead of running to
// the output cap and destroying the response. Every string in the schema must carry a bound, including
// the ones nested in arrays and in the review card itself — a single uncapped field is enough.
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
    for (const surface of ['plan', 'review', 'template', 'findings', 'diagnoses', 'orders', 'coding'] as const) {
      expect(uncapped(buildResponseSchema(surface))).toEqual([]);
    }
  });

  it('across the review card schema, cards and nested arrays included', () => {
    expect(uncapped(buildReviewResponseSchema())).toEqual([]);
  });
});
