import { QueryClient } from '@tanstack/react-query';
import { Reference } from 'fhir/r4b';
import { applyVisitOccupationalMedicineEmployerToEncounterExtensions } from 'utils/lib/fhir/encounter';
import { UpdateVisitDetailsInput } from 'utils/lib/types/api/update-visit-details.types';
import { EHRVisitDetails } from 'utils/lib/types/data/visit-details.types';

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

/**
 * Writes a just-saved visit employer into the cached visit details, mirroring what the zambda
 * persisted on the Encounter. Without this, form reseeds between the save and the refetch read the
 * stale cache and flash the previous employer.
 */
export const applyVisitEmployerToVisitDetailsCache = (
  queryClient: QueryClient,
  appointmentId: string,
  employer: Reference | null | undefined
): void => {
  queryClient.setQueryData<EHRVisitDetails>(['get-visit-details', appointmentId], (old) =>
    old?.encounter
      ? {
          ...old,
          encounter: {
            ...old.encounter,
            extension: applyVisitOccupationalMedicineEmployerToEncounterExtensions(
              old.encounter.extension,
              employer ?? null
            ),
          },
        }
      : old
  );
};
