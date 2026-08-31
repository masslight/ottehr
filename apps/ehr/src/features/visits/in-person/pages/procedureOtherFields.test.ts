import { describe, expect, it } from 'vitest';
import {
  combineMultipleValuesForSave,
  getPredefinedValueIfOther,
  getPredefinedValueOrOther,
  mergeOtherFromQuickPick,
  OTHER,
  parseWithOther,
  splitOtherForQuickPick,
} from './procedureOtherFields';

const VALID_SUPPLIES = ['Suture Kit', 'Gauze', 'Forceps', OTHER];

describe('combineMultipleValuesForSave', () => {
  it('returns undefined when there are no values and no other text', () => {
    expect(combineMultipleValuesForSave([], undefined)).toBeUndefined();
    expect(combineMultipleValuesForSave(undefined, undefined)).toBeUndefined();
  });

  it('joins plain options with commas', () => {
    expect(combineMultipleValuesForSave(['Suture Kit', 'Gauze'], undefined)).toBe('Suture Kit, Gauze');
  });

  // Regression: the "Other: <text>" entry must always be serialized LAST, regardless of where
  // "Other" sits in the array — otherwise parseWithOther swallows any option that follows it.
  it('always serializes "Other: <text>" last even when selected first', () => {
    expect(combineMultipleValuesForSave([OTHER, 'Suture Kit'], 'bbb')).toBe('Suture Kit, Other: bbb');
    expect(combineMultipleValuesForSave(['Suture Kit', OTHER], 'bbb')).toBe('Suture Kit, Other: bbb');
  });

  it('"Other" should be moved to last, even when there is no additional other text sent', () => {
    expect(combineMultipleValuesForSave([OTHER, 'Suture Kit'], '  ')).toBe('Suture Kit, Other');
  });

  it('"Other" is not striped when undefined is sent as otherValue', () => {
    const saved = combineMultipleValuesForSave([OTHER], undefined);
    expect(parseWithOther(saved, VALID_SUPPLIES)).toEqual({ values: [OTHER] });
  });
});

describe('parseWithOther', () => {
  it('parses plain options', () => {
    expect(parseWithOther('Suture Kit, Gauze', VALID_SUPPLIES)).toEqual({
      values: ['Suture Kit', 'Gauze'],
      other: undefined,
    });
  });

  it('parses a trailing "Other: <text>" into the other field', () => {
    expect(parseWithOther('Suture Kit, Other: bbb', VALID_SUPPLIES)).toEqual({
      values: ['Suture Kit', OTHER],
      other: 'bbb',
    });
  });

  it('drops options that are not in the valid set', () => {
    expect(parseWithOther('Suture Kit, Unknown', VALID_SUPPLIES)).toEqual({ values: ['Suture Kit'], other: undefined });
  });
});

describe('combine -> parse round-trip (procedure save then reload)', () => {
  // The original bug: choosing "Other" before a real option produced "Other: bbb, Suture Kit",
  // and reload absorbed "Suture Kit" into the free text. This guards the full round-trip.
  it('preserves a real option selected after "Other"', () => {
    const saved = combineMultipleValuesForSave([OTHER, 'Suture Kit'], 'bbb');
    expect(parseWithOther(saved, VALID_SUPPLIES)).toEqual({ values: ['Suture Kit', OTHER], other: 'bbb' });
  });

  it('preserves multiple real options plus "Other"', () => {
    const saved = combineMultipleValuesForSave(['Gauze', OTHER, 'Suture Kit'], 'bbb');
    expect(parseWithOther(saved, VALID_SUPPLIES)).toEqual({ values: ['Gauze', 'Suture Kit', OTHER], other: 'bbb' });
  });

  it('round-trips when only "Other" is selected', () => {
    const saved = combineMultipleValuesForSave([OTHER], 'bbb');
    expect(parseWithOther(saved, VALID_SUPPLIES)).toEqual({ values: [OTHER], other: 'bbb' });
  });
});

describe('splitOtherForQuickPick (build) and mergeOtherFromQuickPick (apply)', () => {
  it('stores only real options plus separate other text', () => {
    expect(splitOtherForQuickPick(['Suture Kit', OTHER], 'bbb')).toEqual({ values: ['Suture Kit'], other: 'bbb' });
  });

  it('omits other text when "Other" is not selected', () => {
    expect(splitOtherForQuickPick(['Suture Kit'], 'bbb')).toEqual({ values: ['Suture Kit'], other: undefined });
  });

  it('re-adds the "Other" chip on apply when other text is present', () => {
    expect(mergeOtherFromQuickPick(['Suture Kit'], 'bbb')).toEqual(['Suture Kit', OTHER]);
  });

  it('does not add the "Other" chip when there is no other text', () => {
    expect(mergeOtherFromQuickPick(['Suture Kit'], undefined)).toEqual(['Suture Kit']);
  });

  it('round-trips build -> apply without duplicating "Other"', () => {
    const stored = splitOtherForQuickPick(['Suture Kit', OTHER], 'bbb');
    expect(mergeOtherFromQuickPick(stored.values, stored.other)).toEqual(['Suture Kit', OTHER]);
  });
});

describe('single-select getPredefinedValueOrOther / getPredefinedValueIfOther', () => {
  it('keeps a predefined value as-is', () => {
    expect(getPredefinedValueOrOther('Gauze', VALID_SUPPLIES)).toBe('Gauze');
    expect(getPredefinedValueIfOther('Gauze', VALID_SUPPLIES)).toBeUndefined();
  });

  it('maps a free-text value to "Other" plus the captured text', () => {
    expect(getPredefinedValueOrOther('aaa', VALID_SUPPLIES)).toBe(OTHER);
    expect(getPredefinedValueIfOther('aaa', VALID_SUPPLIES)).toBe('aaa');
  });

  it('returns undefined for a missing value', () => {
    expect(getPredefinedValueOrOther(undefined, VALID_SUPPLIES)).toBeUndefined();
    expect(getPredefinedValueIfOther(undefined, VALID_SUPPLIES)).toBeUndefined();
  });
});
