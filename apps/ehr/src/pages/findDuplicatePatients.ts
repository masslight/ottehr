import Oystehr from '@oystehr/sdk';
import { Patient } from 'fhir/r4b';
import { getFirstName, getLastName } from 'utils/lib/fhir/patient';

const normalize = (value: string | undefined): string => (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Narrows FHIR name-search results (which are prefix matches) down to patients whose
 * first and last name match exactly, ignoring case and surrounding whitespace.
 * Inactive patients (e.g. merged away) are not considered duplicates.
 */
export const filterDuplicatePatients = (
  candidates: Patient[],
  firstName: string | undefined,
  lastName: string | undefined
): Patient[] => {
  const first = normalize(firstName);
  const last = normalize(lastName);
  if (!first || !last) return [];
  return candidates.filter(
    (p) => p.active !== false && normalize(getFirstName(p)) === first && normalize(getLastName(p)) === last
  );
};

export const findDuplicatePatients = async (
  oystehr: Oystehr,
  params: { firstName: string | undefined; lastName: string | undefined; dateOfBirth: string | undefined }
): Promise<Patient[]> => {
  const { firstName, lastName, dateOfBirth } = params;
  if (!firstName?.trim() || !lastName?.trim() || !dateOfBirth) return [];
  const bundle = await oystehr.fhir.search<Patient>({
    resourceType: 'Patient',
    params: [
      { name: 'given', value: firstName.trim() },
      { name: 'family', value: lastName.trim() },
      { name: 'birthdate', value: dateOfBirth },
      { name: '_count', value: '20' },
    ],
  });
  return filterDuplicatePatients(bundle.unbundle(), firstName, lastName);
};
