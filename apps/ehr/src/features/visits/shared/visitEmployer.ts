import { Reference } from 'fhir/r4b';
import { UpdateVisitDetailsInput } from 'utils';

/** Field / linkId key for the occupational-medicine employer in the patient-record form. */
export const OCCUPATIONAL_MEDICINE_EMPLOYER_FIELD_KEY = 'occupational-medicine-employer';

/**
 * Pre-op visits store the occ-med employer on the Encounter (visit-level) via update-visit-details,
 * not on the patient Account. Builds that payload; a `null`/`undefined` employer clears it.
 */
export const buildVisitEmployerUpdate = (
  appointmentId: string,
  employer: Reference | null | undefined
): UpdateVisitDetailsInput => ({
  appointmentId,
  bookingDetails: { visitOccupationalMedicineEmployer: employer ?? null },
});
