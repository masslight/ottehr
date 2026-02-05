import { FormFieldsDisplayItem, FormFieldSection, FormFieldsInputItem, PATIENT_RECORD_CONFIG } from 'utils';
import { evaluateFieldTriggers } from '../../../src/features/visits/shared/components/patient/patientRecordValidation';

/**
 * Checks if a patient record field is hidden, either statically (in hiddenFields)
 * or dynamically based on the current form state and field-level triggers.
 *
 * This function evaluates both:
 * 1. Static hiding: Field key is in the section's hiddenFields array
 * 2. Dynamic hiding: Field has triggers that disable it and disabledDisplay is 'hidden'
 *
 * @param fieldKey - The field key (e.g., 'patient-ethnicity')
 * @param formSection - The section configuration containing the field
 * @param formValues - Current form values to evaluate dynamic triggers against. If not provided,
 *                     only static hiding will be checked.
 * @param index - Optional index for array sections (like insurance)
 * @returns true if the field is hidden, false otherwise
 *
 * @example
 * ```ts
 * // Check if gender identity details field is hidden when gender identity is not "Other"
 * const detailsHidden = isFieldHidden(
 *   'patient-gender-identity-details',
 *   PATIENT_RECORD_CONFIG.FormFields.patientDetails,
 *   { 'patient-gender-identity': 'Male' }
 * ); // true
 *
 * // Check if field is shown when trigger condition is met
 * const detailsVisible = !isFieldHidden(
 *   'patient-gender-identity-details',
 *   PATIENT_RECORD_CONFIG.FormFields.patientDetails,
 *   { 'patient-gender-identity': 'Other' }
 * ); // true
 * ```
 */
export function isFieldHidden(
  fieldKey: string,
  formSection: FormFieldSection,
  formValues: Record<string, any> = {},
  index?: number
): boolean {
  // Check static hiding first
  const hiddenFields = formSection.hiddenFields || [];
  if (hiddenFields.includes(fieldKey)) {
    return true;
  }

  // Find the field in the section's items
  let items = formSection.items;
  if (Array.isArray(items) && index !== undefined) {
    items = items[index];
  }

  if (!items || typeof items !== 'object') {
    return false;
  }

  // Find the field configuration
  const field = Object.values(items).find((item: any) => item.key === fieldKey) as
    | FormFieldsInputItem
    | FormFieldsDisplayItem
    | undefined;

  // If field doesn't exist in the configuration, consider it hidden
  if (!field) {
    return true;
  }

  // Check if field has disabledDisplay: 'hidden'
  // For display fields, they're always hidden when disabled (no disabledDisplay property)
  // For input fields, only consider dynamic hiding if disabledDisplay is 'hidden'
  const isDisplayField = field.type === 'display';
  const isInputWithHiddenDisplay = !isDisplayField && 'disabledDisplay' in field && field.disabledDisplay === 'hidden';
  const shouldCheckDynamicHiding = isDisplayField || isInputWithHiddenDisplay;

  if (shouldCheckDynamicHiding) {
    // Only evaluate triggers if formValues are provided
    if (field.triggers && field.triggers.length > 0 && Object.keys(formValues).length > 0) {
      const triggeredEffects = evaluateFieldTriggers(field, formValues, field.enableBehavior);
      return triggeredEffects.enabled === false;
    }
  }

  return false;
}

/**
 * Checks if a patient record section is hidden, either statically (in hiddenFormSections)
 * or dynamically based on the current form state and section-level triggers.
 *
 * This function evaluates both:
 * 1. Static hiding: Section is in PATIENT_RECORD_CONFIG.hiddenFormSections
 * 2. Dynamic hiding: Section has triggers that evaluate to disabled based on form values
 *
 * @param formSection - The section configuration from PATIENT_RECORD_CONFIG.FormFields
 * @param formValues - Current form values to evaluate dynamic triggers against. If not provided,
 *                     only static hiding will be checked.
 * @param index - Optional index for array sections (like insurance)
 * @returns true if the section is hidden, false otherwise
 *
 * @example
 * ```ts
 * // Check if attorney section is hidden when reason for visit is not "Auto accident"
 * const attorneyHidden = isSectionHidden(
 *   PATIENT_RECORD_CONFIG.FormFields.attorneyInformation,
 *   { 'reason-for-visit': 'Cold' }
 * ); // true
 *
 * // Check if attorney section is shown when reason for visit is "Auto accident"
 * const attorneyVisible = !isSectionHidden(
 *   PATIENT_RECORD_CONFIG.FormFields.attorneyInformation,
 *   { 'reason-for-visit': 'Auto accident' }
 * ); // true
 * ```
 */
export function isSectionHidden(
  formSection: FormFieldSection,
  formValues: Record<string, any> = {},
  index?: number
): boolean {
  let linkId = formSection.linkId;
  if (index !== undefined && Array.isArray(formSection.linkId)) {
    linkId = formSection.linkId[index];
  }
  if (typeof linkId !== 'string' && !Array.isArray(linkId)) {
    throw new Error('Form section linkId must be a string or array');
  }

  const { triggers, enableBehavior } = formSection;

  // Check if section is always hidden (static configuration)
  const isAlwaysHidden = Array.isArray(linkId)
    ? PATIENT_RECORD_CONFIG.hiddenFormSections.some((section) => linkId.includes(section))
    : PATIENT_RECORD_CONFIG.hiddenFormSections.includes(linkId);

  if (isAlwaysHidden) {
    return true;
  }

  // Evaluate section-level triggers to determine conditional visibility
  // Only check triggers if formValues are provided
  if (triggers && triggers.length > 0 && Object.keys(formValues).length > 0) {
    // Create a minimal display field to evaluate section-level triggers
    const linkIdString = Array.isArray(linkId) ? linkId[0] : linkId;
    const sectionAsItem: FormFieldsDisplayItem = {
      key: linkIdString,
      type: 'display',
      text: formSection.title,
      disabledDisplay: 'hidden',
      triggers,
      enableBehavior,
    };
    const triggeredEffects = evaluateFieldTriggers(sectionAsItem, formValues, enableBehavior);
    return triggeredEffects.enabled === false;
  }

  return false;
}

/**
 * Creates a helper function to check section visibility for a specific form state.
 * Useful when you need to check multiple sections with the same form values.
 *
 * @param formValues - Current form values to evaluate dynamic triggers against
 * @returns A function that checks if a given section is hidden
 *
 * @example
 * ```ts
 * // Create checker with form values
 * const checkVisibility = createSectionVisibilityChecker({
 *   'reason-for-visit': 'Auto accident',
 *   'appointment-service-category': 'occupational-medicine'
 * });
 *
 * // Check multiple sections
 * const attorneyHidden = checkVisibility(PATIENT_RECORD_CONFIG.FormFields.attorneyInformation);
 * const employerHidden = checkVisibility(PATIENT_RECORD_CONFIG.FormFields.employerInformation);
 * ```
 */
export function createSectionVisibilityChecker(formValues: Record<string, any> = {}) {
  return (formSection: FormFieldSection, index?: number): boolean => {
    return isSectionHidden(formSection, formValues, index);
  };
}
