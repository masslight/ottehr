import Oystehr from '@oystehr/sdk';
import { Basic, Observation } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getVitalObservationAlertLevel } from 'utils/lib/helpers/vitals/utils';
import { VitalAlertCriticality, VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { VitalsObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import {
  VitalsAlertConfig,
  VitalsAlertConfigSchema,
} from 'utils/lib/types/api/vitals-alert-config/vitals-alert-config.types';
import {
  DEFAULT_VITALS_ALERT_CONFIG,
  getVitalsAlertConfigEngineError,
  VITALS_ALERT_CONFIG_JSON_EXTENSION_URL,
} from 'utils/lib/utils/vitals-alert-config';
import { describe, expect, test, vi } from 'vitest';
import {
  getVitalsAlertConfigPayload,
  getVitalsEngineConfig,
  resolveVitalAlertCriticality,
  saveVitalsAlertConfig,
} from '../../src/shared/vitals-alert-config';

const makeOystehr = (overrides: {
  search?: Basic[];
  existing?: Basic;
}): { oystehr: Oystehr; create: any; update: any } => {
  const create = vi.fn(async (resource: Basic) => resource);
  const update = vi.fn(async (resource: Basic) => resource);
  const results = overrides.existing ? [overrides.existing] : overrides.search ?? [];
  const oystehr = {
    fhir: {
      search: vi.fn(async () => ({ unbundle: () => results })),
      create,
      update,
    },
  } as unknown as Oystehr;
  return { oystehr, create, update };
};

/** The defaults with adult heart rate narrowed, so 90 bpm becomes abnormal instead of normal. */
const customConfig = (): VitalsAlertConfig => {
  const config: VitalsAlertConfig = JSON.parse(JSON.stringify(DEFAULT_VITALS_ALERT_CONFIG));
  config.thresholds['vital-heartbeat']['18+y'] = {
    criticalLow: 40,
    abnormalLow: 57,
    abnormalHigh: 85,
    criticalHigh: 115,
  };
  return config;
};

describe('vitals-alert-config shared read/write', () => {
  test('save then read round-trips the whole config', async () => {
    const config = customConfig();
    const { oystehr: saveClient, create } = makeOystehr({ search: [] });
    await saveVitalsAlertConfig(saveClient, config);

    const persisted = create.mock.calls[0][0] as Basic;

    const { oystehr: readClient } = makeOystehr({ search: [persisted] });
    const readBack = await getVitalsAlertConfigPayload(readClient);

    expect(readBack).toEqual(config);
  });

  test('read returns the defaults when no config Basic exists', async () => {
    const { oystehr } = makeOystehr({ search: [] });
    expect(await getVitalsAlertConfigPayload(oystehr)).toEqual(DEFAULT_VITALS_ALERT_CONFIG);
  });

  test('read falls back to the defaults when the stored JSON is invalid', async () => {
    const basic: Basic = {
      resourceType: 'Basic',
      code: {},
      extension: [{ url: VITALS_ALERT_CONFIG_JSON_EXTENSION_URL, valueString: '{"ageRanges":[]}' }],
    };
    const { oystehr } = makeOystehr({ search: [basic] });
    expect(await getVitalsAlertConfigPayload(oystehr)).toEqual(DEFAULT_VITALS_ALERT_CONFIG);
  });

  test('save creates a new Basic when none exists', async () => {
    const { oystehr, create, update } = makeOystehr({ search: [] });
    await saveVitalsAlertConfig(oystehr, DEFAULT_VITALS_ALERT_CONFIG);

    expect(create).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
    const persisted = create.mock.calls[0][0] as Basic;
    expect(persisted.extension).toEqual([
      { url: VITALS_ALERT_CONFIG_JSON_EXTENSION_URL, valueString: JSON.stringify(DEFAULT_VITALS_ALERT_CONFIG) },
    ]);
  });

  test('save updates the existing Basic with optimistic locking instead of creating', async () => {
    const existing: Basic = {
      resourceType: 'Basic',
      id: 'vitals-alert-config-1',
      code: {},
      meta: { versionId: '4' },
    };
    const { oystehr, create, update } = makeOystehr({ existing });
    await saveVitalsAlertConfig(oystehr, DEFAULT_VITALS_ALERT_CONFIG);

    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toMatchObject({ id: 'vitals-alert-config-1' });
    expect(update.mock.calls[0][1]).toEqual({ optimisticLockingVersionId: '4' });
  });
});

describe('getVitalsEngineConfig', () => {
  test('re-reads on every call, so an admin change is not delayed by a stale cache', async () => {
    const { oystehr } = makeOystehr({ search: [] });
    await getVitalsEngineConfig(oystehr);
    await getVitalsEngineConfig(oystehr);

    expect(oystehr.fhir.search).toHaveBeenCalledTimes(2);
  });

  test('serves the updated thresholds immediately after a save', async () => {
    const updated = customConfig();
    const basic: Basic = {
      resourceType: 'Basic',
      code: {},
      extension: [{ url: VITALS_ALERT_CONFIG_JSON_EXTENSION_URL, valueString: JSON.stringify(updated) }],
    };
    const { oystehr } = makeOystehr({ search: [basic] });
    const engineConfig = await getVitalsEngineConfig(oystehr);

    expect(
      getVitalObservationAlertLevel({
        patientDOB: DateTime.now().minus({ years: 30 }).toISODate()!,
        patientSex: 'female',
        vitalsObservation: { field: VitalFieldNames.VitalHeartbeat, value: 90 } as VitalsObservationDTO,
        configOverride: engineConfig,
      })
    ).toBe(VitalAlertCriticality.Abnormal);
  });
});

describe('getVitalsEngineConfig resilience', () => {
  test('a transient read failure is not remembered, so the next call sees the stored config', async () => {
    const stored: Basic = {
      resourceType: 'Basic',
      code: {},
      extension: [{ url: VITALS_ALERT_CONFIG_JSON_EXTENSION_URL, valueString: JSON.stringify(customConfig()) }],
    };
    const search = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue({ unbundle: () => [stored] });
    const oystehr = { fhir: { search } } as unknown as Oystehr;

    const adultDOB = DateTime.now().minus({ years: 30 }).toISODate()!;
    const evaluate = (config: Awaited<ReturnType<typeof getVitalsEngineConfig>>): VitalAlertCriticality | undefined =>
      getVitalObservationAlertLevel({
        patientDOB: adultDOB,
        patientSex: 'female',
        vitalsObservation: { field: VitalFieldNames.VitalHeartbeat, value: 90 } as VitalsObservationDTO,
        configOverride: config,
      });

    expect(evaluate(await getVitalsEngineConfig(oystehr))).toBeUndefined();
    expect(evaluate(await getVitalsEngineConfig(oystehr))).toBe(VitalAlertCriticality.Abnormal);
  });

  test('falls back to the default thresholds when the stored config cannot be loaded', async () => {
    // Boundaries the engine rejects: 10 years and 121 months differ under its day-based
    // comparison.
    const unloadable = {
      ageRanges: [
        { id: 'a', minAge: { unit: 'years', value: 0 }, maxAge: { unit: 'years', value: 10 } },
        { id: 'b', minAge: { unit: 'years', value: 10 }, maxAge: { unit: 'months', value: 121 } },
        { id: 'c', minAge: { unit: 'months', value: 121 } },
      ],
      thresholds: Object.fromEntries(
        Object.keys(DEFAULT_VITALS_ALERT_CONFIG.thresholds).map((vital) => [
          vital,
          {
            a: { abnormalLow: 1, abnormalHigh: 2 },
            b: { abnormalLow: 1, abnormalHigh: 2 },
            c: { abnormalLow: 1, abnormalHigh: 2 },
          },
        ])
      ),
    };
    const { oystehr } = makeOystehr({
      search: [
        {
          resourceType: 'Basic',
          code: {},
          extension: [{ url: VITALS_ALERT_CONFIG_JSON_EXTENSION_URL, valueString: JSON.stringify(unloadable) }],
        },
      ],
    });

    const engineConfig = await getVitalsEngineConfig(oystehr);

    // 70 bpm is normal under the adult default (abnormal high 100) but would exceed the unloadable
    // config's abnormal high of 2.
    const adultDOB = DateTime.now().minus({ years: 30 }).toISODate()!;
    expect(
      getVitalObservationAlertLevel({
        patientDOB: adultDOB,
        patientSex: 'female',
        vitalsObservation: { field: VitalFieldNames.VitalHeartbeat, value: 70 } as VitalsObservationDTO,
        configOverride: engineConfig,
      })
    ).toBeUndefined();
  });
});

describe('resolveVitalAlertCriticality', () => {
  const adultDOB = DateTime.now().minus({ years: 30 }).toISODate()!;
  const heartRateDTO = (value: number): VitalsObservationDTO =>
    ({ field: VitalFieldNames.VitalHeartbeat, value }) as VitalsObservationDTO;

  const observation = (effectiveDateTime?: string): Observation =>
    ({
      resourceType: 'Observation',
      status: 'final',
      code: {},
      effectiveDateTime,
    }) as Observation;

  test('re-derives the alert level from the current config, ignoring the stored interpretation', async () => {
    const { oystehr } = makeOystehr({
      search: [
        {
          resourceType: 'Basic',
          code: {},
          extension: [{ url: VITALS_ALERT_CONFIG_JSON_EXTENSION_URL, valueString: JSON.stringify(customConfig()) }],
        },
      ],
    });
    const vitalsAlertConfig = await getVitalsEngineConfig(oystehr);

    // 90 bpm is normal under the defaults but abnormal under the narrowed custom config, and the
    // observation carries no interpretation of its own.
    const result = resolveVitalAlertCriticality(observation(), heartRateDTO(90), {
      patientDOB: adultDOB,
      patientSex: 'female',
      vitalsAlertConfig,
    });

    expect(result).toBe(VitalAlertCriticality.Abnormal);
  });

  test('scores the value against the patient age at the time of recording, not today', async () => {
    const { oystehr } = makeOystehr({ search: [] });
    const vitalsAlertConfig = await getVitalsEngineConfig(oystehr);

    // Born 3 yr 2 mo ago: in the 3-4 yr band today (critical high 136) but in the 18-24 mo band
    // when the vital was taken at 23 months (abnormal high 142). 138 bpm separates the two.
    const dob = DateTime.now().minus({ years: 3, months: 2 }).toISODate()!;
    const recordedAt = DateTime.fromISO(dob).plus({ months: 23 }).toISO()!;

    expect(
      resolveVitalAlertCriticality(observation(recordedAt), heartRateDTO(138), {
        patientDOB: dob,
        patientSex: 'female',
        vitalsAlertConfig,
      })
    ).toBeUndefined();

    // Without an effective date the age falls back to now, landing in the 3-4 yr band where 138
    // exceeds the critical high of 136.
    expect(
      resolveVitalAlertCriticality(observation(), heartRateDTO(138), {
        patientDOB: dob,
        patientSex: 'female',
        vitalsAlertConfig,
      })
    ).toBe(VitalAlertCriticality.Critical);
  });

  test('falls back to the stored interpretation when the patient has no birth date', async () => {
    const { oystehr } = makeOystehr({ search: [] });
    const vitalsAlertConfig = await getVitalsEngineConfig(oystehr);

    const withStoredCritical: Observation = {
      ...observation(),
      interpretation: [{ coding: [{ code: 'LL' }] }],
    };

    expect(
      resolveVitalAlertCriticality(withStoredCritical, heartRateDTO(30), {
        patientDOB: undefined,
        patientSex: 'female',
        vitalsAlertConfig,
      })
    ).toBe(VitalAlertCriticality.Critical);
  });
});

describe('age range deletion, end to end through validation and storage', () => {
  const RANGE_IDS = ['r0-3mo', 'r3-6mo', 'r6-12mo', 'r12mo-plus'];

  /** Distinct decodable heart-rate bands per range, so a swap or reset is unmistakable. */
  const HEART_RATE_BY_RANGE: Record<string, Record<string, number>> = {
    'r0-3mo': { criticalLow: 100, abnormalLow: 110, abnormalHigh: 170, criticalHigh: 180 },
    'r6-12mo': { criticalLow: 300, abnormalLow: 310, abnormalHigh: 370, criticalHigh: 380 },
    'r12mo-plus': { criticalLow: 400, abnormalLow: 410, abnormalHigh: 470, criticalHigh: 480 },
  };

  /**
   * The config the Admin UI produces after deleting the 3-6mo range: that row is simply gone and
   * every other boundary is untouched, so 3-6mo is now an unconfigured gap.
   */
  const configAfterDeletingSecondRange = (): VitalsAlertConfig =>
    ({
      ageRanges: [
        { id: RANGE_IDS[0], minAge: { unit: 'months', value: 0 }, maxAge: { unit: 'months', value: 3 } },
        { id: RANGE_IDS[2], minAge: { unit: 'months', value: 6 }, maxAge: { unit: 'months', value: 12 } },
        { id: RANGE_IDS[3], minAge: { unit: 'months', value: 12 } },
      ],
      thresholds: Object.fromEntries(
        Object.keys(DEFAULT_VITALS_ALERT_CONFIG.thresholds).map((vital) => [
          vital,
          {
            [RANGE_IDS[0]]:
              vital === 'vital-heartbeat' ? HEART_RATE_BY_RANGE[RANGE_IDS[0]] : { abnormalLow: 1, abnormalHigh: 900 },
            [RANGE_IDS[2]]:
              vital === 'vital-heartbeat' ? HEART_RATE_BY_RANGE[RANGE_IDS[2]] : { abnormalLow: 1, abnormalHigh: 900 },
            [RANGE_IDS[3]]:
              vital === 'vital-heartbeat' ? HEART_RATE_BY_RANGE[RANGE_IDS[3]] : { abnormalLow: 1, abnormalHigh: 900 },
          },
        ])
      ),
    }) as unknown as VitalsAlertConfig;

  test('the post-deletion config with a gap passes validation and stores every surviving cell verbatim', async () => {
    const config = configAfterDeletingSecondRange();

    expect(VitalsAlertConfigSchema.safeParse(config).success).toBe(true);
    expect(getVitalsAlertConfigEngineError(config)).toBeUndefined();

    const { oystehr: saveClient, create } = makeOystehr({ search: [] });
    await saveVitalsAlertConfig(saveClient, config);
    const persisted = create.mock.calls[0][0] as Basic;

    const { oystehr: readClient } = makeOystehr({ search: [persisted] });
    const readBack = await getVitalsAlertConfigPayload(readClient);

    expect(readBack).toEqual(config);
    expect(Object.keys(readBack.thresholds['vital-heartbeat'])).toEqual([RANGE_IDS[0], RANGE_IDS[2], RANGE_IDS[3]]);
    expect(readBack.thresholds['vital-heartbeat'][RANGE_IDS[0]]).toEqual(HEART_RATE_BY_RANGE[RANGE_IDS[0]]);
    expect(readBack.ageRanges[0].maxAge).toEqual({ unit: 'months', value: 3 });
  });

  test('a 4-month-old in the gap gets no alert, while neighbouring ages still alert', async () => {
    const config = configAfterDeletingSecondRange();
    const { oystehr } = makeOystehr({
      search: [
        {
          resourceType: 'Basic',
          code: {},
          extension: [{ url: VITALS_ALERT_CONFIG_JSON_EXTENSION_URL, valueString: JSON.stringify(config) }],
        },
      ],
    });
    const engineConfig = await getVitalsEngineConfig(oystehr);

    const evaluateAt = (ageInMonths: number, value: number): VitalAlertCriticality | undefined =>
      getVitalObservationAlertLevel({
        patientDOB: DateTime.now().minus({ months: ageInMonths }).toISODate()!,
        patientSex: 'female',
        vitalsObservation: { field: VitalFieldNames.VitalHeartbeat, value } as VitalsObservationDTO,
        configOverride: engineConfig,
      });

    expect(evaluateAt(4, 30)).toBeUndefined();
    expect(evaluateAt(4, 150)).toBeUndefined();
    expect(evaluateAt(4, 600)).toBeUndefined();

    expect(evaluateAt(2, 600)).toBe(VitalAlertCriticality.Critical);
    expect(evaluateAt(8, 600)).toBe(VitalAlertCriticality.Critical);
    expect(evaluateAt(2, 150)).toBeUndefined();
  });
});
