import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { getVitalObservationAlertLevel } from '../helpers/vitals/utils';
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
  DEFAULT_VITALS_ALERT_CONFIG,
  formatVitalAlertAgeRange,
  formatVitalNormalRange,
  getVitalsAlertConfigEngineError,
  INCOMPLETE_VITAL_ALERT_AGE_RANGE_LABEL,
  parseVitalsAlertConfigOrDefault,
  vitalsAlertConfigToVitalsDef,
} from './vitals-alert-config';

const dobForAgeInMonths = (months: number): string => DateTime.now().minus({ months, days: 5 }).toISODate()!;

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
    config.ageRanges[1].minAge = { unit: 'months', value: 4 };
    expect(VitalsAlertConfigSchema.safeParse(config).success).toBe(true);
  });

  it('rejects an overlap between age ranges', () => {
    const config = cloneDefault();
    config.ageRanges[0].maxAge = { unit: 'months', value: 5 };
    const result = VitalsAlertConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes('must not overlap'))).toBe(true);
    }
  });

  it('treats the empty maxAge a form materializes as open-ended on the last range', () => {
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

describe('a vital that only alerts low', () => {
  const cloneDefault = (): VitalsAlertConfig => JSON.parse(JSON.stringify(DEFAULT_VITALS_ALERT_CONFIG));

  it('configures no high levels for SpO2 by default', () => {
    Object.values(DEFAULT_VITALS_ALERT_CONFIG.thresholds['vital-oxygen-sat']).forEach((levels) => {
      expect(levels.abnormalHigh).toBeUndefined();
      expect(levels.criticalHigh).toBeUndefined();
    });
  });

  it('drops the high levels an SpO2 config carries, whatever they are', () => {
    const config = cloneDefault();
    config.thresholds['vital-oxygen-sat']['18+y'] = {
      criticalLow: 90,
      abnormalLow: 95,
      abnormalHigh: 101,
      criticalHigh: 105,
    };
    const result = VitalsAlertConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.thresholds['vital-oxygen-sat']['18+y']).toEqual({ criticalLow: 90, abnormalLow: 95 });
      expect(result.data.thresholds['vital-heartbeat']['18+y'].abnormalHigh).toBe(100);
    }
  });

  it('does not reject an SpO2 high level that would be out of order', () => {
    const config = cloneDefault();
    config.thresholds['vital-oxygen-sat']['18+y'] = { criticalLow: 90, abnormalLow: 95, abnormalHigh: 80 };
    expect(VitalsAlertConfigSchema.safeParse(config).success).toBe(true);
  });

  it('rejects a configured SpO2 threshold above the percentage ceiling', () => {
    const config = cloneDefault();
    config.thresholds['vital-oxygen-sat']['18+y'] = { criticalLow: 90, abnormalLow: 105 };
    const result = VitalsAlertConfigSchema.safeParse(config);

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (candidate) => candidate.path.join('.') === 'thresholds.vital-oxygen-sat.18+y.abnormalLow'
      );
      expect(issue?.message).toBe('Low must be 100 or less');
    }
  });

  it('allows a threshold above 100 for a vital that is not a percentage', () => {
    const config = cloneDefault();
    config.thresholds['vital-heartbeat']['18+y'] = { criticalLow: 40, abnormalLow: 57, abnormalHigh: 105 };
    expect(VitalsAlertConfigSchema.safeParse(config).success).toBe(true);
  });

  it('flags an impossible SpO2 reading as abnormal without an admin-set high level', () => {
    const config = cloneDefault();
    config.thresholds['vital-oxygen-sat']['18+y'] = { criticalLow: 90, abnormalLow: 95, abnormalHigh: 96 };
    const engineConfig = vitalsAlertConfigToVitalsDef(config);

    engineConfig['vital-oxygen-sat']?.alertThresholds?.forEach((threshold) => {
      expect(threshold.rules.filter((rule) => rule.type === 'max')).toEqual([
        { type: 'max', units: '%', value: 101, criticality: 'abnormal' },
      ]);
    });

    const adult = { patientDOB: dobForAgeInMonths(30 * 12), patientSex: 'female', config: engineConfig };
    const alertLevelAt = (value: number): string | undefined =>
      getVitalObservationAlertLevel({
        ...adult,
        vitalsObservation: makeObservation(VitalFieldNames.VitalOxygenSaturation, value),
      });

    expect(alertLevelAt(99)).toBeUndefined();
    expect(alertLevelAt(100)).toBeUndefined();
    expect(alertLevelAt(101)).toBe('abnormal');
    expect(alertLevelAt(105)).toBe('abnormal');
    expect(alertLevelAt(93)).toBe('abnormal');
    expect(alertLevelAt(88)).toBe('critical');
  });

  it('guards an age range that has no SpO2 levels configured', () => {
    const config = cloneDefault();
    config.thresholds['vital-oxygen-sat']['18+y'] = {};
    const engineConfig = vitalsAlertConfigToVitalsDef(config);
    const openEnded = engineConfig['vital-oxygen-sat']?.alertThresholds?.find((threshold) => !threshold.maxAge);

    expect(openEnded?.rules).toEqual([{ type: 'max', units: '%', value: 101, criticality: 'abnormal' }]);
  });

  it('drops the ceiling rather than break the engine when a stored SpO2 threshold exceeds it', () => {
    const config = cloneDefault();
    config.thresholds['vital-oxygen-sat']['18+y'] = { criticalLow: 90, abnormalLow: 105 };
    const engineConfig = vitalsAlertConfigToVitalsDef(config);
    const openEnded = engineConfig['vital-oxygen-sat']?.alertThresholds?.find((threshold) => !threshold.maxAge);

    expect(openEnded?.rules.some((rule) => rule.type === 'max')).toBe(false);
    expect(getVitalsAlertConfigEngineError(config)).toBeUndefined();
  });
});

describe('gaps in age range coverage', () => {
  const cloneDefault = (): VitalsAlertConfig => JSON.parse(JSON.stringify(DEFAULT_VITALS_ALERT_CONFIG));

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
            config: engineConfig,
          })
        ).toBeUndefined();
      });
    });

    expect(
      getVitalObservationAlertLevel({
        patientDOB: dobForAgeInMonths(2),
        patientSex: 'female',
        vitalsObservation: makeObservation(VitalFieldNames.VitalHeartbeat, 500),
        config: engineConfig,
      })
    ).toBe('critical');
  });
});

describe('getVitalsAlertConfigEngineError', () => {
  const cloneDefault = (): VitalsAlertConfig => JSON.parse(JSON.stringify(DEFAULT_VITALS_ALERT_CONFIG));

  it('reports no error for the defaults', () => {
    expect(getVitalsAlertConfigEngineError(DEFAULT_VITALS_ALERT_CONFIG)).toBeUndefined();
  });

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

  it('round-trips a valid stored config', () => {
    const stored = JSON.stringify(DEFAULT_VITALS_ALERT_CONFIG);
    expect(parseVitalsAlertConfigOrDefault(stored)).toEqual(DEFAULT_VITALS_ALERT_CONFIG);
  });
});

describe('formatVitalNormalRange', () => {
  it('steps one increment inside each alert level', () => {
    expect(formatVitalNormalRange({ abnormalLow: 2.8, abnormalHigh: 7.1 }, 'vital-weight')).toBe('2.9 – 7.0');
  });

  it('uses the step of the vital, not the precision of the entered levels', () => {
    expect(formatVitalNormalRange({ abnormalLow: 45, abnormalHigh: 93 }, 'vital-weight')).toBe('45.1 – 92.9');
    expect(formatVitalNormalRange({ abnormalLow: 36, abnormalHigh: 38 }, 'vital-temperature')).toBe('36.1 – 37.9');
  });

  it('steps whole units for the vitals recorded as whole numbers', () => {
    expect(formatVitalNormalRange({ abnormalLow: 57, abnormalHigh: 100 }, 'vital-heartbeat')).toBe('58 – 99');
    expect(formatVitalNormalRange({ abnormalLow: 11, abnormalHigh: 21 }, 'vital-respiration-rate')).toBe('12 – 20');
  });

  it('snaps a level that falls between steps to the nearest value that is still normal', () => {
    expect(formatVitalNormalRange({ abnormalLow: 36.05, abnormalHigh: 38.25 }, 'vital-temperature')).toBe(
      '36.1 – 38.2'
    );
  });

  it('is open ended when only one side alerts', () => {
    expect(formatVitalNormalRange({ abnormalLow: 90 }, 'vital-oxygen-sat')).toBe('91 and above');
    expect(formatVitalNormalRange({ abnormalHigh: 101 }, 'vital-heartbeat')).toBe('100 and below');
  });

  it('ignores the critical levels', () => {
    expect(
      formatVitalNormalRange(
        { criticalLow: 2.4, abnormalLow: 2.8, abnormalHigh: 7.1, criticalHigh: 7.9 },
        'vital-weight'
      )
    ).toBe('2.9 – 7.0');
    expect(formatVitalNormalRange({ criticalLow: 35, criticalHigh: 39 }, 'vital-temperature')).toBe('—');
  });

  it('has no normal range when the levels leave no room between them', () => {
    expect(formatVitalNormalRange({ abnormalLow: 95, abnormalHigh: 95 }, 'vital-heartbeat')).toBe('—');
    expect(formatVitalNormalRange({ abnormalLow: 95, abnormalHigh: 96 }, 'vital-heartbeat')).toBe('—');
  });

  it('ignores a high level on a vital that has none, leaving the range open ended', () => {
    expect(
      formatVitalNormalRange(
        { criticalLow: 90, abnormalLow: 95, abnormalHigh: 101, criticalHigh: 105 },
        'vital-oxygen-sat'
      )
    ).toBe('96 and above');
  });

  it('keeps a range that only a finer step can fit', () => {
    expect(formatVitalNormalRange({ abnormalLow: 95, abnormalHigh: 96 }, 'vital-weight')).toBe('95.1 – 95.9');
  });

  it('has no normal range when neither level is set', () => {
    expect(formatVitalNormalRange({}, 'vital-heartbeat')).toBe('—');
  });

  it('derives the range from a real vital in the default config', () => {
    expect(
      formatVitalNormalRange(DEFAULT_VITALS_ALERT_CONFIG.thresholds['vital-heartbeat']['18+y'], 'vital-heartbeat')
    ).toBe('58 – 99');
  });
});

describe('formatVitalAlertAgeRange', () => {
  it('compacts a range whose bounds share a unit', () => {
    expect(
      formatVitalAlertAgeRange({ id: 'a', minAge: { unit: 'months', value: 0 }, maxAge: { unit: 'months', value: 3 } })
    ).toBe('0-3 mo');
  });

  it('spells out both bounds when the units differ', () => {
    expect(
      formatVitalAlertAgeRange({ id: 'a', minAge: { unit: 'days', value: 10 }, maxAge: { unit: 'months', value: 3 } })
    ).toBe('10 d - 3 mo');
  });

  it('labels an open-ended range', () => {
    expect(formatVitalAlertAgeRange({ id: 'a', minAge: { unit: 'years', value: 18 } })).toBe('18 yr and older');
  });

  it('labels a range whose bounds are not filled in yet', () => {
    const range = {
      id: 'a',
      minAge: { unit: 'years', value: undefined },
      maxAge: undefined,
    } as unknown as VitalAlertAgeRange;

    expect(formatVitalAlertAgeRange(range)).toBe(INCOMPLETE_VITAL_ALERT_AGE_RANGE_LABEL);
  });

  it('keeps the start age when only the end age was cleared', () => {
    const range = {
      id: 'a',
      minAge: { unit: 'years', value: 2 },
      maxAge: { unit: 'years', value: undefined },
    } as unknown as VitalAlertAgeRange;

    expect(formatVitalAlertAgeRange(range)).toBe('2 yr and older');
  });

  it('keeps the end age when only the start age was cleared', () => {
    const range = {
      id: 'a',
      minAge: { unit: 'years', value: undefined },
      maxAge: { unit: 'years', value: 2 },
    } as unknown as VitalAlertAgeRange;

    expect(formatVitalAlertAgeRange(range)).toBe('Up to 2 yr');
  });

  it('never renders an undefined bound', () => {
    const range = {
      id: 'a',
      minAge: { unit: 'months', value: undefined },
      maxAge: { unit: 'months', value: undefined },
    } as unknown as VitalAlertAgeRange;

    expect(formatVitalAlertAgeRange(range)).not.toContain('undefined');
  });
});
