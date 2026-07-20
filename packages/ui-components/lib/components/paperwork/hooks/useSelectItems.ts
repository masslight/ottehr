import { _objectKeys } from 'fast-json-patch/module/helpers';
import { QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { evalEnableWhen, IntakeQuestionnaireItem } from 'utils';

type DisplayStrategy = 'enabled' | 'hidden' | 'protected';
// this is called without all items in one place
export const getItemDisplayStrategy = (
  item: IntakeQuestionnaireItem,
  items: IntakeQuestionnaireItem[],
  values: { [itemLinkId: string]: QuestionnaireResponseItem },
  questionnaireResponse?: QuestionnaireResponse
): DisplayStrategy => {
  if (item.readOnly) {
    return item.disabledDisplay ?? 'hidden';
  }
  const enabled = evalEnableWhen(item, items, values, questionnaireResponse);
  return enabled ? 'enabled' : item.disabledDisplay ?? 'hidden';
};
