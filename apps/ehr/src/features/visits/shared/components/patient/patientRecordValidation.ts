import { DateTime } from 'luxon';
import { FieldError, RegisterOptions } from 'react-hook-form';
import {
  FormFieldsDisplayItem,
  FormFieldsGroupItem,
  FormFieldsInputItem,
  FormFieldTrigger,
  PATIENT_RECORD_CONFIG,
  REQUIRED_FIELD_ERROR_MESSAGE,
} from 'utils';

interface Trigger extends Omit<FormFieldTrigger, 'effect'> {
  effect: string;
}

interface TriggeredEffects {
  required: boolean;
  enabled: boolean | null;
  substituteText: string | undefined;
}

type ValidationResolver = (values: any) => Promise<{ values: any; errors: Record<string, FieldError> }>;

const ADDRESS_LINE_2_FIELD_DEPENDENCIES: Record<string, string> = {
  'patient-street-address-2': 'patient-street-address',
  'policy-holder-address-additional-line': 'policy-holder-address',
  'policy-holder-address-additional-line-2': 'policy-holder-address-2',
  'responsible-party-address-2': 'responsible-party-address',
  'emergency-contact-address-2': 'emergency-contact-address',
  'employer-address-2': 'employer-address',
};

/**
 * Evaluates triggers for a field based on current form values
 */
export const evaluateFieldTriggers = (
  item: FormFieldsInputItem | FormFieldsDisplayItem | FormFieldsGroupItem,
  formValues: Record<string, any>,
  enableBehavior: 'any' | 'all' = 'any'
): TriggeredEffects => {
  const { triggers } = item;

  if (!triggers || triggers.length === 0) {
    return { required: false, enabled: true, substituteText: undefined };
  }

  const flattenedTriggers: Trigger[] = triggers.flatMap((trigger) =>
    trigger.effect.map((ef) => {
      return { ...trigger, effect: ef };
    })
  );

  const triggerConditionsWithOutcomes: (Trigger & { conditionMet: boolean })[] = flattenedTriggers.map((trigger) => {
    // Handle dotted notation in targetQuestionLinkId (e.g., 'patient-summary.appointment-service-category')
    // Try the full ID first, then try extracting just the field part after the dot
    let currentValue = formValues[trigger.targetQuestionLinkId];
    if (currentValue === undefined && trigger.targetQuestionLinkId.includes('.')) {
      const fieldKey = trigger.targetQuestionLinkId.split('.').pop();
      if (fieldKey) {
        currentValue = formValues[fieldKey];
      }
    }
    const { operator, answerBoolean, answerString, answerDateTime, substituteText } = trigger;
    let conditionMet = false;

    switch (operator) {
      case 'exists':
        if (answerBoolean === true) {
          conditionMet = currentValue !== undefined && currentValue !== null && currentValue !== '';
        } else if (answerBoolean === false) {
          conditionMet = currentValue === undefined || currentValue === null || currentValue === '';
        }
        break;
      case '=':
        if (answerBoolean !== undefined) {
          conditionMet = currentValue === answerBoolean;
        } else if (answerString !== undefined) {
          conditionMet = currentValue === answerString;
        } else if (answerDateTime !== undefined) {
          conditionMet = currentValue === answerDateTime;
        }
        break;
      case '!=':
        if (answerBoolean !== undefined) {
          conditionMet = currentValue !== answerBoolean;
        } else if (answerString !== undefined) {
          conditionMet = currentValue !== answerString;
        } else if (answerDateTime !== undefined) {
          conditionMet = currentValue !== answerDateTime;
        }
        break;
      case '>':
        if (
          answerDateTime !== undefined &&
          currentValue !== undefined &&
          currentValue !== null &&
          currentValue !== ''
        ) {
          const currentDate = DateTime.fromISO(currentValue);
          const answerDate = DateTime.fromISO(answerDateTime);
          if (currentDate.isValid && answerDate.isValid) {
            conditionMet = currentDate > answerDate;
          }
        }
        break;
      case '<':
        if (
          answerDateTime !== undefined &&
          currentValue !== undefined &&
          currentValue !== null &&
          currentValue !== ''
        ) {
          const currentDate = DateTime.fromISO(currentValue);
          const answerDate = DateTime.fromISO(answerDateTime);
          if (currentDate.isValid && answerDate.isValid) {
            conditionMet = currentDate < answerDate;
          }
        }
        break;
      case '>=':
        if (
          answerDateTime !== undefined &&
          currentValue !== undefined &&
          currentValue !== null &&
          currentValue !== ''
        ) {
          const currentDate = DateTime.fromISO(currentValue);
          const answerDate = DateTime.fromISO(answerDateTime);
          if (currentDate.isValid && answerDate.isValid) {
            conditionMet = currentDate >= answerDate;
          }
        }
        break;
      case '<=':
        if (
          answerDateTime !== undefined &&
          currentValue !== undefined &&
          currentValue !== null &&
          currentValue !== ''
        ) {
          const currentDate = DateTime.fromISO(currentValue);
          const answerDate = DateTime.fromISO(answerDateTime);
          if (currentDate.isValid && answerDate.isValid) {
            conditionMet = currentDate <= answerDate;
          }
        }
        break;
      default:
        console.warn(`Operator ${operator} not implemented in trigger processing`);
    }
    return { ...trigger, conditionMet, substituteText };
  });

  return triggerConditionsWithOutcomes.reduce(
    (acc, trigger) => {
      if (trigger.effect === 'enable' && trigger.conditionMet) {
        if (acc.enabled === null) {
          acc.enabled = true;
        } else if (enableBehavior === 'all') {
          acc.enabled = acc.enabled && true;
        } else {
          acc.enabled = true;
        }
      } else if (trigger.effect === 'enable' && !trigger.conditionMet) {
        if (acc.enabled === null) {
          acc.enabled = false;
        } else if (enableBehavior === 'all') {
          acc.enabled = false;
        }
      }
      // only 'enable' effect supports 'all' vs 'any' behavior for now; "any" is default for all other effects
      if (trigger.effect === 'require' && trigger.conditionMet) {
        acc.required = true;
      }
      if (trigger.effect === 'require' && !trigger.conditionMet) {
        acc.required = acc.required || false;
      }

      if (trigger.effect === 'sub-text' && trigger.conditionMet) {
        acc.substituteText = trigger.substituteText;
      }

      return acc;
    },
    { required: false as boolean, enabled: null as boolean | null, substituteText: undefined as undefined | string }
  );
};

/**
 * Generates validation rules for a field based on its configuration and trigger state
 */
export const generateFieldValidationRules = (
  item: FormFieldsInputItem | FormFieldsDisplayItem,
  formValues: Record<string, any>,
  requiredFormFields?: string[]
): RegisterOptions => {
  const rules: RegisterOptions = {};

  if (item.type === 'display') {
    return rules;
  }

  const triggeredEffects = evaluateFieldTriggers(item, formValues, item.enableBehavior);
  const isRequired = requiredFormFields?.includes(item.key) || triggeredEffects.required;

  if (isRequired) {
    rules.required = REQUIRED_FIELD_ERROR_MESSAGE;
  }

  if (item.dataType === 'ZIP') {
    rules.pattern = {
      value: /^\d{5}(-\d{4})?$/,
      message: 'Must be 5 digits',
    };
  }

  if (item.dataType === 'DOB') {
    rules.validate = (value: string) => {
      const today = DateTime.now();
      const dob = DateTime.fromISO(value);
      if (!dob.isValid) {
        return 'Please enter a valid date';
      }
      if (dob > today) {
        return 'Date of birth cannot be in the future';
      }
      return true;
    };
  }

  if (item.dataType === 'Phone Number') {
    rules.pattern = {
      value: /^\(\d{3}\) \d{3}-\d{4}$/,
      message: 'Phone number must be 10 digits in the format (xxx) xxx-xxxx',
    };
  }

  if (item.dataType === 'SSN') {
    rules.pattern = {
      value: /^\d{3}-\d{2}-\d{4}$/,
      message: 'Please enter a valid SSN',
    };
  }

  if (item.type === 'date' && item.dataType !== 'DOB') {
    rules.validate = (value: string) => {
      const date = DateTime.fromISO(value);
      if (!date.isValid) {
        return 'Please enter a valid date';
      }
      return true;
    };
  }

  if (item.dataType === 'Email') {
    rules.pattern = {
      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: 'Must be in the format "email@example.com"',
    };
  }

  if (item.key === 'insurance-priority' || item.key === 'insurance-priority-2') {
    rules.validate = (value: string, context: any) => {
      const otherGroupKey = item.key === 'insurance-priority' ? 'insurance-priority-2' : 'insurance-priority';
      let otherGroupValue: 'Primary' | 'Secondary' | undefined;
      if (otherGroupKey) {
        otherGroupValue = context[otherGroupKey];
      }
      if (otherGroupValue === value) {
        return `Account may not have two ${value.toLowerCase()} insurance plans`;
      }
      return true;
    };
  }

  const requiredAddressLine1Field = ADDRESS_LINE_2_FIELD_DEPENDENCIES[item.key];
  if (requiredAddressLine1Field) {
    rules.validate = (value: string, context: any) => {
      if (value && !context[requiredAddressLine1Field]) {
        return 'Address line 2 cannot be filled without address line 1';
      }
      return true;
    };
  }

  return rules;
};

/**
 * Generates validation rules for all fields in a form section
 */
export const generateValidationRulesForSection = (
  items: Record<string, FormFieldsInputItem | FormFieldsDisplayItem>,
  formValues: Record<string, any>,
  requiredFormFields?: string[]
): Record<string, RegisterOptions> => {
  const rules: Record<string, RegisterOptions> = {};

  Object.values(items).forEach((item) => {
    rules[item.key] = generateFieldValidationRules(item, formValues, requiredFormFields);
  });

  return rules;
};

/**
 * Creates a custom resolver for React Hook Form that dynamically evaluates validation rules
 * based on the current form state and trigger conditions
 * @param options - Configuration options for the resolver
 * @param options.renderedSectionCounts - Map of section IDs to the number of rendered instances.
 *   Sections not in the map are assumed to be fully rendered. Useful for array sections that are
 *   conditionally rendered based on external data (e.g., insurance sections based on coverage data).
 */
export const createDynamicValidationResolver = (options?: {
  renderedSectionCounts?: Record<string, number>;
}): ValidationResolver => {
  const { renderedSectionCounts = {} } = options || {};

  return async (values: any) => {
    const errors: Record<string, FieldError> = {};

    // Get all fields from the patient record config
    const allFieldsMap = new Map<string, FormFieldsInputItem | FormFieldsDisplayItem>();

    Object.entries(PATIENT_RECORD_CONFIG.FormFields).forEach(([_sectionKey, section]) => {
      if (Array.isArray(section.items)) {
        // Handle array of items (e.g., insurance sections with indices)
        section.items.forEach((itemGroup: any, _index: number) => {
          Object.values(itemGroup).forEach((item: any) => {
            allFieldsMap.set(item.key, item);
          });
        });
      } else {
        // Handle single items object
        Object.values(section.items).forEach((item: any) => {
          allFieldsMap.set(item.key, item);
        });
      }
    });

    // Validate each field that has a value or is in the allFieldsMap
    fieldLoop: for (const [fieldKey, item] of allFieldsMap) {
      const value = values[fieldKey];

      // Skip display fields
      if (item.type === 'display') {
        continue;
      }

      // Check if field is enabled based on triggers
      const triggeredEffects = evaluateFieldTriggers(item, values, item.enableBehavior);

      // Skip validation only for hidden fields (not disabled fields that are still visible)
      // Disabled fields with disabledDisplay: 'disabled' should still be validated
      // because they're visible and auto-populated (e.g., policy holder fields when relationship is "Self")
      if (triggeredEffects.enabled === false && item.disabledDisplay === 'hidden') {
        continue;
      }

      // Find which section this field belongs to
      let currentSection: any = null;
      let sectionLinkId: string | string[] | undefined;
      let sectionItems: any[] = [];

      for (const [_sectionKey, section] of Object.entries(PATIENT_RECORD_CONFIG.FormFields)) {
        if (Array.isArray(section.items)) {
          // For array sections (like insurance with multiple indices)
          const itemIndex = section.items.findIndex((itemGroup: any) =>
            Object.values(itemGroup).some((i: any) => i.key === fieldKey)
          );
          if (itemIndex !== -1) {
            currentSection = section;
            sectionLinkId = section.linkId;
            const itemGroup = section.items[itemIndex];
            sectionItems = Object.values(itemGroup);

            // Check if this array section has a rendered count limit
            // If a section's linkId is in the map, only validate items up to the specified count
            // This handles sections that are conditionally rendered based on external data
            if (sectionLinkId) {
              const linkIds = Array.isArray(sectionLinkId) ? sectionLinkId : [sectionLinkId];

              for (const linkId of linkIds) {
                if (linkId in renderedSectionCounts) {
                  const renderedCount = renderedSectionCounts[linkId];
                  if (itemIndex >= renderedCount) {
                    // Skip validation for array items that aren't actually rendered
                    continue fieldLoop;
                  }
                  break; // Found a matching linkId, no need to check others
                }
              }
            }

            break;
          }
        } else {
          // For single item sections
          if (Object.values(section.items).some((i: any) => i.key === fieldKey)) {
            currentSection = section;
            sectionLinkId = section.linkId;
            sectionItems = Object.values(section.items);
            break;
          }
        }
      }

      // Check if this section is in the hiddenFormSections list (always hidden)
      const isAlwaysHidden = sectionLinkId
        ? Array.isArray(sectionLinkId)
          ? PATIENT_RECORD_CONFIG.hiddenFormSections.some((hiddenId) => sectionLinkId.includes(hiddenId))
          : PATIENT_RECORD_CONFIG.hiddenFormSections.includes(sectionLinkId)
        : false;

      // Check if section has section-level triggers that disable the entire section
      let isSectionDisabledByTriggers = false;
      if (currentSection && currentSection.triggers && currentSection.triggers.length > 0) {
        // Create a minimal display field to evaluate section-level triggers
        const sectionAsItem: FormFieldsDisplayItem = {
          key: sectionLinkId as string,
          type: 'display',
          text: currentSection.title || '',
          disabledDisplay: 'hidden',
          triggers: currentSection.triggers,
          enableBehavior: currentSection.enableBehavior,
        };
        const triggeredEffects = evaluateFieldTriggers(sectionAsItem, values, currentSection.enableBehavior);
        isSectionDisabledByTriggers = triggeredEffects.enabled === false;
      }

      // Check if section is conditionally hidden (all fields are hidden based on triggers)
      const isConditionallyHidden =
        sectionItems.length > 0 &&
        sectionItems.every((i: any) => {
          if (i.type === 'display') return true; // Skip display fields
          const effects = evaluateFieldTriggers(i, values, i.enableBehavior);
          return effects.enabled === false && i.disabledDisplay === 'hidden';
        });

      const isSectionHidden = isAlwaysHidden || isSectionDisabledByTriggers || isConditionallyHidden;

      // Skip validation if section is hidden
      // This prevents validation errors on required fields within disabled sections
      if (isSectionHidden) {
        continue;
      }

      // Find the required fields for this section
      let requiredFields: string[] | undefined;
      for (const [_sectionKey, section] of Object.entries(PATIENT_RECORD_CONFIG.FormFields)) {
        if (Array.isArray(section.items)) {
          // Check each array item - insurance sections have requiredFields at section level
          const hasField = section.items.some((itemGroup: any) =>
            Object.values(itemGroup).some((i: any) => i.key === fieldKey)
          );
          if (hasField) {
            requiredFields = (section as any).requiredFields;
            break;
          }
        } else {
          // Single items object
          if (Object.values(section.items).some((i: any) => i.key === fieldKey)) {
            requiredFields = (section as any).requiredFields;
            break;
          }
        }
      }

      // Generate rules for this field
      const rules = generateFieldValidationRules(item, values, requiredFields);

      // Apply validation rules - only validate if field is enabled
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors[fieldKey] = {
          type: 'required',
          message: typeof rules.required === 'string' ? rules.required : 'This field is required',
        };
        continue;
      }

      // Pattern validation
      if (rules.pattern && value && typeof value === 'string') {
        const pattern = (rules.pattern as any).value;
        if (!pattern.test(value)) {
          errors[fieldKey] = {
            type: 'pattern',
            message: (rules.pattern as any).message || 'Invalid format',
          };
          continue;
        }
      }

      // Custom validation
      if (rules.validate && value !== undefined && value !== null && value !== '') {
        const validateFn = typeof rules.validate === 'function' ? rules.validate : undefined;
        if (validateFn) {
          const result = validateFn(value, values);
          if (typeof result === 'string') {
            errors[fieldKey] = {
              type: 'validate',
              message: result,
            };
            continue;
          } else if (result === false) {
            errors[fieldKey] = {
              type: 'validate',
              message: 'Validation failed',
            };
            continue;
          }
        }
      }
    }

    return {
      values,
      errors,
    };
  };
};
