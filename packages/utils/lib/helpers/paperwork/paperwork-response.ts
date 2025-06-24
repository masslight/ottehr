import { QuestionnaireResponse, QuestionnaireResponseItem, QuestionnaireResponseItemAnswer } from 'fhir/r4b';

interface QuestionnaireResponseItemAnswerWithValueArray extends QuestionnaireResponseItemAnswer {
  valueArray?: Record<string, string>[];
}

interface QuestionnaireResponseItemWithValueArray extends QuestionnaireResponseItem {
  answer: QuestionnaireResponseItemAnswerWithValueArray[];
}

// todo: This helper is used in multiple components. After changing the paperwork structure,
//  we need to update how components work with the data. As a quick fix - we convert the new
//  format to the format that components are currently working with.
export const getQuestionnaireResponseByLinkId = (
  linkId: string,
  questionnaireResponse?: QuestionnaireResponse
): QuestionnaireResponseItemWithValueArray | undefined => {
  if (!questionnaireResponse?.item) return undefined;

  const findItemDeep = (items: QuestionnaireResponseItem[]): QuestionnaireResponseItem | undefined => {
    for (const item of items) {
      if (item.linkId === linkId) return item;
      if (item.item) {
        const found = findItemDeep(item.item);
        if (found) return found;
      }
    }
    return undefined;
  };

  const item = findItemDeep(questionnaireResponse.item);
  if (!item) return undefined;

  return mapPaperworkResponseItem(item);
};

export const mapPaperworkResponseItem = (item: QuestionnaireResponseItem): QuestionnaireResponseItemWithValueArray => {
  if (!item.item) {
    return item as QuestionnaireResponseItemWithValueArray;
  }

  const valueArray = item.item.reduce<Record<string, any>[]>((acc, subItem) => {
    if (subItem.answer?.length) {
      const values = subItem.answer.map((answer) => ({
        [subItem.linkId]: answer.valueString || answer.valueBoolean || answer.valueAttachment,
      }));
      acc.push(...values);
    }
    return acc;
  }, []);

  return {
    ...item,
    answer: [
      {
        valueArray,
      },
    ],
  };
};
