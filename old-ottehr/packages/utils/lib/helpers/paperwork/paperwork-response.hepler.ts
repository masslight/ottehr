import { QuestionnaireResponseItem, QuestionnaireResponseItemAnswer } from 'fhir/r4';
import { FHIR_EXTENSION } from '../../fhir';

interface QuestionnaireResponseItemAnswerWithValueArray extends QuestionnaireResponseItemAnswer {
  valueArray?: Record<string, string>[];
}

interface QuestionnaireResponseItemWithValueArray extends QuestionnaireResponseItem {
  answer: QuestionnaireResponseItemAnswerWithValueArray[];
}

export const mapPaperworkResponseItem = (item: QuestionnaireResponseItem): QuestionnaireResponseItemWithValueArray => {
  if (item.extension) {
    return {
      ...item,
      answer: [
        ...(item.answer || []),
        {
          valueArray: item.extension
            .filter((extension) => extension.url === FHIR_EXTENSION.Paperwork.formListValues.url)
            .map((extension) => {
              return (
                extension.extension?.reduce(
                  (accumulator, currentValue) => {
                    const key = currentValue.extension?.find((extension) => extension.url === 'code')?.valueCode;
                    const value = currentValue.extension?.find((extension) => extension.url === 'value')?.valueString;

                    if (!key) {
                      return accumulator;
                    }

                    accumulator[key] = value ?? '';
                    return accumulator;
                  },
                  {} as Record<string, string>
                ) || {}
              );
            }),
        },
      ],
      extension: item.extension.filter((extension) => extension.url != FHIR_EXTENSION.Paperwork.formListValues.url),
    };
  }
  return item as QuestionnaireResponseItemWithValueArray;
};
