import { DateTime } from 'luxon';
import { HeightMeasurement } from 'utils/lib/helpers/vitals/vitals-height.helper';
import { kgToLbs } from 'utils/lib/helpers/vitals/vitals-weight.helper';
import { PastVisitVitals } from 'utils/lib/types/data/appointments/appointments.types';

export type VitalsUnitSystem = 'us' | 'metric';

export type VitalTrendKind = 'heartRate' | 'weight' | 'height';

export interface VitalTrendPoint {
  appointmentId: string;
  date: string;
  dateLabel: string;
  value: number;
  valueLabel: string;
}

export interface VitalTrend {
  kind: VitalTrendKind;
  title: string;
  unit: string;
  points: VitalTrendPoint[];
}

export const formatVitalDate = (date: string, timezone?: string): string =>
  DateTime.fromISO(date, { zone: timezone }).toFormat('MMM d, yyyy');

const heartRateTrend = (vitals: PastVisitVitals[]): VitalTrend => ({
  kind: 'heartRate',
  title: 'Heart rate',
  unit: 'bpm',
  points: vitals.flatMap((visit) =>
    visit.heartRateBpm === undefined
      ? []
      : [
          {
            appointmentId: visit.appointmentId,
            date: visit.date,
            dateLabel: formatVitalDate(visit.date, visit.timezone),
            value: visit.heartRateBpm,
            valueLabel: `${Math.round(visit.heartRateBpm)}`,
          },
        ]
  ),
});

const weightTrend = (vitals: PastVisitVitals[], units: VitalsUnitSystem): VitalTrend => ({
  kind: 'weight',
  title: 'Weight',
  unit: units === 'us' ? 'lb' : 'kg',
  points: vitals.flatMap((visit) => {
    if (visit.weightKg === undefined) return [];
    const value = units === 'us' ? kgToLbs(visit.weightKg) : Math.round(visit.weightKg * 10) / 10;
    return [
      {
        appointmentId: visit.appointmentId,
        date: visit.date,
        dateLabel: formatVitalDate(visit.date, visit.timezone),
        value,
        valueLabel: `${value}`,
      },
    ];
  }),
});

const heightTrend = (vitals: PastVisitVitals[], units: VitalsUnitSystem): VitalTrend => ({
  kind: 'height',
  title: 'Height',
  unit: units === 'us' ? 'in' : 'cm',
  points: vitals.flatMap((visit) => {
    if (visit.heightCm === undefined) return [];
    const height = HeightMeasurement.fromCm(visit.heightCm);
    return [
      {
        appointmentId: visit.appointmentId,
        date: visit.date,
        dateLabel: formatVitalDate(visit.date, visit.timezone),
        value: units === 'us' ? height.getInches(1) : height.getCm(1),
        valueLabel: units === 'us' ? height.getFeetInchesLabel() : `${height.getCm(1)}`,
      },
    ];
  }),
});

/** Splits per-visit vitals into one chronological series per measure, converted to the chosen units. */
export const buildVitalTrends = (vitals: PastVisitVitals[], units: VitalsUnitSystem): VitalTrend[] => {
  const chronological = [...vitals].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return [heartRateTrend(chronological), weightTrend(chronological, units), heightTrend(chronological, units)];
};

/** The unit shown next to a point's label; feet-and-inches labels already carry their own units. */
export const displayUnit = (trend: VitalTrend, units: VitalsUnitSystem): string =>
  trend.kind === 'height' && units === 'us' ? '' : trend.unit;

export interface VitalTrendChange {
  amount: number;
  sinceDateLabel: string;
}

export const getLatestChange = (trend: VitalTrend): VitalTrendChange | undefined => {
  const { points } = trend;
  if (points.length < 2) return undefined;
  const latest = points[points.length - 1];
  const previous = points[points.length - 2];
  return {
    amount: Math.round((latest.value - previous.value) * 10) / 10,
    sinceDateLabel: previous.dateLabel,
  };
};

const NICE_STEP_MULTIPLIERS = [1, 2, 2.5, 5];

/** Three evenly spaced, round y-axis ticks whose range covers every value. */
export const getAxisTicks = (values: number[]): number[] => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  // a flat series still gets a visible window around it
  const spread = max - min || Math.max(Math.abs(max) * 0.1, 1);
  let magnitude = 10 ** Math.floor(Math.log10(spread / 2));
  for (;;) {
    for (const multiplier of NICE_STEP_MULTIPLIERS) {
      const step = multiplier * magnitude;
      const low = Math.floor(min / step) * step;
      if (low + 2 * step >= max && step * 2 >= spread) return [low, low + step, low + 2 * step];
    }
    magnitude *= 10;
  }
};
