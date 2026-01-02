import { Questionnaire, QuestionnaireResponseItem } from 'fhir/r4b';
import { evalEnableWhen } from '../../../helpers/paperwork/validation';
import { createQuestionnaireItemsMap } from './createQuestionnaireItemsMap';
import { IntakeQuestionnaireItem } from './paperwork.types';

export const filterQuestionnaireResponseByEnableWhen = (
  responseItems: QuestionnaireResponseItem[],
  questionnaire: Questionnaire
): QuestionnaireResponseItem[] => {
  if (!questionnaire.item) {
    return responseItems;
  }

  const questionnaireItemsMap = createQuestionnaireItemsMap(questionnaire.item);

  const values: Record<string, QuestionnaireResponseItem> = {};
  responseItems.forEach((item) => {
    values[item.linkId] = item;
  });

  return responseItems.filter((responseItem) => {
    const itemDef = questionnaireItemsMap.get(responseItem.linkId);

    if (!itemDef) {
      return true;
    }

    if (!itemDef.enableWhen || itemDef.enableWhen.length === 0) {
      return true;
    }

    try {
      const shouldShow = evalEnableWhen(
        itemDef as IntakeQuestionnaireItem,
        questionnaire.item as IntakeQuestionnaireItem[],
        values,
        undefined,
        questionnaireItemsMap
      );

      if (!shouldShow) {
        console.log(`Filtering out item ${responseItem.linkId} - hidden by enableWhen condition`);
      }

      return shouldShow;
    } catch (error) {
      console.warn(`Error evaluating enableWhen for ${responseItem.linkId}:`, error);
      return true;
    }
  });
};
