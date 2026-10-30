import { describe, expect, it } from 'vitest';
import { buildVitalTrends, getAxisTicks, getLatestChange } from '../../src/features/past-visits/vitals-trend.helpers';

const vitals = [
  { appointmentId: 'b', date: '2026-06-12T15:00:00.000Z', heartRateBpm: 88, weightKg: 30, heightCm: 130 },
  { appointmentId: 'a', date: '2026-01-05T15:00:00.000Z', heartRateBpm: 92, weightKg: 28.5 },
  { appointmentId: 'c', date: '2026-10-02T15:00:00.000Z', heightCm: 132.1 },
];

describe('buildVitalTrends', () => {
  it('orders each series chronologically and skips visits where the vital was not taken', () => {
    const [heartRate, weight, height] = buildVitalTrends(vitals, 'metric');

    expect(heartRate.points.map((point) => point.appointmentId)).toEqual(['a', 'b']);
    expect(weight.points.map((point) => point.value)).toEqual([28.5, 30]);
    expect(height.points.map((point) => point.appointmentId)).toEqual(['b', 'c']);
  });

  it('converts weight to pounds and labels height in feet and inches for US units', () => {
    const [, weight, height] = buildVitalTrends(vitals, 'us');

    expect(weight.unit).toBe('lb');
    expect(weight.points[1].value).toBe(66.1);
    expect(height.unit).toBe('in');
    expect(height.points[0].value).toBe(51.2);
    expect(height.points[0].valueLabel).toBe(`4'3"`);
  });
});

describe('getLatestChange', () => {
  it('compares the two most recent readings', () => {
    const [heartRate] = buildVitalTrends(vitals, 'metric');
    expect(getLatestChange(heartRate)).toEqual({ amount: -4, sinceDateLabel: 'Jan 5, 2026' });
  });

  it('has nothing to compare with a single reading', () => {
    const [heartRate] = buildVitalTrends([vitals[0]], 'metric');
    expect(getLatestChange(heartRate)).toBeUndefined();
  });
});

describe('getAxisTicks', () => {
  it.each([[[62, 70, 88, 92]], [[70, 110]], [[28.5, 30]], [[72, 72]], [[130, 132.1]]])(
    'returns three evenly spaced ticks covering %j',
    (values) => {
      const ticks = getAxisTicks(values);
      expect(ticks).toHaveLength(3);
      expect(ticks[1] - ticks[0]).toBeCloseTo(ticks[2] - ticks[1]);
      expect(ticks[0]).toBeLessThanOrEqual(Math.min(...values));
      expect(ticks[2]).toBeGreaterThanOrEqual(Math.max(...values));
    }
  );
});
