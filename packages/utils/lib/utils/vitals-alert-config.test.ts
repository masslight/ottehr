import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { getVitalObservationAlertLevel } from '../helpers/vitals/utils';
import { DefaultVitalsConfig } from '../ottehr-config/vitals';
import { VitalFieldNames } from '../types/api/chart-data/chart-data.constants';
import { VitalsObservationDTO } from '../types/api/chart-data/chart-data.types';
import {
  MAX_VITAL_ALERT_AGE_RANGES,
  VITAL_ALERT_TYPES,
  VitalAlertAgeRange,
  VitalsAlertConfig,
  VitalsAlertConfigSchema,
} from '../types/api/vitals-alert-config/vitals-alert-config.types';
import {
  DEFAULT_VITAL_ALERT_AGE_RANGES,
  DEFAULT_VITALS_ALERT_CONFIG,
  getVitalsAlertConfigEngineError,
  parseVitalsAlertConfigOrDefault,
  vitalsAlertConfigToVitalsDef,
} from './vitals-alert-config';

const dobForAgeInMonths = (months: number): string =>
  DateTime.now()
    .minus({ months, days: 5 }) // mid-month so we never land exactly on a band boundary
    .toISODate()!;

/** Builds the DTO shape each vital's evaluation expects. */
const makeObservation = (field: VitalFieldNames, value: number): VitalsObservationDTO => {
  if (field === VitalFieldNames.VitalBloodPressure) {
    return { field, systolicPressure: value, diastolicPressure: 70 } as VitalsObservationDTO;
  }
  return { field, value } as VitalsObservationDTO;
};

const ALERT_TYPE_TO_FIELD: Record<(typeof VITAL_ALERT_TYPES)[number], VitalFieldNames> = {
  'vital-weight': VitalFieldNames.VitalWeight,
  'vital-height': VitalFieldNames.VitalHeight,
  'vital-temperature': VitalFieldNames.VitalTemperature,
  'vital-heartbeat': VitalFieldNames.VitalHeartbeat,
  'vital-respiration-rate': VitalFieldNames.VitalRespirationRate,
  'vital-blood-pressure': VitalFieldNames.VitalBloodPressure,
  'vital-oxygen-sat': VitalFieldNames.VitalOxygenSaturation,
};

describe('vitalsAlertConfigToVitalsDef', () => {
  it('produces a config the engine accepts', () => {
    expect(() => vitalsAlertConfigToVitalsDef(DEFAULT_VITALS_ALERT_CONFIG)).not.toThrow();
  });

  it('is behaviourally identical to the shipped static config', () => {
    const adapted = vitalsAlertConfigToVitalsDef(DEFAULT_VITALS_ALERT_CONFIG);
    const mismatches: string[] = [];

    VITAL_ALERT_TYPES.forEach((vital) => {
      const field = ALERT_TYPE_TO_FIELD[vital];
      DEFAULT_VITAL_ALERT_AGE_RANGES.forEach((range) => {
        const levels = DEFAULT_VITALS_ALERT_CONFIG.thresholds[vital][range.id];
        const anchors = [levels.criticalLow, levels.abnormalLow, levels.abnormalHigh, levels.criticalHigh].filter(
          (value): value is number => value !== undefined
        );
        const probes = new Set<number>();
        anchors.forEach((anchor) => {
          probes.add(anchor);
          probes.add(anchor - 0.1);
          probes.add(anchor + 0.1);
        });
        if (levels.abnormalLow !== undefined && levels.abnormalHigh !== undefined) {
          probes.add((levels.abnormalLow + levels.abnormalHigh) / 2);
        }

        const minMonths = range.minAge.unit === 'years' ? range.minAge.value * 12 : range.minAge.value;
        const maxMonths = range.maxAge
          ? range.maxAge.unit === 'years'
            ? range.maxAge.value * 12
            : range.maxAge.value
          : minMonths + 240;
        const ageInMonths = (minMonths + maxMonths) / 2;
        const patientDOB = dobForAgeInMonths(ageInMonths);

        probes.forEach((value) => {
          const observation = makeObservation(field, value);
          const expected = getVitalObservationAlertLevel({
            patientDOB,
            patientSex: 'female',
            vitalsObservation: observation,
            configOverride: DefaultVitalsConfig,
          });
          const actual = getVitalObservationAlertLevel({
            patientDOB,
            patientSex: 'female',
            vitalsObservation: observation,
            configOverride: adapted,
          });
          if (expected !== actual) {
            mismatches.push(`${vital} ${range.id} value=${value}: expected ${expected}, got ${actual}`);
          }
        });
      });
    });

    expect(mismatches).toEqual([]);
  });
});

describe('VitalsAlertConfigSchema', () => {
  const cloneDefault = (): VitalsAlertConfig => JSON.parse(JSON.stringify(DEFAULT_VITALS_ALERT_CONFIG));

  it('accepts the default config, including the 24-month/2-year unit switch', () => {
    expect(VitalsAlertConfigSchema.safeParse(DEFAULT_VITALS_ALERT_CONFIG).success).toBe(true);
  });

  it('rejects more than the maximum number of age ranges', () => {
    const config = cloneDefault();
    const extra: VitalAlertAgeRange[] = Array.from({ length: MAX_VITAL_ALERT_AGE_RANGES }, (_unused, index) => ({
      id: `extra-${index}`,
      minAge: { unit: 'years', value: 20 + index },
      maxAge: { unit: 'years', value: 21 + index },
    }));
    config.ageRanges = [...config.ageRanges, ...extra];
    const result = VitalsAlertConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('accepts a gap between age ranges', () => {
    const config = cloneDefault();
    // 3mo-4mo is left unconfigured.
    config.ageRanges[1].minAge = { unit: 'months', value: 4 };
    expect(VitalsAlertConfigSchema.safeParse(config).success).toBe(true);
  });

  it('rejects an overlap between age ranges', () => {
    const config = cloneDefault();
    // A 4-month-old would match both ranges.
    config.ageRanges[0].maxAge = { unit: 'months', value: 5 };
    const result = VitalsAlertConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes('must not overlap'))).toBe(true);
    }
  });

  // Forms materialize maxAge as an object as soon as its inputs register.
  it('treats a maxAge with a blank value as open-ended on the last range', () => {
    const config = cloneDefault();
    (config.ageRanges[config.ageRanges.length - 1] as { maxAge?: unknown }).maxAge = {};
    const result = VitalsAlertConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ageRanges[result.data.ageRanges.length - 1].maxAge).toBeUndefined();
    }
  });

  it('still rejects a blank maxAge on a range that is not the last one', () => {
    const config = cloneDefault();
    (config.ageRanges[0] as { maxAge?: unknown }).maxAge = { unit: 'months' };
    const result = VitalsAlertConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes('open-ended'))).toBe(true);
    }
  });

  it('rejects an open-ended range that is not the last one', () => {
    const config = cloneDefault();
    delete config.ageRanges[0].maxAge;
    const result = VitalsAlertConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes('open-ended'))).toBe(true);
    }
  });

  it('rejects a range whose end age is not after its start age', () => {
    const config = cloneDefault();
    config.ageRanges = [{ id: 'only', minAge: { unit: 'years', value: 5 }, maxAge: { unit: 'years', value: 5 } }];
    config.thresholds = Object.fromEntries(
      VITAL_ALERT_TYPES.map((vital) => [vital, { only: { abnormalLow: 1, abnormalHigh: 2 } }])
    ) as unknown as VitalsAlertConfig['thresholds'];
    expect(VitalsAlertConfigSchema.safeParse(config).success).toBe(false);
  });

  it('rejects levels that are out of ascending order', () => {
    const config = cloneDefault();
    config.thresholds['vital-heartbeat']['18+y'] = {
      criticalLow: 60,
      abnormalLow: 50,
      abnormalHigh: 100,
      criticalHigh: 115,
    };
    const result = VitalsAlertConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes('greater than or equal to'))).toBe(true);
    }
  });

  it('allows sparse levels, so a vital can omit a level entirely', () => {
    const config = cloneDefault();
    config.thresholds['vital-oxygen-sat']['18+y'] = { criticalLow: 90 };
    expect(VitalsAlertConfigSchema.safeParse(config).success).toBe(true);
  });

  it('rejects thresholds referencing an unknown age range', () => {
    const config = cloneDefault();
    config.thresholds['vital-heartbeat']['not-a-range'] = { abnormalLow: 1, abnormalHigh: 2 };
    expect(VitalsAlertConfigSchema.safeParse(config).success).toBe(false);
  });

  it('rejects a config missing a vital', () => {
    const config = cloneDefault();
    delete (config.thresholds as Record<string, unknown>)['vital-heartbeat'];
    expect(VitalsAlertConfigSchema.safeParse(config).success).toBe(false);
  });
});

describe('gaps in age range coverage', () => {
  const cloneDefault = (): VitalsAlertConfig => JSON.parse(JSON.stringify(DEFAULT_VITALS_ALERT_CONFIG));

  it('accepts a gap at the beginning', () => {
    const config = cloneDefault();
    // Nothing configured below 3 months. The removed range's entries have to go from every vital,
    // or the orphaned-threshold rule fires instead.
    const [removed] = config.ageRanges.splice(0, 1);
    VITAL_ALERT_TYPES.forEach((vital) => {
      delete (config.thresholds[vital] as Record<string, unknown>)[removed.id];
    });
    expect(VitalsAlertConfigSchema.safeParse(config).success).toBe(true);
  });

  it('accepts a gap in the middle', () => {
    const config = cloneDefault();
    const [removed] = config.ageRanges.splice(1, 1);
    VITAL_ALERT_TYPES.forEach((vital) => {
      delete (config.thresholds[vital] as Record<string, unknown>)[removed.id];
    });
    expect(VitalsAlertConfigSchema.safeParse(config).success).toBe(true);
  });

  it('accepts a gap at the end, i.e. a bounded last range', () => {
    const config = cloneDefault();
    config.ageRanges[config.ageRanges.length - 1].maxAge = { unit: 'years', value: 99 };
    expect(VitalsAlertConfigSchema.safeParse(config).success).toBe(true);
  });

  it('accepts a single narrow range with everything else unconfigured', () => {
    const config = cloneDefault();
    const kept = config.ageRanges[3];
    config.ageRanges = [kept];
    config.thresholds = Object.fromEntries(
      VITAL_ALERT_TYPES.map((vital) => [vital, { [kept.id]: config.thresholds[vital][kept.id] }])
    ) as unknown as VitalsAlertConfig['thresholds'];
    expect(VitalsAlertConfigSchema.safeParse(config).success).toBe(true);
  });

  it('produces no alert for a patient whose age falls in a gap', () => {
    const config = cloneDefault();
    const [removed] = config.ageRanges.splice(1, 1);
    VITAL_ALERT_TYPES.forEach((vital) => {
      delete (config.thresholds[vital] as Record<string, unknown>)[removed.id];
    });

    const engineConfig = vitalsAlertConfigToVitalsDef(config);
    const fourMonthsOld = dobForAgeInMonths(4);

    VITAL_ALERT_TYPES.forEach((vital) => {
      const field = ALERT_TYPE_TO_FIELD[vital];
      [0, 1, 50, 500].forEach((value) => {
        expect(
          getVitalObservationAlertLevel({
            patientDOB: fourMonthsOld,
            patientSex: 'female',
            vitalsObservation: makeObservation(field, value),
            configOverride: engineConfig,
          })
        ).toBeUndefined();
      });
    });

    expect(
      getVitalObservationAlertLevel({
        patientDOB: dobForAgeInMonths(2),
        patientSex: 'female',
        vitalsObservation: makeObservation(VitalFieldNames.VitalHeartbeat, 500),
        configOverride: engineConfig,
      })
    ).toBe('critical');
  });
});

describe('getVitalsAlertConfigEngineError', () => {
  const cloneDefault = (): VitalsAlertConfig => JSON.parse(JSON.stringify(DEFAULT_VITALS_ALERT_CONFIG));

  it('reports no error for the defaults', () => {
    expect(getVitalsAlertConfigEngineError(DEFAULT_VITALS_ALERT_CONFIG)).toBeUndefined();
  });

  // 10 years is 3650 days under the engine's comparison but 121 months is only 3630, so this
  // config passes the admin rules and fails the engine.
  it('catches a config the admin schema accepts but the engine rejects', () => {
    const config = cloneDefault();
    config.ageRanges = [
      { id: 'a', minAge: { unit: 'years', value: 0 }, maxAge: { unit: 'years', value: 10 } },
      { id: 'b', minAge: { unit: 'years', value: 10 }, maxAge: { unit: 'months', value: 121 } },
      { id: 'c', minAge: { unit: 'months', value: 121 } },
    ];
    config.thresholds = Object.fromEntries(
      VITAL_ALERT_TYPES.map((vital) => [
        vital,
        {
          a: { abnormalLow: 1, abnormalHigh: 2 },
          b: { abnormalLow: 1, abnormalHigh: 2 },
          c: { abnormalLow: 1, abnormalHigh: 2 },
        },
      ])
    ) as unknown as VitalsAlertConfig['thresholds'];

    expect(VitalsAlertConfigSchema.safeParse(config).success).toBe(true);

    const engineError = getVitalsAlertConfigEngineError(config);
    expect(engineError).toBeDefined();
    expect(engineError).toContain('cannot be applied');
  });
});

describe('parseVitalsAlertConfigOrDefault', () => {
  it('falls back to the defaults when the stored value is missing', () => {
    expect(parseVitalsAlertConfigOrDefault(undefined)).toEqual(DEFAULT_VITALS_ALERT_CONFIG);
  });

  it('falls back to the defaults when the stored value is not valid JSON', () => {
    expect(parseVitalsAlertConfigOrDefault('{not json')).toEqual(DEFAULT_VITALS_ALERT_CONFIG);
  });

  it('falls back to the defaults when the stored value fails validation', () => {
    expect(parseVitalsAlertConfigOrDefault(JSON.stringify({ ageRanges: [] }))).toEqual(DEFAULT_VITALS_ALERT_CONFIG);
  });

  it('falls back to the defaults when the stored config is not loadable by the engine', () => {
    const config: VitalsAlertConfig = JSON.parse(JSON.stringify(DEFAULT_VITALS_ALERT_CONFIG));
    config.ageRanges = [
      { id: 'a', minAge: { unit: 'years', value: 0 }, maxAge: { unit: 'years', value: 10 } },
      { id: 'b', minAge: { unit: 'years', value: 10 }, maxAge: { unit: 'months', value: 121 } },
      { id: 'c', minAge: { unit: 'months', value: 121 } },
    ];
    config.thresholds = Object.fromEntries(
      VITAL_ALERT_TYPES.map((vital) => [
        vital,
        {
          a: { abnormalLow: 1, abnormalHigh: 2 },
          b: { abnormalLow: 1, abnormalHigh: 2 },
          c: { abnormalLow: 1, abnormalHigh: 2 },
        },
      ])
    ) as unknown as VitalsAlertConfig['thresholds'];

    expect(parseVitalsAlertConfigOrDefault(JSON.stringify(config))).toEqual(DEFAULT_VITALS_ALERT_CONFIG);
  });

  it('round-trips a valid stored config', () => {
    const stored = JSON.stringify(DEFAULT_VITALS_ALERT_CONFIG);
    expect(parseVitalsAlertConfigOrDefault(stored)).toEqual(DEFAULT_VITALS_ALERT_CONFIG);
  });
});
