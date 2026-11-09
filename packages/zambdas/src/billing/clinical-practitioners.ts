import { User } from '@oystehr/sdk';
import { Reference } from 'fhir/r4b';
import { chunkThings } from 'utils/lib/fhir/chat';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import {
  GetPractitionerNamesInput,
  GetPractitionerNamesResponse,
  MAX_PRACTITIONER_NAMES_IDS,
} from 'utils/lib/types/api/practitioner-names.types';
import { ScopedOystehr } from './shared';

// Billing's door to Practitioner names: the EHR zambda interface, invoked over the wire. Billing
// never reads clinical FHIR for them. Any client works, only its zambda API is used.

export const getPractitionerNames = async (
  oystehr: ScopedOystehr,
  input: GetPractitionerNamesInput
): Promise<Record<string, string>> => {
  const response = await oystehr.zambda.execute({ id: 'get-practitioner-names', ...input });
  return chooseJson<GetPractitionerNamesResponse | undefined>(response)?.names ?? {};
};

// Practitioner names by id for listings that name many submitters, batched to the zambda's input limit
export const practitionerNamesFromEhr =
  (oystehr: ScopedOystehr) =>
  async (practitionerIds: string[]): Promise<Map<string, string>> => {
    const batches = await Promise.all(
      chunkThings([...new Set(practitionerIds)], MAX_PRACTITIONER_NAMES_IDS).map((ids) =>
        getPractitionerNames(oystehr, { practitionerIds: ids })
      )
    );
    return new Map(batches.flatMap((names) => Object.entries(names)));
  };

/**
 * The calling user as a FHIR Reference, named first + last the way their Practitioner record names
 * them. Never throws: a failed name lookup falls back to the Oystehr user name rather than blocking
 * the caller's action.
 */
export const practitionerRefForBillingUser = async (user: User, oystehr: ScopedOystehr): Promise<Reference> => {
  const practitionerId = getIdFromReference(user.profile, 'Practitioner');
  if (!practitionerId) return { reference: user.profile, display: user.name };
  try {
    const names = await getPractitionerNames(oystehr, { practitionerIds: [practitionerId] });
    return { reference: user.profile, display: names[practitionerId] || user.name };
  } catch (error) {
    console.error('Failed to resolve practitioner name for user', user.id, error);
    return { reference: user.profile, display: user.name };
  }
};
