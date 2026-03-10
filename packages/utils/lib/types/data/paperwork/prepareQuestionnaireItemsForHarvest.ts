import { Questionnaire, QuestionnaireResponseItem } from 'fhir/r4b';
import { evalEnableWhen } from '../../../helpers/paperwork/validation';
import { createQuestionnaireItemsMap } from './createQuestionnaireItemsMap';
import { flattenQuestionnaireAnswers, IntakeQuestionnaireItem } from './paperwork.types';

const filterQuestionnaireResponseByEnableWhen = (
  responseItems: QuestionnaireResponseItem[],
  questionnaire: Questionnaire,
  allResponseItems?: QuestionnaireResponseItem[]
): QuestionnaireResponseItem[] => {
  if (!questionnaire.item) {
    return responseItems;
  }

  const questionnaireItemsMap = createQuestionnaireItemsMap(questionnaire.item);

  // Build values map from all response items (not just the section being harvested)
  // so that cross-section enableWhen references can be resolved.
  const values: Record<string, QuestionnaireResponseItem> = {};
  (allResponseItems ?? responseItems).forEach((item) => {
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
      // note: it is not always the case that disabled fields ought to be filtered from what's harvested
      // this implementation may indicate a case where a field or group of fields should have a "filterWhen"
      // extension in addition to the enableWhen extension it does have. Leaving in place for now as would need
      // to id the specific piece of config to evaluate.
      const shouldShow = evalEnableWhen(
        itemDef as IntakeQuestionnaireItem,
        questionnaire.item as IntakeQuestionnaireItem[],
        values,
        undefined,
        questionnaireItemsMap
      );

      if (!shouldShow) {
        console.log(`Filtering out item ${responseItem.linkId} - hidden by enableWhen condition`);
        console.log(`  enableWhen: ${JSON.stringify(itemDef.enableWhen)}`);
        console.log(`  values for question: ${JSON.stringify(values[itemDef.enableWhen?.[0]?.question || ''])}`);
      }

      return shouldShow;
    } catch (error) {
      console.warn(`Error evaluating enableWhen for ${responseItem.linkId}:`, error);
      return true;
    }
  });
};

export interface QuestionnaireResponseHarvestInput {
  questionnaireResponseItems: QuestionnaireResponseItem[];
  sourceQuestionnaire?: Questionnaire;
  options?: {
    filterByEnableWhen?: boolean;
    includeSections?: string[];
  };
}

export const prepareQuestionnaireResponseForHarvest = (
  input: QuestionnaireResponseHarvestInput
): QuestionnaireResponseItem[] => {
  const { questionnaireResponseItems, sourceQuestionnaire, options } = input;
  const filterByEnableWhen = options?.filterByEnableWhen ?? false;
  const includeSections = options?.includeSections;
  let filteredSections = questionnaireResponseItems;
  if (includeSections && includeSections.length > 0) {
    filteredSections = filteredSections.filter(
      (item) => item.item !== undefined && includeSections.includes(item.linkId)
    );
  }

  let flattened = flattenQuestionnaireAnswers(filteredSections);

  if (sourceQuestionnaire && filterByEnableWhen) {
    // Flatten all items to build a complete values map for cross-section enableWhen evaluation
    const allFlattened =
      includeSections && includeSections.length > 0
        ? flattenQuestionnaireAnswers(questionnaireResponseItems)
        : undefined;
    flattened = filterQuestionnaireResponseByEnableWhen(flattened, sourceQuestionnaire, allFlattened);
  }

  return flattened;
};
