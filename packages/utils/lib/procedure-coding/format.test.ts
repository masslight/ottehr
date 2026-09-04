import { describe, expect, it } from 'vitest';
import { formatInfusionTimeRange, repairDepthDisplayLabel } from './format';

describe('procedure coding display formatting', () => {
  it('formats known and unknown repair-depth values', () => {
    expect(repairDepthDisplayLabel('subcutaneous-layered')).toBe('Subcutaneous — layered closure');
    expect(repairDepthDisplayLabel('legacy-unknown-depth')).toBe('legacy-unknown-depth');
  });

  it.each([
    ['a normal range', '14:05', '14:47', '14:05–14:47 (42 min)'],
    ['a range crossing midnight', '23:50', '00:20', '23:50–00:20 (30 min)'],
    ['a zero-length range', '14:05', '14:05', '14:05–14:05 (0 min)'],
    ['a malformed endpoint', '14:05', '2:5 pm', '14:05–2:5 pm'],
    ['only a start time', '14:05', undefined, '14:05–'],
  ])('formats %s', (_case, start, stop, expected) => {
    expect(formatInfusionTimeRange(start, stop)).toBe(expected);
  });
});
