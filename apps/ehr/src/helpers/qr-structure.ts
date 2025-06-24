import { Questionnaire, QuestionnaireItem, QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import _ from 'lodash';
import { IntakeQuestionnaireItem, makeQRResponseItem, mapQuestionnaireAndValueSetsToItemsList } from 'utils';

const containedItemWithLinkId = (item: QuestionnaireItem, linkId: string): QuestionnaireItem | undefined => {
  // note: if item.linkId === linkId, return item
  const { linkId: itemLinkId, item: subItems } = item;
  if (itemLinkId === linkId) return item;
  if (!subItems) return undefined;
  return subItems.find((subItem) => containedItemWithLinkId(subItem, linkId));
};

export const structureQuestionnaireResponse = (
  questionnaire: Questionnaire,
  formValues: any,
  patientId: string
): QuestionnaireResponse => {
  const pageDict: Map<string, QuestionnaireResponseItem[]> = new Map();

  const itemInput = questionnaire.item ?? [];
  const qItems = mapQuestionnaireAndValueSetsToItemsList(_.cloneDeep(itemInput), []);
  qItems.forEach((item) => {
    pageDict.set(item.linkId, []);
  });

  Object.entries(formValues).forEach(([key, value]) => {
    const parentItem = qItems?.find((item) => containedItemWithLinkId(item, key));
    if (parentItem) {
      const pageItems = pageDict.get(parentItem.linkId);
      const qItem = containedItemWithLinkId(parentItem, key) as IntakeQuestionnaireItem;
      if (pageItems && qItem) {
        const answer = value != undefined ? makeQRResponseItem(value, qItem) : undefined;
        if (answer) {
          pageItems.push(answer);
          pageDict.set(parentItem.linkId, pageItems);
        } else {
          pageItems.push({ linkId: key });
          pageDict.set(parentItem.linkId, pageItems);
        }
      }
    }
  });
  const qrItem: QuestionnaireResponseItem[] = Array.from(pageDict.entries())
    .map(([linkId, items]) => {
      const item: QuestionnaireResponseItem = {
        linkId,
        item: items,
      };
      return item;
    })
    .filter((i) => Boolean(i.item?.length));

  return {
    resourceType: 'QuestionnaireResponse',
    questionnaire: `${questionnaire.url}|${questionnaire.version}`,
    status: 'completed',
    subject: { reference: `Patient/${patientId}` },
    item: qrItem,
  };
};
