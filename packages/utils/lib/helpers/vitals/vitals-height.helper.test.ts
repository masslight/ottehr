import { describe, expect, it } from 'vitest';
import { formatHeightObservationValue, HeightMeasurement } from './vitals-height.helper';

describe('HeightMeasurement precision', () => {
  it('keeps fine precision for storage and coarse for display (no round-trip drift)', () => {
    const height = HeightMeasurement.fromInches(66.75);
    expect(height.getCm()).toBe(169.54); // saved (2 decimals)
    expect(height.getCm(1)).toBe(169.5); // displayed (1 decimal)
    expect(height.getInches()).toBe(66.75); // round-trips back exactly
  });

  it('round-trips inches through cm storage', () => {
    const stored = HeightMeasurement.fromInches(66.75).getCm();
    expect(HeightMeasurement.fromCm(stored).getInches()).toBe(66.75);
  });
});

describe('HeightMeasurement feet/inches decomposition', () => {
  it('decomposes 69 inches to 5 ft 9 in', () => {
    const height = HeightMeasurement.fromInches(69);
    expect(height.getFeet()).toBe(5);
    expect(height.getInchRemainder()).toBe(9);
  });

  it('decomposes 132 cm to 4 ft 4 in', () => {
    const height = HeightMeasurement.fromCm(132);
    expect(height.getFeet()).toBe(4);
    expect(height.getInchRemainder()).toBe(4);
  });

  it('decomposes 130 cm to 4 ft 3 in after snapping to the nearest half inch', () => {
    const height = HeightMeasurement.fromCm(130);
    expect(height.getFeet()).toBe(4);
    expect(height.getInchRemainder()).toBe(3);
  });

  it('carries to the next foot when inches snap to a multiple of 12', () => {
    const height = HeightMeasurement.fromInches(71.8);
    expect(height.getFeet()).toBe(6);
    expect(height.getInchRemainder()).toBe(0);
  });

  it('preserves 5 ft 9 in through cm storage', () => {
    const stored = HeightMeasurement.fromFeetInches(5, 9).getCm();
    const height = HeightMeasurement.fromCm(stored);
    expect(height.getFeet()).toBe(5);
    expect(height.getInchRemainder()).toBe(9);
  });
});

describe('HeightMeasurement half-inch snapping (.25 / .50 / .75 ties round up)', () => {
  const cases: Array<{ inches: number; feet: number; inchRemainder: number }> = [
    { inches: 60.25, feet: 5, inchRemainder: 0.5 }, // .25 -> up to .5
    { inches: 60.5, feet: 5, inchRemainder: 0.5 }, // .50 -> stays
    { inches: 60.75, feet: 5, inchRemainder: 1 }, // .75 -> up to next whole
  ];

  it.each(cases)('$inches in -> $feet ft $inchRemainder in', ({ inches, feet, inchRemainder }) => {
    const height = HeightMeasurement.fromInches(inches);
    expect(height.getFeet()).toBe(feet);
    expect(height.getInchRemainder()).toBe(inchRemainder);
  });
});

describe('height labels', () => {
  it('formats the feet-inches label with half inches', () => {
    expect(HeightMeasurement.fromFeetInches(5, 6.5).getFeetInchesLabel()).toBe(`5'6.5"`);
  });

  it('formats the full observation value line', () => {
    expect(formatHeightObservationValue(132)).toBe(`132 cm = 51.97 in = 4'4"`);
  });
});
