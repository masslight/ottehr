import { describe, expect, it } from 'vitest';
import { sentenceValue } from './sentenceValue';

describe('sentenceValue', () => {
  it.each([
    ['Tolerated Well', 'tolerated well'],
    ['IV and EKG', 'IV and EKG'],
    ['McBurney', 'McBurney'],
    ['5-10 min', '5-10 min'],
    ['4-0 Nylon', '4-0 nylon'],
    ['', ''],
  ])('formats %s as %s', (value, expected) => {
    expect(sentenceValue(value)).toBe(expected);
  });
});
