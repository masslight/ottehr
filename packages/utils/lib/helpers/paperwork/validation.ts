import { QuestionnaireItemEnableWhen, QuestionnaireResponseItem, QuestionnaireResponseItemAnswer } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  DATE_ERROR_MESSAGE,
  emailRegex,
  emojiRegex,
  IntakeQuestionnaireItem,
  isoDateRegex,
  phoneRegex,
  pickFirstValueFromAnswerItem,
  QuestionnaireItemConditionDefinition,
  REQUIRED_FIELD_ERROR_MESSAGE,
  zipRegex,
} from 'utils';
import { z, ZodIssueCode } from 'zod';

// --- Start of Zod Replacement ---

// Kept for any external modules that might still use them.
export const PHONE_NUMBER_FIELDS = [
  'patient-number',
  'guardian-number',
  'responsible-party-number',
  'pharmacy-phone',
  'pcp-number',
];
export const EMAIL_FIELDS = ['patient-email', 'guardian-email'];
export const ZIP_CODE_FIELDS = ['patient-zip'];
export const SIGNATURE_FIELDS = ['signature'];
export const FULL_ADDRESS_FIELDS = ['pharmacy-address'];

// Helper to check if a FHIR answer object actually contains a value.
const itemAnswerHasValue = (answer?: QuestionnaireResponseItemAnswer[]): boolean => {
  if (!answer || answer.length === 0) {
    return false;
  }
  const firstAnswer = answer[0];
  if (!firstAnswer || typeof firstAnswer !== 'object') {
    return false;
  }
  const value = Object.values(firstAnswer).find((v) => v !== undefined && v !== null && v !== '');
  return value !== undefined;
};

// Re-implementation of your conditional logic helpers.
const evalCondition = (
  condition: QuestionnaireItemConditionDefinition,
  allValues: Record<string, any>,
  itemType: IntakeQuestionnaireItem['type']
): boolean => {
  const { question, operator, answerString, answerBoolean, answerDate, answerInteger } = condition;
  const questionValue = allValues[question];

  // Determine the value type based on the condition
  let valueType: 'string' | 'boolean' = 'string';
  if (answerBoolean !== undefined) {
    valueType = 'boolean';
  }

  const extractedValue = pickFirstValueFromAnswerItem(questionValue, valueType);

  if (operator === 'exists') {
    const hasValue = itemAnswerHasValue(questionValue?.answer);
    if (answerBoolean === true) return hasValue;
    if (answerBoolean === false) return !hasValue;
    return false;
  }

  if (answerString !== undefined) {
    if (operator === '=') return extractedValue === answerString;
    if (operator === '!=') return extractedValue !== answerString;
  }
  if (answerBoolean !== undefined) {
    if (operator === '=') return extractedValue === answerBoolean;
    if (operator === '!=') return extractedValue !== answerBoolean;
  }
  if (answerDate !== undefined && typeof extractedValue === 'string') {
    const answerDT = DateTime.fromISO(answerDate);
    const valDT = DateTime.fromISO(extractedValue);
    if (!answerDT.isValid || !valDT.isValid) return false;
    if (operator === '=') return answerDT.equals(valDT);
    if (operator === '!=') return !answerDT.equals(valDT);
    if (operator === '<=') return valDT <= answerDT;
    if (operator === '<') return valDT < answerDT;
    if (operator === '>=') return valDT >= answerDT;
    if (operator === '>') return valDT > answerDT;
  }
  if (answerInteger !== undefined && itemType === 'date' && typeof extractedValue === 'string') {
    const years = typeof answerInteger === 'string' ? parseInt(answerInteger, 10) : answerInteger;
    if (isNaN(years)) return false;
    const now = DateTime.now().startOf('day');
    const targetDate = now.minus({ years });
    const valDT = DateTime.fromISO(extractedValue);
    if (!targetDate.isValid || !valDT.isValid) return false;
    if (operator === '<=') return valDT <= targetDate;
    if (operator === '<') return valDT < targetDate;
    if (operator === '>=') return valDT >= targetDate;
    if (operator === '>') return valDT > targetDate;
  }
  return false;
};

const evalRequired = (item: IntakeQuestionnaireItem, allValues: Record<string, any>): boolean => {
  if (item.required) {
    return true;
  }
  if (item.requireWhen) {
    return evalCondition(item.requireWhen, allValues, item.type);
  }
  return false;
};

const evalFilterWhen = (item: IntakeQuestionnaireItem, allValues: Record<string, any>): boolean => {
  if (item.filterWhen) {
    return evalCondition(item.filterWhen, allValues, item.type);
  }
  return false;
};

const evalEnableWhen = (
  item: IntakeQuestionnaireItem,
  allItems: IntakeQuestionnaireItem[],
  formValues: { [itemLinkId: string]: QuestionnaireResponseItem }
): boolean => {
  const { enableWhen, enableBehavior = 'all' } = item;
  if (!enableWhen || enableWhen.length === 0) {
    return true;
  }

  const evalSingleCondition = (ew: QuestionnaireItemEnableWhen): boolean => {
    const questionItem = allItems.find((i) => i.linkId === ew.question);
    if (!questionItem) return ew.operator === '!=';

    // This correctly handles the 'exists' operator without causing a type error.
    if (ew.operator === 'exists') {
      const questionValue = formValues[ew.question];
      const hasValue = itemAnswerHasValue(questionValue?.answer);
      if (ew.answerBoolean === true) return hasValue;
      if (ew.answerBoolean === false) return !hasValue;
      return false;
    }

    // evalCondition expects values in the same format as formValues (QuestionnaireResponseItems)
    return evalCondition(
      {
        question: ew.question,
        operator: ew.operator, // 'exists' is now excluded, matching the type
        answerBoolean: ew.answerBoolean,
        answerDate: ew.answerDate,
        answerString: ew.answerString,
        answerInteger: ew.answerInteger,
      },
      formValues,
      questionItem.type
    );
  };

  if (enableBehavior === 'any') {
    return enableWhen.some(evalSingleCondition);
  }
  return enableWhen.every(evalSingleCondition);
};

const evalItemText = (item: IntakeQuestionnaireItem, allValues: Record<string, any>): string => {
  if (!item.textWhen) {
    return item.text || '';
  }

  const shouldUseSubstituteText = evalCondition(item.textWhen, allValues, item.type);
  return shouldUseSubstituteText ? item.textWhen.substituteText : item.text || '';
};

const evalComplexValidationTrigger = (item: IntakeQuestionnaireItem, allValues: Record<string, any>): boolean => {
  if (!item.complexValidation?.triggerWhen) {
    return false;
  }

  return evalCondition(item.complexValidation.triggerWhen, allValues, item.type);
};

// FIX: The return type is now correct for a schema wrapped in .superRefine()
const makeValidationSchemaPrivate = (input: {
  items: IntakeQuestionnaireItem[];
  externalContext?: { values: any; items: any };
}): z.ZodEffects<z.AnyZodObject> => {
  const { items, externalContext } = input;

  const shape: z.ZodRawShape = {};
  items.forEach((item) => {
    if (item.type !== 'display' && !item.readOnly) {
      shape[item.linkId] = z.any().optional();
    }
  });

  return z.object(shape).superRefine((formValues, ctx) => {
    const externalData = externalContext?.values ?? {};

    // Merge all values, with current form values taking precedence
    // This ensures:
    // 1. Current page values override any stale external values
    // 2. External values are still available for cross-page conditions (like enableWhen)
    const allValues = { ...externalData, ...formValues };

    // Debug logging for "How did you hear about us?" issue
    if (items.some((item) => item.linkId === 'patient-point-of-discovery')) {
      console.log('[VALIDATION DEBUG] patient-point-of-discovery page:', {
        'is-new-qrs-patient in externalData': externalData['is-new-qrs-patient'],
        'is-new-qrs-patient in formValues': formValues['is-new-qrs-patient'],
        'is-new-qrs-patient in allValues': allValues['is-new-qrs-patient'],
        externalDataKeys: Object.keys(externalData),
        formValuesKeys: Object.keys(formValues),
      });
    }

    for (const item of items) {
      if (item.type === 'display' || item.readOnly) continue;

      const isFiltered = evalFilterWhen(item, allValues);
      if (isFiltered) continue;

      const isRequired = evalRequired(item, allValues);
      const value = formValues[item.linkId] as QuestionnaireResponseItem | undefined;

      // Check if the value is already a direct value (string, boolean, etc.) rather than QuestionnaireResponseItem
      let answerValue: any;
      let hasValue: boolean;

      if (value && typeof value === 'object' && 'answer' in value && Array.isArray(value.answer)) {
        // It's a QuestionnaireResponseItem with answer
        hasValue = itemAnswerHasValue(value.answer);
        answerValue = hasValue ? pickFirstValueFromAnswerItem(value) : undefined;
      } else if (item.type === 'group' && value && typeof value === 'object') {
        // It's a group item - check if it has valid sub-items
        const items = (value as any).item;

        if (!items || !Array.isArray(items) || items.length === 0) {
          // No items array or empty items array
          hasValue = false;
        } else {
          // Check if any of the items have valid content
          hasValue = items.some((subItem: any) => {
            if (!subItem || typeof subItem !== 'object') return false;

            // Check if the subItem has a valid answer
            if ('answer' in subItem && Array.isArray(subItem.answer)) {
              const hasValidAnswer = itemAnswerHasValue(subItem.answer);
              return hasValidAnswer;
            }

            // Check if it has nested items
            if ('item' in subItem && Array.isArray(subItem.item) && subItem.item.length > 0) {
              return true;
            }

            // If it only has linkId, it's not valid
            const keys = Object.keys(subItem);
            const isValid = keys.length > 1 && !keys.every((k) => k === 'linkId' || subItem[k] === undefined);
            return isValid;
          });
        }
      } else {
        // It's a direct value
        answerValue = value;
        hasValue = answerValue !== undefined && answerValue !== null && answerValue !== '';
      }

      if (isRequired && !hasValue) {
        ctx.addIssue({
          code: ZodIssueCode.custom,
          path: [item.linkId],
          message: REQUIRED_FIELD_ERROR_MESSAGE,
        });
        continue;
      }

      if (!hasValue) continue;

      if (typeof answerValue === 'string') {
        if (!emojiRegex.test(answerValue)) {
          ctx.addIssue({
            code: ZodIssueCode.custom,
            path: [item.linkId],
            message: 'Emojis are not a valid character',
          });
        }
        if (PHONE_NUMBER_FIELDS.includes(item.linkId) || item.dataType === 'Phone Number') {
          if (!phoneRegex.test(answerValue)) {
            ctx.addIssue({
              code: ZodIssueCode.custom,
              path: [item.linkId],
              message: 'Phone number must be 10 digits in the format (xxx) xxx-xxxx',
            });
          }
        }
        if (EMAIL_FIELDS.includes(item.linkId) || item.dataType === 'Email') {
          if (!emailRegex.test(answerValue)) {
            ctx.addIssue({ code: ZodIssueCode.custom, path: [item.linkId], message: 'Email is not valid' });
          }
        }
        if (ZIP_CODE_FIELDS.includes(item.linkId) || item.dataType === 'ZIP') {
          if (!zipRegex.test(answerValue)) {
            ctx.addIssue({ code: ZodIssueCode.custom, path: [item.linkId], message: 'ZIP Code must be 5 numbers' });
          }
        }
      }

      if (item.type === 'date' && item.dataType === 'DOB' && typeof answerValue === 'string') {
        if (!isoDateRegex.test(answerValue)) {
          ctx.addIssue({ code: ZodIssueCode.custom, path: [item.linkId], message: DATE_ERROR_MESSAGE });
        } else {
          const dt = DateTime.fromISO(answerValue);
          const now = DateTime.now();
          if (dt > now) {
            ctx.addIssue({ code: ZodIssueCode.custom, path: [item.linkId], message: 'Date may not be in the future' });
          }
          if (item.validateAgeOver !== undefined) {
            // FIX: Ensure ageOver is treated as a number before use.
            const ageOver =
              typeof item.validateAgeOver === 'string' ? parseInt(item.validateAgeOver, 10) : item.validateAgeOver;
            if (ageOver && !isNaN(ageOver) && dt > now.minus({ years: ageOver })) {
              ctx.addIssue({
                code: ZodIssueCode.custom,
                path: [item.linkId],
                message: `Must be ${item.validateAgeOver} years or older`,
              });
            }
          }
        }
      }
    }
  });
};

export const makeValidationSchema = (
  items: IntakeQuestionnaireItem[],
  pageId?: string,
  externalContext?: { values: any; items: any }
): any => {
  if (pageId) {
    const pageItems = items.find((i) => i.linkId === pageId)?.item || items;
    return makeValidationSchemaPrivate({ items: pageItems, externalContext });
  }

  console.warn('Whole-questionnaire validation with Zod is not fully implemented in this replacement.');

  // Return an object that mimics Yup's validation API for backward compatibility
  return {
    validate: async (values: any) => {
      // For now, we'll validate each page separately
      const errors: any[] = [];
      for (const pageItem of items) {
        if (pageItem.item) {
          try {
            const pageSchema = makeValidationSchemaPrivate({
              items: pageItem.item,
              externalContext: { values: values, items: items.flatMap((i) => i.item || []) },
            });

            // Extract the page values
            const pageValues = values.find((v: any) => v.linkId === pageItem.linkId);
            if (pageValues && pageValues.item) {
              const pageData: Record<string, any> = {};
              pageValues.item.forEach((item: any) => {
                pageData[item.linkId] = item;
              });

              // Parse with Zod
              const result = pageSchema.safeParse(pageData);
              if (!result.success) {
                result.error.issues.forEach((issue) => {
                  errors.push({
                    path: `${pageItem.linkId}.${issue.path.join('.')}`,
                    message: issue.message,
                  });
                });
              }
            }
          } catch (e) {
            console.error(`Error validating page ${pageItem.linkId}:`, e);
          }
        }
      }

      if (errors.length > 0) {
        const error = new Error('Validation failed');
        (error as any).inner = errors;
        throw error;
      }

      return values;
    },
  };
};

/*
  given any list of questionnaire items and values representing answers to those items,
  filter out any values that should not be included in the form submission, whether because
  those values represent invalid "empty" states or because they are logically excluded based
  on the application of the filter-when extension.
  filtered out values aren't actually removed but rather are normalized to { linkId } w/out
  any answer or item props. this makes for valid fhir and also ensure ordering is preserved
  within groups (which may be important for downstream implementation)
*/
export const recursiveGroupTransform = (items: IntakeQuestionnaireItem[], values: any): any => {
  const filteredItems = items.filter((item) => item && item?.type !== 'display' && !item?.readOnly);
  const stringifiedInput = JSON.stringify(values);
  const output = filteredItems.map((item) => {
    const match = values?.find((i: any) => {
      return i?.linkId === item?.linkId;
    });
    if (!match || evalFilterWhen(item, values)) {
      return { linkId: item.linkId };
    }
    if (match.item) {
      return { ...trimInvalidAnswersFromItem(match), item: recursiveGroupTransform(match.item ?? [], match.item) };
    } else {
      return trimInvalidAnswersFromItem(match);
    }
  });

  const stringifiedOutput = JSON.stringify(output);
  if (stringifiedInput === stringifiedOutput) {
    return output;
  } else {
    return recursiveGroupTransform(items, output);
  }
};

const trimInvalidAnswersFromItem = (item: any): any => {
  if (!item.answer || !Array.isArray(item.answer) || item.answer.length === 0) {
    return { linkId: item.linkId };
  }

  // Check if all answers are empty objects or have no value properties
  const hasValidAnswer = item.answer.some((ans: any) => {
    if (!ans || typeof ans !== 'object') return false;
    return Object.keys(ans).some(
      (key) => key.startsWith('value') && ans[key] !== undefined && ans[key] !== null && ans[key] !== ''
    );
  });

  if (!hasValidAnswer) {
    return { linkId: item.linkId };
  }

  return item;
};

interface NestedItem {
  item?: NestedItem[];
}
export const flattenItems = <T extends NestedItem>(items: T[]): any => {
  let itemsList = items;
  if (typeof items === 'object') {
    itemsList = Object.values(items);
  }
  return itemsList?.flatMap((i) => {
    if (i?.item) {
      return flattenItems(i?.item);
    }
    return i;
  });
};

export { evalCondition, evalEnableWhen, evalFilterWhen, evalRequired, evalItemText, evalComplexValidationTrigger };
