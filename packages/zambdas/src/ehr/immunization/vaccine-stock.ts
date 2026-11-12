import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/node-core/light';
import { MedicationAdministration } from 'fhir/r4b';
import { parseInventoryLot } from 'utils/lib/fhir/medication-inventory';
import { getVaccineDoseFunding, withVaccineDoseFunding } from 'utils/lib/fhir/vfc';
import { InputImmunizationOrderAdministrationDetails } from 'utils/lib/types/data/immunization/types';
import { findAdministrationInventoryLot, reconcileAdministrationStock } from '../../shared/medication-inventory';
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
 * The stock a dose came from is its inventory lot's, not what the screen sent: when the lot number on the order is
 * a lot of the vaccine at the visit's location, that lot's funding source goes on the dose (and decides what is
 * billed and whether it is borrowed). A typed lot, not in inventory, keeps the screen's value.
 */
export async function fillFundingFromInventoryLot(
  oystehr: Oystehr,
  medicationAdministration: MedicationAdministration,
  administrationDetails: InputImmunizationOrderAdministrationDetails
): Promise<void> {
  try {
    const found = await findAdministrationInventoryLot(oystehr, medicationAdministration);
    if (!found) return;
    administrationDetails.fundingSource = parseInventoryLot(found.lot)?.fundingSource ?? 'private';
  } catch (error) {
    // the dose is still given; the record keeps the stock the screen said
    console.error('Error reading the funding source of the dose lot:', error);
    captureException(error);
  }
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
  try {
    const confirmed = await getConfirmedVfcEligibility(oystehr, encounterId);
    if (confirmed) administrationDetails.vfcEligibility = confirmed.code;
  } catch (error) {
    // the dose is still given; the record just lacks the eligibility the screen did not send
    console.error('Error reading the visit VFC eligibility:', error);
    captureException(error);
  }
}

/**
 * After an administration is saved or cancelled: takes the dose off its inventory lot (or puts it back) and
 * logs a borrowed dose (or takes a cancelled one off the log). Stock is bookkeeping, so a failure here is
 * reported and never fails the save.
 */
export async function syncVaccineStockAndBorrowing(
  oystehr: Oystehr,
  medicationAdministration: MedicationAdministration,
  performerReference: string
): Promise<void> {
  try {
    await reconcileAdministrationStock(oystehr, medicationAdministration, performerReference);
    await recordVfcBorrowing(oystehr, medicationAdministration, performerReference);
  } catch (error) {
    console.error('Error syncing vaccine stock for the administration:', error);
    captureException(error);
  }
}

export { getVaccineDoseFunding };
