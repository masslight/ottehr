import Oystehr from '@oystehr/sdk';
import { Basic } from 'fhir/r4b';
import {
  DEFAULT_PROGRESS_NOTE_CONFIG,
  getExtensionValue,
  GetProgressNoteConfigOutput,
  PROGRESS_NOTE_CONFIG_ANOTHER_DISPOSITION_DEFAULT_TEXT_EXTENSION_URL,
  PROGRESS_NOTE_CONFIG_BASIC_TAG,
  PROGRESS_NOTE_CONFIG_ED_DISPOSITION_DEFAULT_TEXT_EXTENSION_URL,
  PROGRESS_NOTE_CONFIG_MDM_REQUIRED_EXTENSION_URL,
  PROGRESS_NOTE_CONFIG_MEDICAL_DECISION_DEFAULT_TEXT_EXTENSION_URL,
  PROGRESS_NOTE_CONFIG_PCP_NO_TYPE_DISPOSITION_DEFAULT_TEXT_EXTENSION_URL,
  PROGRESS_NOTE_CONFIG_VITALS_UNIT_INPUT_ORDER_EXTENSION_URL,
  ProgressNoteConfig,
  VITALS_UNIT_INPUT_ORDERS,
  VitalsUnitInputOrder,
} from 'utils';

async function findProgressNoteConfigBasic(oystehr: Oystehr): Promise<Basic | undefined> {
  const results = (
    await oystehr.fhir.search<Basic>({
      resourceType: 'Basic',
      params: [
        {
          name: '_tag',
          value: `${PROGRESS_NOTE_CONFIG_BASIC_TAG.system}|${PROGRESS_NOTE_CONFIG_BASIC_TAG.code}`,
        },
      ],
    })
  )
    .unbundle()
    .filter((r): r is Basic => r.resourceType === 'Basic');

  if (results.length > 1) {
    console.warn(
      `Found ${results.length} progress-note-config Basics (expected 1). Using the first. IDs: ${results
        .map((r) => r.id)
        .join(', ')}`
    );
  }

  return results[0];
}

export async function getProgressNoteConfigPayload(oystehr: Oystehr): Promise<GetProgressNoteConfigOutput> {
  const basic = await findProgressNoteConfigBasic(oystehr);
  const mdmRequired = getExtensionValue(basic, PROGRESS_NOTE_CONFIG_MDM_REQUIRED_EXTENSION_URL, 'valueBoolean');
  const medicalDecisionDefaultText = getExtensionValue(
    basic,
    PROGRESS_NOTE_CONFIG_MEDICAL_DECISION_DEFAULT_TEXT_EXTENSION_URL,
    'valueString'
  );
  const pcpNoTypeDispositionDefaultText = getExtensionValue(
    basic,
    PROGRESS_NOTE_CONFIG_PCP_NO_TYPE_DISPOSITION_DEFAULT_TEXT_EXTENSION_URL,
    'valueString'
  );
  const anotherDispositionDefaultText = getExtensionValue(
    basic,
    PROGRESS_NOTE_CONFIG_ANOTHER_DISPOSITION_DEFAULT_TEXT_EXTENSION_URL,
    'valueString'
  );
  const edDispositionDefaultText = getExtensionValue(
    basic,
    PROGRESS_NOTE_CONFIG_ED_DISPOSITION_DEFAULT_TEXT_EXTENSION_URL,
    'valueString'
  );
  const vitalsUnitInputOrderRaw = getExtensionValue(
    basic,
    PROGRESS_NOTE_CONFIG_VITALS_UNIT_INPUT_ORDER_EXTENSION_URL,
    'valueString'
  );
  const vitalsUnitInputOrder = VITALS_UNIT_INPUT_ORDERS.includes(vitalsUnitInputOrderRaw as VitalsUnitInputOrder)
    ? (vitalsUnitInputOrderRaw as VitalsUnitInputOrder)
    : undefined;

  return {
    mdmRequired: mdmRequired ?? DEFAULT_PROGRESS_NOTE_CONFIG.mdmRequired,
    medicalDecisionDefaultText: medicalDecisionDefaultText ?? DEFAULT_PROGRESS_NOTE_CONFIG.medicalDecisionDefaultText,
    pcpNoTypeDispositionDefaultText:
      pcpNoTypeDispositionDefaultText ?? DEFAULT_PROGRESS_NOTE_CONFIG.pcpNoTypeDispositionDefaultText,
    anotherDispositionDefaultText:
      anotherDispositionDefaultText ?? DEFAULT_PROGRESS_NOTE_CONFIG.anotherDispositionDefaultText,
    edDispositionDefaultText: edDispositionDefaultText ?? DEFAULT_PROGRESS_NOTE_CONFIG.edDispositionDefaultText,
    vitalsUnitInputOrder: vitalsUnitInputOrder ?? DEFAULT_PROGRESS_NOTE_CONFIG.vitalsUnitInputOrder,
  };
}

export async function saveProgressNoteConfig(oystehr: Oystehr, config: ProgressNoteConfig): Promise<void> {
  const existing = await findProgressNoteConfigBasic(oystehr);

  const basic: Basic = {
    resourceType: 'Basic',
    meta: {
      tag: [PROGRESS_NOTE_CONFIG_BASIC_TAG],
    },
    code: {
      coding: [PROGRESS_NOTE_CONFIG_BASIC_TAG],
    },
    extension: [
      {
        url: PROGRESS_NOTE_CONFIG_MDM_REQUIRED_EXTENSION_URL,
        valueBoolean: config.mdmRequired,
      },
      {
        url: PROGRESS_NOTE_CONFIG_MEDICAL_DECISION_DEFAULT_TEXT_EXTENSION_URL,
        valueString: config.medicalDecisionDefaultText,
      },
      {
        url: PROGRESS_NOTE_CONFIG_PCP_NO_TYPE_DISPOSITION_DEFAULT_TEXT_EXTENSION_URL,
        valueString: config.pcpNoTypeDispositionDefaultText,
      },
      {
        url: PROGRESS_NOTE_CONFIG_ANOTHER_DISPOSITION_DEFAULT_TEXT_EXTENSION_URL,
        valueString: config.anotherDispositionDefaultText,
      },
      {
        url: PROGRESS_NOTE_CONFIG_ED_DISPOSITION_DEFAULT_TEXT_EXTENSION_URL,
        valueString: config.edDispositionDefaultText,
      },
      {
        url: PROGRESS_NOTE_CONFIG_VITALS_UNIT_INPUT_ORDER_EXTENSION_URL,
        valueString: config.vitalsUnitInputOrder,
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
