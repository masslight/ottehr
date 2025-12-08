import { QuestionnaireItemAnswerOption } from 'fhir/r4b';
import { getExtension } from 'utils';
import { useQRState } from './useFormHelpers';

const OPERATORS = ['=', '!='];

export const useFilterAnswersOptions = (options: QuestionnaireItemAnswerOption[]): QuestionnaireItemAnswerOption[] => {
  const { allFields: allValues } = useQRState();
  return options.filter((option) => {
    const enabledWhenExpression = getExtension(
      option,
      'https://fhir.zapehr.com/r4/StructureDefinitions/answer-enable-when'
    )?.valueString;

    if (!enabledWhenExpression) {
      return true;
    }

    let tokens: string[] = [];
    let usedOperator = '';

    for (const operator of OPERATORS) {
      tokens = enabledWhenExpression.split(` ${operator} `);
      if (tokens.length === 2) {
        usedOperator = operator;
        break;
      }
    }

    if (tokens.length != 2) {
      return true;
    }

    const [targetLinkId, targetAnswer] = tokens;
    const actualTargetValue = allValues[targetLinkId]?.answer?.[0]?.valueString;

    if (usedOperator === '!=') {
      return actualTargetValue !== targetAnswer;
    }

    if (usedOperator === '=') {
      return actualTargetValue === targetAnswer;
    }

    return true;
  });
};
