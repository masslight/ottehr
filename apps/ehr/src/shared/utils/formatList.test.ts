import { describe, expect, it } from 'vitest';
import { formatList } from './formatList';

describe('formatList', () => {
  it.each([
    { values: [], expected: '' },
    { values: ['Gauze'], expected: 'Gauze' },
    { values: ['Gauze', 'Tape'], expected: 'Gauze and Tape' },
    { values: ['Gauze', 'Tape', 'Gloves'], expected: 'Gauze, Tape and Gloves' },
  ])('joins $values without changing their text', ({ values, expected }) => {
    expect(formatList(values)).toBe(expected);
  });
  it('preserves ampersand wording for discharge actions', () => {
    expect(formatList(['Discharge', 'Print', 'Sign'], '&')).toBe('Discharge, Print & Sign');
  });
});
