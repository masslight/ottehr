import Oystehr from '@oystehr/sdk';
import { Basic } from 'fhir/r4b';
import {
  DEFAULT_PROGRESS_NOTE_CONFIG,
  GetProgressNoteConfigOutput,
  PROGRESS_NOTE_CONFIG_BASIC_TAG,
  PROGRESS_NOTE_CONFIG_MDM_REQUIRED_EXTENSION_URL,
  ProgressNoteConfig,
} from 'utils';

async function findProgressNoteConfigBasic(oystehr: Oystehr): Promise<Basic | undefined> {
  return (
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
    .find((r): r is Basic => r.resourceType === 'Basic');
}

export async function getProgressNoteConfigPayload(oystehr: Oystehr): Promise<GetProgressNoteConfigOutput> {
  const basic = await findProgressNoteConfigBasic(oystehr);
  const mdmRequired = basic?.extension?.find((e) => e.url === PROGRESS_NOTE_CONFIG_MDM_REQUIRED_EXTENSION_URL)
    ?.valueBoolean;

  return {
    mdmRequired: mdmRequired ?? DEFAULT_PROGRESS_NOTE_CONFIG.mdmRequired,
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
