import { Patient } from 'fhir/r4b';
import { getFirstName, getLastName } from 'utils/lib/fhir/patient';

const normalize = (value: string | undefined): string => (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

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
