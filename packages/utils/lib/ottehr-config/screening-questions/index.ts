import type { FormFieldItemRecord, FormFieldsLogicalItem, ScreeningField } from 'config-types';
import { baseScreeningQuestionsConfig } from '../../types/data/screening-questions/config';

export * from '../../types/data/screening-questions/config';
export type { AiSuggestionItem } from '../../types/data/screening-questions/types';
export const patientScreeningQuestionsConfig = baseScreeningQuestionsConfig;

/** Discriminator for the two patient flows that can carry screening answers. */
export type ScreeningFlow = 'virtual' | 'inPerson';

// FormFields key naming follows the existing virtual-paperwork convention
// (kebab-case fhirField → camelCase object key). Kept inline so generated
// keys stay byte-for-byte identical with prior in-place implementations.
const camelKey = (fhirField: string): string =>
  fhirField.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

/** All fields participating in a flow (regardless of `addedManuallyToConfig`). */
export const screeningFieldsForFlow = (flow: ScreeningFlow): ScreeningField[] =>
  patientScreeningQuestionsConfig.fields.filter((field) => field.flowConfig?.[flow] !== undefined);

/** Fields auto-injection should generate items for (i.e. not yet in source config). */
export const screeningFieldsToAutoAdd = (flow: ScreeningFlow): ScreeningField[] =>
  patientScreeningQuestionsConfig.fields.filter((field) => {
    const entry = field.flowConfig?.[flow];
    return entry !== undefined && entry.addedManuallyToConfig === false;
  });

/** Fields with no flow membership — staff asks them at the visit (ASK THE PATIENT). */
export const askThePatientFields = (): ScreeningField[] =>
  patientScreeningQuestionsConfig.fields.filter(
    (field) => !field.flowConfig || (field.flowConfig.virtual === undefined && field.flowConfig.inPerson === undefined)
  );

/** Fields whose answers should be fed to the E&M billing recommendation prompt. */
export const screeningFieldsForBillingRecommendations = (): ScreeningField[] =>
  patientScreeningQuestionsConfig.fields.filter((field) => field.includeInBillingRecommendations === true);

const screeningFieldToVisibleItem = (field: ScreeningField, flow: ScreeningFlow): unknown => {
  const fhirField = field.flowConfig![flow]!.fhirField;
  return {
    key: fhirField,
    label: field.question,
    type: field.type === 'radio' ? 'choice' : field.type,
    element: field.type === 'radio' ? 'Radio List' : undefined,
    options: field.options?.map((option) => ({ value: option.fhirValue, label: option.label })),
  };
};

const collectExistingFhirKeys = (record: Record<string, { key?: string } | unknown>): Set<string> =>
  new Set(
    Object.values(record).flatMap((entry) => {
      const k = (entry as { key?: string } | undefined)?.key;
      return typeof k === 'string' ? [k] : [];
    })
  );

/**
 * Visible FormField items for the virtual paperwork's `additional-page`.
 * Inline-spread into the source config — there are no manual virtual-side
 * placements today, so idempotency is unnecessary here.
 */
export const buildVirtualPaperworkScreeningItems = (): FormFieldItemRecord =>
  Object.fromEntries(
    screeningFieldsToAutoAdd('virtual').map((field) => [
      camelKey(field.flowConfig!.virtual!.fhirField),
      screeningFieldToVisibleItem(field, 'virtual'),
    ])
  ) as FormFieldItemRecord;

/**
 * Visible FormField items for the booking form's `patient-information-page`.
 * Idempotent against `existingItems`: skips fields whose `fhirField` is
 * already present (keeps customer-config branches that hand-place screening
 * questions safe — they don't need to remember to remove the screening config
 * entry, just set `addedManuallyToConfig: true` or rely on this filter).
 *
 * Generated items are gated by `appointment-service-mode = 'in-person'` and
 * hidden via `disabledDisplay` so they don't surface on virtual bookings.
 */
export const buildBookingScreeningItemsAvoiding = (existingItems: Record<string, unknown>): FormFieldItemRecord => {
  const existingFhirKeys = collectExistingFhirKeys(existingItems as Record<string, { key?: string }>);
  return Object.fromEntries(
    screeningFieldsToAutoAdd('inPerson')
      .filter((field) => !existingFhirKeys.has(field.flowConfig!.inPerson!.fhirField))
      .map((field) => [
        camelKey(field.flowConfig!.inPerson!.fhirField),
        {
          ...(screeningFieldToVisibleItem(field, 'inPerson') as object),
          disabledDisplay: 'hidden',
          triggers: [
            {
              targetQuestionLinkId: 'appointment-service-mode',
              effect: ['enable'],
              operator: '=',
              answerString: 'in-person',
            },
          ],
        },
      ])
  ) as FormFieldItemRecord;
};

/**
 * Hidden, read-only logical items spliced into in-person paperwork's
 * `contact-information-page`. They are the harvest carrier — booking-form
 * answers are pre-populated under these linkIds at create-appointment time so
 * the existing `sub-intake-harvest > createAdditionalQuestions` pipeline can
 * convert them to Observations without bespoke per-field code. Always
 * generated for any field with `flowConfig.inPerson` (manual or auto). The
 * `existingLogicalItems` argument enables idempotency against customer
 * configs that already declare a logical item with the same `key`.
 */
export const buildHiddenScreeningLogicalItemsAvoiding = (
  existingLogicalItems: Record<string, unknown>
): Record<string, FormFieldsLogicalItem> => {
  const existingFhirKeys = collectExistingFhirKeys(existingLogicalItems as Record<string, { key?: string }>);
  return Object.fromEntries(
    screeningFieldsForFlow('inPerson')
      .filter((field) => !existingFhirKeys.has(field.flowConfig!.inPerson!.fhirField))
      .map((field) => [
        camelKey(field.flowConfig!.inPerson!.fhirField),
        {
          key: field.flowConfig!.inPerson!.fhirField,
          // 'radio' has no logical-field equivalent; logical items always
          // render hidden + readOnly, so the answer space (yes/no/string) is
          // what matters.
          type: field.type === 'radio' ? 'string' : (field.type as 'string' | 'date' | 'boolean'),
          required: false,
        } satisfies FormFieldsLogicalItem,
      ])
  );
};
