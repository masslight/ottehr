import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/node-core/light';
import { MedicationAdministration } from 'fhir/r4b';
import { getVaccineDoseFunding, withVaccineDoseFunding } from 'utils/lib/fhir/vfc';
import { InputImmunizationOrderAdministrationDetails } from 'utils/lib/types/data/immunization/types';
import { reconcileAdministrationStock } from '../../shared/medication-inventory';
import { getConfirmedVfcEligibility, recordVfcBorrowing } from '../../shared/vfc';

// What a vaccine dose does to inventory and the VFC records. Kept apart from the order zambdas' own work so
// the administer-order handler stays small.

/** Puts the dose's funding details (stock, eligibility, borrowing reason) on the administration, in place. */
export function applyVaccineDoseFunding(
  medicationAdministration: MedicationAdministration,
  administrationDetails: InputImmunizationOrderAdministrationDetails | undefined
): void {
  if (!administrationDetails) return;
  const { fundingSource, vfcEligibility, borrowingReason } = administrationDetails;
  const { extension } = withVaccineDoseFunding(medicationAdministration, {
    fundingSource,
    vfcEligibility,
    borrowingReason,
  });
  medicationAdministration.extension = extension;
}

/**
 * A dose given without the screen saying the patient's eligibility still carries the visit's confirmed
 * eligibility, so the record (and the borrowing check) is complete.
 */
export async function fillVfcEligibilityFromVisit(
  oystehr: Oystehr,
  medicationAdministration: MedicationAdministration,
  administrationDetails: InputImmunizationOrderAdministrationDetails
): Promise<void> {
  if (administrationDetails.vfcEligibility) return;
  const encounterId = medicationAdministration.context?.reference?.replace('Encounter/', '');
  if (!encounterId) return;
  const confirmed = await getConfirmedVfcEligibility(oystehr, encounterId);
  if (confirmed) administrationDetails.vfcEligibility = confirmed.code;
}

/**
 * After an administration is saved or cancelled: takes the dose off its inventory lot (or puts it back) and
 * logs a borrowed dose. Stock is bookkeeping, so a failure here is reported and never fails the save.
 */
export async function syncVaccineStockAndBorrowing(
  oystehr: Oystehr,
  medicationAdministration: MedicationAdministration,
  performerReference: string
): Promise<void> {
  try {
    await reconcileAdministrationStock(oystehr, medicationAdministration, performerReference);
    if (medicationAdministration.status === 'completed' || medicationAdministration.status === 'on-hold') {
      await recordVfcBorrowing(oystehr, medicationAdministration, performerReference);
    }
  } catch (error) {
    console.error('Error syncing vaccine stock for the administration:', error);
    captureException(error);
  }
}

export { getVaccineDoseFunding };
