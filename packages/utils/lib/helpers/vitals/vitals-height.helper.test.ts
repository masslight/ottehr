import { describe, expect, it } from 'vitest';
import {
  feetInchesToCm,
  formatHeightFeetInchesLabel,
  formatHeightObservationValue,
  heightCmToFeetInches,
  inchesToCm,
  roundToNearestHalf,
} from './vitals-height.helper';

describe('roundToNearestHalf', () => {
  it('rounds to the nearest 0.5', () => {
    expect(roundToNearestHalf(6.3)).toBe(6.5);
    expect(roundToNearestHalf(3.2)).toBe(3);
    expect(roundToNearestHalf(11.8)).toBe(12);
  });
});

describe('heightCmToFeetInches', () => {
  it('decomposes 69 inches entry to 5 ft 9 in', () => {
    expect(heightCmToFeetInches(inchesToCm(69))).toMatchObject({ feet: 5, inchRemainder: 9 });
  });

  it('decomposes 132 cm to 4 ft 4 in', () => {
    expect(heightCmToFeetInches(132)).toMatchObject({ totalInches: 52, feet: 4, inchRemainder: 4 });
  });

  it('decomposes 130 cm to 4 ft 3 in after total-inch snap to 0.5', () => {
    expect(heightCmToFeetInches(130)).toMatchObject({ feet: 4, inchRemainder: 3 });
  });

  it('carries to the next foot when total inches round to a multiple of 12', () => {
    const heightCm = inchesToCm(71.8);
    expect(heightCmToFeetInches(heightCm)).toMatchObject({ feet: 6, inchRemainder: 0 });
  });
});

describe('feetInchesToCm round-trip', () => {
  it('preserves 5 ft 9 in through cm storage', () => {
    const cm = feetInchesToCm(5, 9);
    expect(heightCmToFeetInches(cm)).toMatchObject({ feet: 5, inchRemainder: 9 });
  });
});

describe('height display formatting', () => {
  it('formats feet-inches label with half inches', () => {
    expect(formatHeightFeetInchesLabel(5, 6.5)).toBe(`5'6.5"`);
  });

  it('formats full observation value line', () => {
    expect(formatHeightObservationValue(132)).toBe(`132 cm = 52 in = 4'4"`);
  });
});
