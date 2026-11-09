import { describe, expect, it } from 'vitest';
import { getSmsSegmentInfo } from './sms-segment-info';

describe('SMS editor segment estimate', () => {
  it.each([
    [160, 1],
    [161, 2],
    [306, 2],
    [307, 3],
  ])('estimates %i ordinary ASCII characters as %i segments', (length, segments) => {
    expect(getSmsSegmentInfo('a'.repeat(length))).toEqual({ charCount: length, segments, encoding: 'GSM-7' });
  });

  it.each(['|', '^', '{', '}', '[', ']', '~', '\\'])(
    'counts %s as two GSM slots at a segment boundary',
    (character) => {
      expect(getSmsSegmentInfo('a'.repeat(159) + character)).toEqual({
        charCount: 161,
        segments: 2,
        encoding: 'GSM-7',
      });
    }
  );

  it.each([
    [70, 1],
    [71, 2],
    [134, 2],
    [135, 3],
  ])('retains the EHR Unicode estimate for %i characters', (length, segments) => {
    expect(getSmsSegmentInfo('漢'.repeat(length))).toEqual({ charCount: length, segments, encoding: 'UCS-2' });
  });

  it('keeps line breaks in the GSM estimate', () => {
    expect(getSmsSegmentInfo('a\nb\r\nc\t')).toEqual({ charCount: 7, segments: 1, encoding: 'GSM-7' });
  });
});
