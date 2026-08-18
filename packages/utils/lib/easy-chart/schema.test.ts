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
    expect(item.properties.actions).toEqual((buildResponseSchema('review').properties as any).actions);
  });
});
