import Oystehr from '@oystehr/sdk';
import { CandidApi, CandidApiClient } from 'candidhealth';
import { NonInsurancePayerId } from 'candidhealth/api/resources/nonInsurancePayers/resources/v1';
import { Address } from 'fhir/r4b';
import { MISSING_REQUEST_SECRETS, Secrets } from 'utils';
import { getOrCreateCandidApiClient } from '../../shared';
import { CANDID_EMPLOYER_DESCRIPTION } from './helpers';

const mapFhirAddressToCandidAddress = (addresses?: Address[]): CandidApi.StreetAddressShortZip | undefined => {
  const primary = addresses?.[0];
  if (!primary) return undefined;

  const address1 = primary.line?.[0]?.trim();
  const address2 = primary.line?.[1]?.trim();
  const city = primary.city?.trim();
  const state = primary.state?.trim();
  const [zipCode = '', zipPlusFourCode = ''] = (primary.postalCode ?? '').split('-');

  // Candid StreetAddressBase requires these fields for a set operation.
  if (!address1 || !city || !state || !zipCode) {
    return undefined;
  }

  return {
    address1,
    ...(address2 ? { address2 } : {}),
    city,
    state: state as CandidApi.State,
    zipCode,
    ...(zipPlusFourCode ? { zipPlusFourCode } : {}),
  };
};

/**
 * Returns a Candid API client if Candid secrets are configured, otherwise returns null.
 * All employer zambdas call this before attempting any Candid sync so they gracefully
 * skip when running in environments that have no Candid credentials.
 */
export async function createCandidClientIfConfigured(
  oystehr: Oystehr,
  secrets: Secrets | null
): Promise<CandidApiClient | null> {
  try {
    return getOrCreateCandidApiClient(oystehr, secrets);
  } catch (error) {
    if (error !== MISSING_REQUEST_SECRETS) throw error;
    console.log('Candid not configured, skipping candid sync.');
    return null;
  }
}

/**
 * Creates a new non-insurance payer in Candid and returns its UUID.
 * Errors are logged but not re-thrown so the FHIR Organization is still created
 * even if Candid is unreachable; the caller surfaces missing Candid ID as a warning.
 * The goal is to support employer lists with or without RCM. In the future, an RCM sync
 * feature may be needed.
 */
export async function createCandidEmployerPayer(
  candid: CandidApiClient,
  name: string,
  category: string,
  addresses?: Address[]
): Promise<string | undefined> {
  try {
    const candidAddress = mapFhirAddressToCandidAddress(addresses);
    const response = await candid.nonInsurancePayers.v1.create({
      name,
      category,
      description: CANDID_EMPLOYER_DESCRIPTION,
      ...(candidAddress ? { address: candidAddress } : {}),
    });

    if (response?.ok && response.body) {
      const id = response.body.nonInsurancePayerId;
      console.log(`[candid-sync] Created non-insurance payer "${name}" → ${id}`);
      return id;
    }

    console.warn('[candid-sync] Create payer response was not ok', response);
  } catch (err) {
    console.error('[candid-sync] Failed to create Candid non-insurance payer:', err);
  }
  return undefined;
}

/**
 * Updates category (and re-affirms description="Employer") on an existing Candid payer.
 * Errors are logged but not re-thrown so FHIR state is never rolled back.
 */
export async function updateCandidEmployerPayer(
  candid: CandidApiClient,
  candidPayerId: string,
  name: string,
  category: string,
  addresses?: Address[]
): Promise<void> {
  try {
    const candidAddress = mapFhirAddressToCandidAddress(addresses);
    const hasAnyAddressData = Boolean(
      addresses?.[0]?.line?.some((line) => line?.trim()) ||
        addresses?.[0]?.city?.trim() ||
        addresses?.[0]?.state?.trim() ||
        addresses?.[0]?.postalCode?.trim()
    );

    await candid.nonInsurancePayers.v1.update(NonInsurancePayerId(candidPayerId), {
      name,
      category: { type: 'set', value: category },
      description: { type: 'set', value: CANDID_EMPLOYER_DESCRIPTION },
      ...(candidAddress
        ? { address: { type: 'set' as const, value: candidAddress } }
        : !hasAnyAddressData
        ? { address: { type: 'remove' as const } }
        : {}),
    });
    console.log(`[candid-sync] Updated non-insurance payer ${candidPayerId}`);
  } catch (err) {
    console.error(`[candid-sync] Failed to update Candid non-insurance payer ${candidPayerId}:`, err);
  }
}

/**
 * Activates or deactivates an existing Candid non-insurance payer.
 * Errors are logged but not re-thrown so FHIR state is never rolled back.
 */
export async function toggleCandidEmployerPayer(
  candid: CandidApiClient,
  candidPayerId: string,
  enabled: boolean
): Promise<void> {
  try {
    await candid.nonInsurancePayers.v1.toggleEnablement(NonInsurancePayerId(candidPayerId), { enabled });
    console.log(`[candid-sync] Toggled non-insurance payer ${candidPayerId} → enabled=${enabled}`);
  } catch (err) {
    console.error(`[candid-sync] Failed to toggle Candid non-insurance payer ${candidPayerId}:`, err);
  }
}
