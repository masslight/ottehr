import { QuestionnaireItemAnswerOption, QuestionnaireResponseItem } from 'fhir/r4b';
import { GridSize } from '@mui/system';
import {
  EMAIL_FIELDS,
  FULL_ADDRESS_FIELDS,
  PHONE_NUMBER_FIELDS,
  IntakeQuestionnaireItem,
  SIGNATURE_FIELDS,
  evalItemText,
  evalRequired,
} from 'utils';
import { getItemDisplayStrategy } from './useSelectItems';
import { useMemo } from 'react';
import { useQRState } from './useFormHelpers';
import { usePaperworkContext } from './context';

export interface StyledQuestionnaireItem extends IntakeQuestionnaireItem {
  hideControlLabel: boolean;
  displayStrategy: 'enabled' | 'hidden' | 'protected';
  isRequired: boolean;
  placeholder?: string;
  mask?: string;
  width?: GridSize;
  isFullWidth?: boolean;
  multiline?: boolean;
  minRows?: number;
}

// all of this could potentially move onto an extension
const addStyleInfo = (item: IntakeQuestionnaireItem): StyledQuestionnaireItem => {
  let width: number | undefined;
  if (item.inputWidth === 's') {
    width = 4;
  }
  if (item.inputWidth === 'm') {
    width = 6;
  }
  if (item.inputWidth === 'l') {
    width = 7;
  }
  // item.inputWidth === 'max' results in undefined for width here (default is max width)
  const isFullWidth = width === undefined;

  // todo: move this into form extensions
  const hidesLabel = [
    'mobile-opt-in',
    'hipaa-acknowledgement',
    'consent-to-treat',
    'policy-holder-address-as-patient',
    'policy-holder-address-as-patient-2',
    'display-secondary-insurance',
  ].includes(item.linkId);
  const minRows = item.minRows;

  let placeholder: string | undefined;
  let mask: string | undefined;

  // these field checks are for backwards compatibility and can be removed after 1.14
  if (EMAIL_FIELDS.includes(item.linkId) || item.dataType === 'Email') {
    placeholder = 'example@mail.com';
  }
  if (PHONE_NUMBER_FIELDS.includes(item.linkId) || item.dataType === 'Phone Number') {
    placeholder = '(XXX) XXX-XXXX';
    mask = '(000) 000-0000';
  }
  if (SIGNATURE_FIELDS.includes(item.linkId) || item.dataType === 'Signature') {
    placeholder = 'Type out your full name';
  }
  if (FULL_ADDRESS_FIELDS.includes(item.linkId)) {
    placeholder = 'Street, City, Zip Code';
  }

  return {
    ...item,
    hideControlLabel: hidesLabel,
    width,
    isFullWidth,
    minRows,
    multiline: minRows !== undefined,
    displayStrategy: 'enabled',
    placeholder,
    mask,
    isRequired: item.required ?? false,
  };
};

// for applying form-defined conditional behavior as well as one-off styling for specific items
const applyItemStyleOverrides = (
  items: IntakeQuestionnaireItem[],
  allItems: IntakeQuestionnaireItem[],
  values: {
    [itemLinkId: string]: QuestionnaireResponseItem;
  }
): StyledQuestionnaireItem[] => {
  // console.log('values for required determination', values);
  return items.map((item) => {
    const styledItem = addStyleInfo(item);
    const displayStrategy = getItemDisplayStrategy(item, allItems, values);
    styledItem.displayStrategy = displayStrategy;
    styledItem.isRequired = evalRequired(item, values);
    styledItem.text = evalItemText(item, values);
    return styledItem;
  });
};

interface UseStyleItemsInputs {
  formItems: IntakeQuestionnaireItem[];
}

// filters out hidden items
const filterHiddenItems = (
  pageItems: IntakeQuestionnaireItem[],
  allItems: IntakeQuestionnaireItem[],
  initialValues: { [itemLinkId: string]: QuestionnaireResponseItem }
): IntakeQuestionnaireItem[] => {
  return pageItems.filter((item) => {
    const displayStrategy = getItemDisplayStrategy(item, allItems, initialValues);
    return displayStrategy !== 'hidden';
  });
};

export const useStyledItems = (input: UseStyleItemsInputs): StyledQuestionnaireItem[] => {
  const { allItems } = usePaperworkContext();
  const { allFields: allValues } = useQRState();
  const { formItems: items } = input;
  return useMemo(() => {
    const selectedItems = filterHiddenItems(items, allItems, allValues);
    return applyItemStyleOverrides(selectedItems, allItems, allValues);
  }, [allItems, allValues, items]);
};

interface StyledAnswerOption extends QuestionnaireItemAnswerOption {
  label: string;
}

export const useStyledAnswerOptions = (options: QuestionnaireItemAnswerOption[]): StyledAnswerOption[] => {
  // this handles string type options only currently
  return useMemo(() => {
    const overrides: { [optionValue: string]: string } = {
      'Patient (Self)': 'Patient',
    };
    return options.map((option) => {
      const valueString = option.valueString ?? '?';
      return {
        ...option,
        label: overrides[valueString] ?? valueString,
      };
    });
  }, [options]);
};
