import { PracticeManagedQuestionnaireItem } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';

/**
 * "Logical items" are hidden, read-only questionnaire items that hold computed / prefilled values
 * (e.g. whether the patient will be 18, the appointment's service category, the reason for visit, or
 * read-only mirrors of core patient fields). They are not user-facing form fields — they exist purely to
 * be referenced by conditional logic (field / page triggers). In the builder they render as a simple
 * read-only "Logical item" row: they can't be added or removed, but they can be picked as trigger targets.
 *
 * The set is fixed and system-defined (declared as `logicalItems` in the intake paperwork config). Each
 * carries a friendly label here because the underlying item has no `text`.
 */
export const LOGICAL_ITEM_LABELS: Record<string, string> = {
  'patient-will-be-18': 'Patient will be 18',
  'is-new-qrs-patient': 'Is a new QRS patient',
  'patient-first-name': 'Patient first name',
  'patient-last-name': 'Patient last name',
  'patient-birthdate': 'Patient birth date',
  'patient-birth-sex': 'Patient birth sex',
  'patient-birth-sex-missing': 'Patient birth sex missing',
  'appointment-service-category': 'Appointment service category',
  'reason-for-visit': 'Reason for visit',
};

export const logicalItemLabel = (linkId: string | undefined): string =>
  (linkId && LOGICAL_ITEM_LABELS[linkId]) || linkId || '';

/**
 * A questionnaire item is a logical item when its linkId is one of the known logical keys AND it is
 * `readOnly` — the marker the generator sets exclusively on logical items. The readOnly gate keeps a real
 * editable field (or a user's coincidental same-linkId field) from ever being treated as a logical item.
 */
export const isLogicalItem = (item: Pick<PracticeManagedQuestionnaireItem, 'linkId' | 'readOnly'>): boolean =>
  Boolean(item.linkId && item.linkId in LOGICAL_ITEM_LABELS && item.readOnly === true);
