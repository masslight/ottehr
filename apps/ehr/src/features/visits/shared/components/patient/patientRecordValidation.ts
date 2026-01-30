import { DateTime } from 'luxon';
import { FieldError, RegisterOptions } from 'react-hook-form';
import {
  FormFieldsDisplayItem,
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
}

/**
 * Evaluates triggers for a field based on current form values
 */
export const evaluateFieldTriggers = (
  item: FormFieldsInputItem | FormFieldsDisplayItem,
  formValues: Record<string, any>,
  enableBehavior: 'any' | 'all' = 'any'
): TriggeredEffects => {
  const { triggers } = item;

  if (!triggers || triggers.length === 0) {
    return { required: false, enabled: true };
  }

  const flattenedTriggers: Trigger[] = triggers.flatMap((trigger) =>
    trigger.effect.map((ef) => {
      return { ...trigger, effect: ef };
    })
  );

  const triggerConditionsWithOutcomes: (Trigger & { conditionMet: boolean })[] = flattenedTriggers.map((trigger) => {
    const currentValue = formValues[trigger.targetQuestionLinkId];
    const { operator, answerBoolean, answerString, answerDateTime } = trigger;
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
    return { ...trigger, conditionMet };
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

      return acc;
    },
    { required: false as boolean, enabled: null as boolean | null }
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
 */
export const createDynamicValidationResolver = (
  requiredFieldsMap: Record<string, string[]> = {}
): ((values: any) => Promise<{ values: any; errors: Record<string, FieldError> }>) => {
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
    for (const [fieldKey, item] of allFieldsMap) {
      const value = values[fieldKey];

      // Skip display fields
      if (item.type === 'display') {
        continue;
      }

      // Find the required fields for this section
      let requiredFields: string[] | undefined;
      for (const [sectionKey, section] of Object.entries(PATIENT_RECORD_CONFIG.FormFields)) {
        if (Array.isArray(section.items)) {
          // Check each array item
          section.items.forEach((itemGroup: any) => {
            if (Object.values(itemGroup).some((i: any) => i.key === fieldKey)) {
              requiredFields = requiredFieldsMap[sectionKey];
            }
          });
        } else {
          if (Object.values(section.items).some((i: any) => i.key === fieldKey)) {
            requiredFields = requiredFieldsMap[sectionKey] || (section as any).requiredFields;
          }
        }
      }

      // Generate rules for this field
      const rules = generateFieldValidationRules(item, values, requiredFields);

      // Apply validation rules
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
