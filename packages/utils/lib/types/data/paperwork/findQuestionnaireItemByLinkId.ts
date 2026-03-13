import { QuestionnaireItem } from 'fhir/r4b';

/**
 * Finds a QuestionnaireItem by linkId in a nested structure of QuestionnaireItems
 * Recursively searches through the item hierarchy
 */
export const findQuestionnaireItemByLinkId = (
  items: QuestionnaireItem[],
  linkId: string
): QuestionnaireItem | undefined => {
  for (const item of items) {
    if (item.linkId === linkId) return item;
    if (item.item) {
      const found = findQuestionnaireItemByLinkId(item.item, linkId);
      if (found) return found;
    }
  }
  return undefined;
};
