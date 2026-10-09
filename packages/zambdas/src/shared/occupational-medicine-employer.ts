import { Account, Encounter, Organization } from 'fhir/r4b';
import { getVisitOccupationalMedicineEmployerFromEncounter } from 'utils/lib/fhir/encounter';
import { isNioReferenceUrl } from 'utils/lib/helpers/helpers';

export const getVisitEmployerOrganizationId = (encounter: Encounter): string | undefined => {
  const visitEmployerRef = getVisitOccupationalMedicineEmployerFromEncounter(encounter);

  if (!visitEmployerRef?.reference || isNioReferenceUrl(visitEmployerRef.reference)) return undefined;

  return visitEmployerRef.reference.split('/')[1] || undefined;
};

export function getOccupationalMedicineEmployerName(params: {
  encounter?: Encounter;
  appointmentServiceCategory?: string;
  occupationalMedicineEmployerOrganization?: Organization;
  occupationalMedicineAccount?: Account;
  visitEmployerOrganization?: Organization;
}): string | undefined {
  const {
    encounter,
    appointmentServiceCategory,
    occupationalMedicineEmployerOrganization,
    occupationalMedicineAccount,
    visitEmployerOrganization,
  } = params;

  // For pre-op the visit-level selection is authoritative: when it is absent or cannot be
  // resolved, nothing renders — never the patient Account's employer, which may belong to a
  // different visit.
  if (appointmentServiceCategory === 'pre-op') {
    const visitEmployerRef = encounter ? getVisitOccupationalMedicineEmployerFromEncounter(encounter) : undefined;

    if (isNioReferenceUrl(visitEmployerRef?.reference)) {
      return visitEmployerRef?.display;
    }

    return visitEmployerOrganization?.name;
  }

  if (occupationalMedicineEmployerOrganization?.name) {
    return occupationalMedicineEmployerOrganization.name;
  }

  const owner = occupationalMedicineAccount?.owner;

  if (isNioReferenceUrl(owner?.reference)) {
    return owner?.display;
  }

  return undefined;
}
