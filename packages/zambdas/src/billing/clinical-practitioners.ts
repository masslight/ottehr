import Oystehr, { User } from '@oystehr/sdk';
import { Reference } from 'fhir/r4b';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import { GetPractitionerNamesInput, GetPractitionerNamesResponse } from 'utils/lib/types/api/practitioner-names.types';

// Billing's door to Practitioner names: the EHR zambda interface, invoked over the wire. Billing
// never reads clinical FHIR for them. Any client works, only its zambda API is used.

export const getPractitionerNames = async (
  oystehr: Oystehr,
  input: GetPractitionerNamesInput
): Promise<Record<string, string>> => {
  const response = await oystehr.zambda.execute({ id: 'get-practitioner-names', ...input });
  return chooseJson<GetPractitionerNamesResponse | undefined>(response)?.names ?? {};
};

/**
 * The calling user as a FHIR Reference, named first + last the way their Practitioner record names
 * them. Never throws: a failed name lookup falls back to the Oystehr user name rather than blocking
 * the caller's action.
 */
export const practitionerRefForBillingUser = async (user: User, oystehr: Oystehr): Promise<Reference> => {
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
