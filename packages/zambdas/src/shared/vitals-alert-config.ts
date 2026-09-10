import Oystehr from '@oystehr/sdk';
import { Basic, Observation } from 'fhir/r4b';
import { getExtensionValue } from 'utils/lib/fhir/helpers';
import { VitalsSchema } from 'utils/lib/helpers/vitals/config-schema';
import { getVitalDTOCriticalityFromObservation, getVitalObservationAlertLevel } from 'utils/lib/helpers/vitals/utils';
import { VitalAlertCriticality } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { VitalsObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import {
  GetVitalsAlertConfigOutput,
  VitalsAlertConfig,
} from 'utils/lib/types/api/vitals-alert-config/vitals-alert-config.types';
import {
  DEFAULT_VITALS_ALERT_CONFIG,
  parseVitalsAlertConfigOrDefault,
  VITALS_ALERT_CONFIG_BASIC_TAG,
  VITALS_ALERT_CONFIG_JSON_EXTENSION_URL,
  vitalsAlertConfigToVitalsDef,
} from 'utils/lib/utils/vitals-alert-config';

async function findVitalsAlertConfigBasic(oystehr: Oystehr): Promise<Basic | undefined> {
  const results = (
    await oystehr.fhir.search<Basic>({
      resourceType: 'Basic',
      params: [
        {
          name: '_tag',
          value: `${VITALS_ALERT_CONFIG_BASIC_TAG.system}|${VITALS_ALERT_CONFIG_BASIC_TAG.code}`,
        },
      ],
    })
  )
    .unbundle()
    .filter((r): r is Basic => r.resourceType === 'Basic');

  if (results.length > 1) {
    console.warn(
      `Found ${results.length} vitals-alert-config Basics (expected 1). Using the first. IDs: ${results
        .map((r) => r.id)
        .join(', ')}`
    );
  }

  return results[0];
}

export async function getVitalsAlertConfigPayload(oystehr: Oystehr): Promise<GetVitalsAlertConfigOutput> {
  const basic = await findVitalsAlertConfigBasic(oystehr);
  const raw = getExtensionValue(basic, VITALS_ALERT_CONFIG_JSON_EXTENSION_URL, 'valueString');
  return parseVitalsAlertConfigOrDefault(raw);
}

export async function saveVitalsAlertConfig(oystehr: Oystehr, config: VitalsAlertConfig): Promise<void> {
  const existing = await findVitalsAlertConfigBasic(oystehr);

  const basic: Basic = {
    resourceType: 'Basic',
    meta: {
      tag: [VITALS_ALERT_CONFIG_BASIC_TAG],
    },
    code: {
      coding: [VITALS_ALERT_CONFIG_BASIC_TAG],
    },
    extension: [
      {
        url: VITALS_ALERT_CONFIG_JSON_EXTENSION_URL,
        valueString: JSON.stringify(config),
      },
    ],
  };

  if (existing) {
    await oystehr.fhir.update<Basic>(
      {
        ...basic,
        id: existing.id!,
      },
      existing.meta?.versionId
        ? {
            optimisticLockingVersionId: existing.meta.versionId,
          }
        : undefined
    );
  } else {
    await oystehr.fhir.create<Basic>(basic);
  }
}

/**
 * The admin-configured thresholds in the engine's shape. Resolve once per request and pass the
 * result down, so `VitalsDef` reuses its parse for every observation. Must not be cached across
 * invocations: save-chart-data persists interpretations derived from it.
 */
export async function getVitalsEngineConfig(oystehr: Oystehr): Promise<VitalsSchema> {
  try {
    const config = await getVitalsAlertConfigPayload(oystehr);
    return vitalsAlertConfigToVitalsDef(config);
  } catch (error) {
    console.error('Failed to resolve the vitals alert config; falling back to the default thresholds', error);
    return vitalsAlertConfigToVitalsDef(DEFAULT_VITALS_ALERT_CONFIG);
  }
}

export interface VitalAlertContext {
  patientDOB: string | undefined;
  patientSex: string | undefined;
  vitalsAlertConfig: VitalsSchema;
}

/**
 * The alert level shown in the UI. Evaluated against the current config rather than the
 * `interpretation` stored at save time, so a threshold change applies to vitals already recorded,
 * and against the patient's age on the observation's effective date rather than today.
 */
export const resolveVitalAlertCriticality = (
  observation: Observation,
  dto: VitalsObservationDTO,
  context: VitalAlertContext
): VitalAlertCriticality | undefined => {
  if (!context.patientDOB) {
    return getVitalDTOCriticalityFromObservation(observation);
  }
  return getVitalObservationAlertLevel({
    patientDOB: context.patientDOB,
    patientSex: context.patientSex,
    vitalsObservation: dto,
    configOverride: context.vitalsAlertConfig,
    asOfDate: observation.effectiveDateTime ?? observation.effectivePeriod?.start,
  });
};
