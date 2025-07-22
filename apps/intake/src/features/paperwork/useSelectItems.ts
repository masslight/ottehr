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

  // Debug logging for "How did you hear about us?" issue
  if (item.linkId === 'patient-point-of-discovery') {
    const isNewQrsPatientValue = values['is-new-qrs-patient'];
    console.log('[UI DEBUG] patient-point-of-discovery enableWhen check:', {
      enabled,
      'is-new-qrs-patient raw value': isNewQrsPatientValue,
      'is-new-qrs-patient answer': isNewQrsPatientValue?.answer,
      'is-new-qrs-patient answer[0]': isNewQrsPatientValue?.answer?.[0],
      'enableWhen conditions': item.enableWhen,
    });
  }

  return enabled ? 'enabled' : item.disabledDisplay ?? 'hidden';
};
