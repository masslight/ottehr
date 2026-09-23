import Oystehr from '@oystehr/sdk';
import { Basic, Observation } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { VitalsSchema } from 'utils/lib/helpers/vitals/config-schema';
import { getVitalObservationAlertLevel } from 'utils/lib/helpers/vitals/utils';
import {
  FHIRObservationInterpretation,
  VitalAlertCriticality,
  VitalFieldNames,
} from 'utils/lib/types/api/chart-data/chart-data.constants';
import { PATIENT_VITALS_META_SYSTEM, VitalsObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { VitalsAlertConfig } from 'utils/lib/types/api/vitals-alert-config/vitals-alert-config.types';
import {
  DEFAULT_VITALS_ALERT_CONFIG,
  VITALS_ALERT_CONFIG_JSON_EXTENSION_URL,
  vitalsAlertConfigToVitalsDef,
} from 'utils/lib/utils/vitals-alert-config';
import { describe, expect, test, vi } from 'vitest';
import { makeObservationResource } from '../../src/shared/chart-data';
import {
  getVitalsAlertConfigPayload,
  getVitalsEngineConfig,
  resolveVitalAlertCriticality,
  saveVitalsAlertConfig,
} from '../../src/shared/vitals-alert-config';

const makeOystehr = (overrides: {
  search?: Basic[];
  existing?: Basic;
  createReturns?: Basic;
}): { oystehr: Oystehr; create: any; update: any } => {
  const create = vi.fn(async (resource: Basic) => overrides.createReturns ?? resource);
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

const narrowedAdultHeartRateConfig = (): VitalsAlertConfig => {
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
    const config = narrowedAdultHeartRateConfig();
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

  test('the first save is a conditional create, so a concurrent one cannot add a second Basic', async () => {
    const { oystehr, create } = makeOystehr({ search: [] });
    await saveVitalsAlertConfig(oystehr, DEFAULT_VITALS_ALERT_CONFIG);

    expect(create.mock.calls[0][1]).toEqual({
      ifNoneExist: [{ name: '_tag', value: 'vitals-alert-config|vitals-alert-config' }],
    });
  });

  test('a first save that loses the race is applied to the winner rather than dropped', async () => {
    const winner: Basic = {
      resourceType: 'Basic',
      id: 'vitals-alert-config-1',
      code: {},
      meta: { versionId: '1' },
      extension: [
        { url: VITALS_ALERT_CONFIG_JSON_EXTENSION_URL, valueString: JSON.stringify(DEFAULT_VITALS_ALERT_CONFIG) },
      ],
    };
    const config = narrowedAdultHeartRateConfig();
    const { oystehr, create, update } = makeOystehr({ search: [], createReturns: winner });

    await saveVitalsAlertConfig(oystehr, config);

    expect(create).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toMatchObject({ id: 'vitals-alert-config-1' });
    expect(update.mock.calls[0][1]).toEqual({ optimisticLockingVersionId: '1' });
    expect((update.mock.calls[0][0] as Basic).extension).toEqual([
      { url: VITALS_ALERT_CONFIG_JSON_EXTENSION_URL, valueString: JSON.stringify(config) },
    ]);
  });

  test('a first save that wins the race is not written twice', async () => {
    const { oystehr, create, update } = makeOystehr({ search: [] });
    await saveVitalsAlertConfig(oystehr, narrowedAdultHeartRateConfig());

    expect(create).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
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
    const updated = narrowedAdultHeartRateConfig();
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
        config: engineConfig,
      })
    ).toBe(VitalAlertCriticality.Abnormal);
  });
});

describe('getVitalsEngineConfig resilience', () => {
  test('a transient read failure is not remembered, so the next call sees the stored config', async () => {
    const stored: Basic = {
      resourceType: 'Basic',
      code: {},
      extension: [
        { url: VITALS_ALERT_CONFIG_JSON_EXTENSION_URL, valueString: JSON.stringify(narrowedAdultHeartRateConfig()) },
      ],
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
        config,
      });

    expect(evaluate(await getVitalsEngineConfig(oystehr))).toBeUndefined();
    expect(evaluate(await getVitalsEngineConfig(oystehr))).toBe(VitalAlertCriticality.Abnormal);
  });

  test('falls back to the default thresholds when the stored config cannot be loaded', async () => {
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

    const adultDOB = DateTime.now().minus({ years: 30 }).toISODate()!;
    expect(
      getVitalObservationAlertLevel({
        patientDOB: adultDOB,
        patientSex: 'female',
        vitalsObservation: { field: VitalFieldNames.VitalHeartbeat, value: 70 } as VitalsObservationDTO,
        config: engineConfig,
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
          extension: [
            {
              url: VITALS_ALERT_CONFIG_JSON_EXTENSION_URL,
              valueString: JSON.stringify(narrowedAdultHeartRateConfig()),
            },
          ],
        },
      ],
    });
    const vitalsAlertConfig = await getVitalsEngineConfig(oystehr);

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

    const dob = DateTime.now().minus({ years: 3, months: 2 }).toISODate()!;
    const recordedAt = DateTime.fromISO(dob).plus({ months: 23 }).toISO()!;

    expect(
      resolveVitalAlertCriticality(observation(recordedAt), heartRateDTO(138), {
        patientDOB: dob,
        patientSex: 'female',
        vitalsAlertConfig,
      })
    ).toBeUndefined();

    expect(
      resolveVitalAlertCriticality(observation(), heartRateDTO(138), {
        patientDOB: dob,
        patientSex: 'female',
        vitalsAlertConfig,
      })
    ).toBe(VitalAlertCriticality.Critical);
  });

  test('flags an SpO2 reading above 100 as abnormal, though no high level is configurable', async () => {
    const { oystehr } = makeOystehr({ search: [] });
    const vitalsAlertConfig = await getVitalsEngineConfig(oystehr);

    const oxygenSatDTO = (value: number): VitalsObservationDTO =>
      ({ field: VitalFieldNames.VitalOxygenSaturation, value }) as VitalsObservationDTO;
    const criticalityAt = (value: number): VitalAlertCriticality | undefined =>
      resolveVitalAlertCriticality(observation(), oxygenSatDTO(value), {
        patientDOB: adultDOB,
        patientSex: 'female',
        vitalsAlertConfig,
      });

    expect(criticalityAt(100)).toBeUndefined();
    expect(criticalityAt(101)).toBe(VitalAlertCriticality.Abnormal);
    expect(criticalityAt(88)).toBe(VitalAlertCriticality.Critical);
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

describe('makeObservationResource alert interpretations', () => {
  const adultDOB = DateTime.now().minus({ years: 30 }).toISODate()!;

  const feverDTO = {
    resourceId: 'obs-vital-temperature',
    field: VitalFieldNames.VitalTemperature,
    value: 39.5,
  } as VitalsObservationDTO;

  const build = (vitalsAlertConfig: VitalsSchema | undefined): Observation =>
    makeObservationResource(
      'enc-1',
      'pat-1',
      'prac-1',
      undefined,
      feverDTO,
      PATIENT_VITALS_META_SYSTEM,
      adultDOB,
      'female',
      vitalsAlertConfig
    );

  test('an out-of-range vital is flagged when the engine config is threaded through', () => {
    const observation = build(vitalsAlertConfigToVitalsDef(DEFAULT_VITALS_ALERT_CONFIG));

    expect(observation.interpretation?.flatMap((concept) => concept.coding ?? []).map((coding) => coding.code)).toEqual(
      [FHIRObservationInterpretation.AbnormalHigh]
    );
  });

  test('the same vital carries no interpretation when no config is supplied', () => {
    expect(build(undefined).interpretation).toBeUndefined();
  });
});
