import { QuestionnaireItemAnswerOption } from 'fhir/r4b';
import { FieldValues } from 'react-hook-form';
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
