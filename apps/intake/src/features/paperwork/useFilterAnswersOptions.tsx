import { QuestionnaireItemAnswerOption } from 'fhir/r4b';
import { FieldValues } from 'react-hook-form';
import { type QuestionnaireItemExtension } from 'utils';
import { useQRState } from './useFormHelpers';

const OPERATORS = ['=', '!='];

export const useFilterAnswersOptions = (options: QuestionnaireItemAnswerOption[]): QuestionnaireItemAnswerOption[] => {
  const { allFields: allValues } = useQRState();
  return options.filter((option) => {
    const enabledWhenExtensions =
      option.extension?.filter(
        (extension) => extension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/answer-enable-when'
      ) ?? [];

    if (enabledWhenExtensions.length === 0) {
      return true;
    }

    for (const extension of enabledWhenExtensions) {
      if (evaluateExpression(extension.valueString, allValues)) {
        return true;
      }
    }

    return false;
  });
};

/**
 * Filter answer options using parsed answer-display-filter data from the item.
 *
 * Each filter has conditions (all must match) and includeValues.
 * The first matching filter determines which options to show (by intersection with the superset).
 * If no filter matches or no filters exist, all options are returned.
 */
export const useDisplayFilteredOptions = (
  answerDisplayFilters: QuestionnaireItemExtension['answerDisplayFilters'],
  options: QuestionnaireItemAnswerOption[]
): QuestionnaireItemAnswerOption[] => {
  const { allFields: allValues } = useQRState();

  if (!answerDisplayFilters || answerDisplayFilters.length === 0) {
    return options;
  }

  // Find the first filter where ALL conditions match
  for (const filter of answerDisplayFilters) {
    const allConditionsMet =
      filter.conditions.length > 0 &&
      filter.conditions.every(({ question, operator, answer }) => {
        const actualValue = allValues[question]?.answer?.[0]?.valueString;
        return evalStringCondition(operator, answer, actualValue);
      });

    if (allConditionsMet) {
      // Filter by intersection: only include options whose value is in includeValues
      const includeSet = new Set(filter.includeValues);
      return options.filter((opt) => includeSet.has(opt.valueString ?? ''));
    }
  }

  // No filter matched — return all options
  return options;
};

/**
 * Evaluate a string condition using the same operator semantics as the
 * questionnaire engine (enableWhen, requireWhen, filterWhen, etc.).
 * Supports: 'exists', '=', '!='
 */
function evalStringCondition(operator: string, answerValue: string, actualValue: string | undefined): boolean {
  if (operator === 'exists') {
    return actualValue !== undefined;
  }
  if (operator === '=') {
    return answerValue === actualValue;
  }
  if (operator === '!=') {
    return answerValue !== actualValue;
  }
  return false;
}

function evaluateExpression(expression: string | undefined, allValues: FieldValues): boolean {
  if (!expression) {
    return false;
  }

  let tokens: string[] = [];
  let usedOperator = '';

  for (const operator of OPERATORS) {
    tokens = expression.split(` ${operator} `);
    if (tokens.length === 2) {
      usedOperator = operator;
      break;
    }
  }

  if (tokens.length != 2) {
    return false;
  }

  const [targetLinkId, targetAnswer] = tokens;
  const actualTargetValue = allValues[targetLinkId]?.answer?.[0]?.valueString;

  if (usedOperator === '!=') {
    return actualTargetValue !== targetAnswer;
  }

  if (usedOperator === '=') {
    return actualTargetValue === targetAnswer;
  }

  return false;
}
