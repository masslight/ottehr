import { QuestionnaireItem } from 'fhir/r4b';

/**
 * Creates a Map of linkId to QuestionnaireItem for O(1) lookups
 * Useful when you need to lookup many items in a nested questionnaire structure
 */
export const createQuestionnaireItemsMap = (items: QuestionnaireItem[]): Map<string, QuestionnaireItem> => {
  const map = new Map<string, QuestionnaireItem>();

  const addToMap = (itemsToAdd: QuestionnaireItem[]): void => {
    itemsToAdd.forEach((item) => {
      map.set(item.linkId, item);
      if (item.item) {
        addToMap(item.item);
      }
    });
  };

  addToMap(items);
  return map;
};
