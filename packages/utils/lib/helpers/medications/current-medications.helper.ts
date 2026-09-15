import { MedicationDTO } from '../../types/api/chart-data/chart-data.types';

/**
 * Keeps only the medications the patient is still taking.
 *
 * The chart-data `medications` field is patient-scoped and carries no status filter, so it also
 * returns statements a provider has since removed: removing a medication that was recorded in
 * another encounter patches its status to `completed` rather than deleting the resource (see
 * delete-chart-data), and that statement keeps coming back for every encounter of that patient.
 * Anything presenting the reconciled "current medications" list — the Current Medications card,
 * Review & Sign, the progress note and the discharge summary — must show the active ones only.
 */
export const filterActiveMedications = (medications: MedicationDTO[] | undefined): MedicationDTO[] =>
  (medications ?? []).filter((medication) => medication.status === 'active');
