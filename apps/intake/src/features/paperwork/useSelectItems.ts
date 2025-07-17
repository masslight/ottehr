import { GridSize } from '@mui/system';
import { _objectKeys } from 'fast-json-patch/module/helpers';
import { QuestionnaireItem, QuestionnaireResponseItem } from 'fhir/r4b';
import { evalEnableWhen, IntakeQuestionnaireItem } from 'utils';

export interface StyledQuestionnaireItem extends QuestionnaireItem {
  hideControlLabel: boolean;
  width?: GridSize;
  isFullWidth?: boolean;
}

type DisplayStrategy = 'enabled' | 'hidden' | 'protected';
// this is called without all items in one place
export const getItemDisplayStrategy = (
  item: IntakeQuestionnaireItem,
  items: IntakeQuestionnaireItem[],
  values: { [itemLinkId: string]: QuestionnaireResponseItem }
): DisplayStrategy => {
  if (item.readOnly) {
    return item.disabledDisplay ?? 'hidden';
  }
  const enabled = evalEnableWhen(item, items, values);
  return enabled ? 'enabled' : item.disabledDisplay ?? 'hidden';
};
