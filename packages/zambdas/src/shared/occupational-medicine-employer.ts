import { Account, Encounter, Organization } from 'fhir/r4b';
import { getVisitOccupationalMedicineEmployerFromEncounter } from 'utils/lib/fhir/encounter';
import { isNioReferenceUrl } from 'utils/lib/helpers/helpers';

/**
 * The FHIR Organization a pre-op visit's employer selection points at — the one the employer name has to be
 * read from. Undefined when the visit has no selection or it is a billing-app (NIO) employer, whose name is
 * carried on the reference itself.
 */
export const getVisitEmployerOrganizationId = (encounter: Encounter): string | undefined => {
  const visitEmployerRef = getVisitOccupationalMedicineEmployerFromEncounter(encounter);

  if (!visitEmployerRef?.reference || isNioReferenceUrl(visitEmployerRef.reference)) return undefined;

  return visitEmployerRef.reference.split('/')[1] || undefined;
};

/**
 * The occupational-medicine employer of a visit, as a name only — NIO employers are billing-app resources the
 * clinical side never reads as FHIR, so their names come from the stored Reference display. For pre-op the
 * visit-level selection is authoritative (`visitEmployerOrganization` is the Organization
 * getVisitEmployerOrganizationId names, loaded by the caller); otherwise it is the patient's occupational
 * medicine employer.
 */
export function getOccupationalMedicineEmployerName(params: {
  /** The visit; omitted for the patient-level employer (no pre-op visit selection applies then). */
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
