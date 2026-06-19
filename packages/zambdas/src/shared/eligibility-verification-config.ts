import Oystehr from '@oystehr/sdk';
import { Basic } from 'fhir/r4b';
import {
  DEFAULT_ELIGIBILITY_PRIMARY_CODE,
  DEFAULT_ELIGIBILITY_SHORT_LIST_CODES,
  ELIGIBILITY_VERIFICATION_CONFIG_BASIC_TAG,
  ELIGIBILITY_VERIFICATION_CONFIG_EXTENSION_URL,
  EligibilityVerificationConfig,
  GetEligibilityVerificationConfigOutput,
} from 'utils';

const DEFAULT_ELIGIBILITY_VERIFICATION_CONFIG: EligibilityVerificationConfig = {
  shortListCodes: [...DEFAULT_ELIGIBILITY_SHORT_LIST_CODES],
  primaryCode: DEFAULT_ELIGIBILITY_PRIMARY_CODE,
};

async function findEligibilityVerificationConfigBasic(oystehr: Oystehr): Promise<Basic | undefined> {
  return (
    await oystehr.fhir.search<Basic>({
      resourceType: 'Basic',
      params: [
        {
          name: '_tag',
          value: `${ELIGIBILITY_VERIFICATION_CONFIG_BASIC_TAG.system}|${ELIGIBILITY_VERIFICATION_CONFIG_BASIC_TAG.code}`,
        },
      ],
    })
  )
    .unbundle()
    .find((r): r is Basic => r.resourceType === 'Basic');
}

export async function getEligibilityVerificationConfigPayload(
  oystehr: Oystehr
): Promise<GetEligibilityVerificationConfigOutput> {
  const basic = await findEligibilityVerificationConfigBasic(oystehr);
  const storedJson = basic?.extension?.find((e) => e.url === ELIGIBILITY_VERIFICATION_CONFIG_EXTENSION_URL)
    ?.valueString;

  if (!storedJson) {
    return { ...DEFAULT_ELIGIBILITY_VERIFICATION_CONFIG, id: basic?.id };
  }

  try {
    const parsed = JSON.parse(storedJson) as Partial<EligibilityVerificationConfig>;
    const shortListCodes = Array.isArray(parsed.shortListCodes)
      ? parsed.shortListCodes.filter((code): code is string => typeof code === 'string' && code.length > 0)
      : [];
    const primaryCode =
      typeof parsed.primaryCode === 'string' && shortListCodes.includes(parsed.primaryCode)
        ? parsed.primaryCode
        : undefined;
    return { shortListCodes, primaryCode, id: basic?.id };
  } catch {
    return { ...DEFAULT_ELIGIBILITY_VERIFICATION_CONFIG, id: basic?.id };
  }
}

export async function saveEligibilityVerificationConfig(
  oystehr: Oystehr,
  config: EligibilityVerificationConfig
): Promise<void> {
  const existing = await findEligibilityVerificationConfigBasic(oystehr);

  const basicResource: Basic = {
    resourceType: 'Basic',
    meta: { tag: [ELIGIBILITY_VERIFICATION_CONFIG_BASIC_TAG] },
    code: { coding: [ELIGIBILITY_VERIFICATION_CONFIG_BASIC_TAG] },
    extension: [{ url: ELIGIBILITY_VERIFICATION_CONFIG_EXTENSION_URL, valueString: JSON.stringify(config) }],
  };

  if (existing) {
    await oystehr.fhir.update<Basic>(
      { ...basicResource, id: existing.id! },
      existing.meta?.versionId ? { optimisticLockingVersionId: existing.meta.versionId } : undefined
    );
  } else {
    await oystehr.fhir.create<Basic>(basicResource);
  }
}
