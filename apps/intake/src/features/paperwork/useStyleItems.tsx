import { GridSize } from '@mui/system';
import { QuestionnaireItemAnswerOption, QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { useMemo } from 'react';
import {
  CONSENT_FORMS_CONFIG,
  EMAIL_FIELDS,
  evalItemText,
  evalRequired,
  FULL_ADDRESS_FIELDS,
  IntakeQuestionnaireItem,
  PHONE_NUMBER_FIELDS,
  SIGNATURE_FIELDS,
} from 'utils';
import { usePaperworkContext } from './context';
import { useQRState } from './useFormHelpers';
import { getItemDisplayStrategy } from './useSelectItems';

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

  // Preferred source: the `hideControlLabel` extension on the FHIR
  // Questionnaire item (config-side flag on FormFieldsValueTypeBaseSchema,
  // written by createHideControlLabelExtension, read by structureExtension).
  // Fallback: the hardcoded linkId list below — kept for back-compat with
  // questionnaire archives generated before the extension existed, plus
  // the CONSENT_FORMS_CONFIG.forms case which comes from a dynamic source
  // that hasn't been migrated to the extension yet. Once every archive is
  // regenerated with hideControlLabel on the config items (see the entries
  // in packages/utils/lib/ottehr-config/intake-paperwork*/index.ts) the
  // fallback list can be reduced to just the dynamic-forms entries.
  //
  // Tri-state semantics: item.hideControlLabel === true → hide; === false
  // → force-show even if the linkId is on the fallback list (explicit
  // override); undefined → consult the fallback list.
  const hidesLabel =
    item.hideControlLabel ??
    [
      'mobile-opt-in',
      'policy-holder-address-as-patient',
      'policy-holder-address-as-patient-2',
      'display-secondary-insurance',
      'responsible-party-address-as-patient',
      'emergency-contact-address-as-patient',
      'pharmacy-page-manual-entry',
      ...CONSENT_FORMS_CONFIG.forms.map((form) => form.id),
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

  if (item.dataType === 'SSN') {
    placeholder = 'XXX-XX-XXXX';
    mask = '000-00-0000';
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
  },
  questionnaireResponse?: QuestionnaireResponse
): StyledQuestionnaireItem[] => {
  // console.log('values for required determination', values);
  return items.map((item) => {
    const styledItem = addStyleInfo(item);
    const displayStrategy = getItemDisplayStrategy(item, allItems, values, questionnaireResponse);
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
  initialValues: { [itemLinkId: string]: QuestionnaireResponseItem },
  questionnaireResponse?: QuestionnaireResponse
): IntakeQuestionnaireItem[] => {
  return pageItems.filter((item) => {
    const displayStrategy = getItemDisplayStrategy(item, allItems, initialValues, questionnaireResponse);
    return displayStrategy !== 'hidden';
  });
};

export const useStyledItems = (input: UseStyleItemsInputs): StyledQuestionnaireItem[] => {
  const { allItems, questionnaireResponse } = usePaperworkContext();
  const { allFields: allValues } = useQRState();
  const { formItems: items } = input;
  return useMemo(() => {
    const selectedItems = filterHiddenItems(items, allItems, allValues, questionnaireResponse);
    return applyItemStyleOverrides(selectedItems, allItems, allValues, questionnaireResponse);
  }, [allItems, allValues, items, questionnaireResponse]);
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
