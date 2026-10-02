import { QuestionnaireItemAnswerOption } from 'fhir/r4b';
import { getExtension } from 'utils/lib/fhir/helpers';
import { getAnswerOptionValue, getAnswerValueAsString } from 'utils/lib/helpers/paperwork/paperwork';
import { useQRState } from './useFormHelpers';

const OPERATORS = ['=', '!='];

export const useAnswerOptionLabelWhen = (options: QuestionnaireItemAnswerOption[]): Record<string, string> => {
  const { allFields: allValues } = useQRState();

  const result: Record<string, string> = {};

  for (const option of options) {
    const labelWhenExpression = getExtension(
      option,
      'https://fhir.zapehr.com/r4/StructureDefinitions/answer-label-when'
    )?.valueString;

    const optionValue = getAnswerOptionValue(option);
    if (!labelWhenExpression || !optionValue) {
      continue;
    }

    const [expression, label] = labelWhenExpression.split(' : ');

    let expressionTokens: string[] = [];
    let usedOperator = '';

    for (const operator of OPERATORS) {
      expressionTokens = expression.split(` ${operator} `);
      if (expressionTokens.length === 2) {
        usedOperator = operator;
        break;
      }
    }

    if (expressionTokens.length != 2) {
      continue;
    }

    const [targetLinkId, targetAnswer] = expressionTokens;
    const actualTargetValue = getAnswerValueAsString(allValues[targetLinkId]?.answer?.[0]);

    if (usedOperator === '!=' && actualTargetValue !== targetAnswer) {
      result[optionValue] = label;
    }

    if (usedOperator === '=' && actualTargetValue === targetAnswer) {
      result[optionValue] = label;
    }
  }

  return result;
};
