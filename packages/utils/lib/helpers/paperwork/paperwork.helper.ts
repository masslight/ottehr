import { QuestionnaireItem } from 'fhir/r4';
import { FormItemType, Question, QuestionOperator } from '../../types';

export const oldToCurrentOptionMappings: { [linkId: string]: { [oldValue: string]: string } } = {
  'patient-pronouns': {
    // oldValue: correctValue
    'He/him/his': 'He/him',
    'He/him/him': 'He/him',
    'She/her/hers': 'She/her',
    'She/her/her': 'She/her',
    'They/them/theirs': 'They/them',
    'They/them/their': 'They/them',
    'My pronounces are not listed': 'My pronouns are not listed',
  },
};

export function getCorrectInputOption(itemId: string, currentValue: string): string | undefined {
  const itemOptionMapping = oldToCurrentOptionMappings[itemId];
  return itemOptionMapping && itemOptionMapping[currentValue] ? itemOptionMapping[currentValue] : currentValue;
}

export function questionnaireItemToInputType(item: QuestionnaireItem): Question {
  const questionItemType = item.type;
  let formItemType: FormItemType = undefined;
  let subitem: Question[] | undefined = undefined;
  let linkId = item.linkId;

  const attributes = item.extension?.map((extensionTemp) => ({
    name: extensionTemp.url.replace('https://fhir.zapehr.com/r4/StructureDefinitions/', ''),
    value: extensionTemp.valueString || extensionTemp.valueBoolean || extensionTemp.valuePositiveInt,
  }));
  let multiline = false;

  if (questionItemType === 'string') {
    formItemType = 'Text';
    // const inputType = item.extension?.find(
    //   (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/input-type'
    // )?.valueString;
  } else if (questionItemType === 'choice') {
    formItemType = 'Select';
    if (attributes?.find((attributeTemp) => attributeTemp.name === 'select-type' && attributeTemp.value === 'Radio')) {
      formItemType = 'Radio';
    }
    if (
      attributes?.find((attributeTemp) => attributeTemp.name === 'select-type' && attributeTemp.value == 'Radio List')
    ) {
      formItemType = 'Radio List';
    }
  } else if (questionItemType === 'display') {
    const textType = item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/text-type'
    )?.valueString;
    if (textType === 'h3') {
      formItemType = 'Header 3';
    } else if (textType === 'h4') {
      formItemType = 'Header 4';
    } else if (textType === 'button') {
      formItemType = 'Button';
    } else if (textType === 'p') {
      formItemType = 'Description';
    }
  } else if (questionItemType === 'date') {
    if (attributes?.find((attributeTemp) => attributeTemp.name === 'date-type' && attributeTemp.value === 'year')) {
      formItemType = 'Year';
    } else {
      formItemType = 'Date';
    }
  } else if (questionItemType === 'text') {
    formItemType = 'Text';
    multiline = true;
  } else if (questionItemType === 'attachment') {
    formItemType = 'File';
  } else if (questionItemType === 'boolean') {
    formItemType = 'Checkbox';
  } else if (questionItemType === 'group') {
    if (
      attributes?.find(
        (attributeTemp) => attributeTemp.name === 'group-type' && attributeTemp.value === 'list-with-form'
      )
    ) {
      formItemType = 'Form list';
    } else {
      formItemType = 'Group';
    }
    subitem = item.item?.map((innerItem) => questionnaireItemToInputType(innerItem));
  }

  const customLinkId = attributes?.find((attributeTemp) => attributeTemp.name === 'custom-link-id');
  if (customLinkId) {
    linkId = `${customLinkId.value}`;
  }

  const enableWhen = item.enableWhen;
  const enableWhenQuestion = item.enableWhen?.[0].question;
  const enableWhenOperator = item.enableWhen?.[0].operator;
  const enableWhenAnswer = item.enableWhen?.[0].answerString;

  const requireWhen = item.extension?.find(
    (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when'
  )?.extension;
  const requireWhenQuestion = requireWhen?.find(
    (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question'
  )?.valueString;
  const requireWhenOperator: QuestionOperator = requireWhen?.find(
    (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator'
  )?.valueString as QuestionOperator;
  const requireWhenAnswer = requireWhen?.find(
    (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer'
  )?.valueString;

  const minRows = attributes?.find((attributeTemp) => attributeTemp.name === 'input-multiline-minimum-rows')
    ?.value as number;

  return {
    id: linkId,
    text: item.text || 'Unknown',
    type: formItemType,
    item: subitem,
    multiline,
    minRows,
    placeholder: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/placeholder'
    )?.valueString,
    infoText: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/information-text'
    )?.valueString,
    infoTextSecondary: item.extension?.find(
      (extensionTemp) =>
        extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/information-text-secondary'
    )?.valueString,
    required: item.required,
    width: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/text-width'
    )?.valuePositiveInt,
    options: item.answerOption?.map((option) => option.valueString || 'Unknown'),
    attachmentText: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/attachment-text'
    )?.valueString,
    format: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/input-format'
    )?.valueString,
    docType: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/document-type'
    )?.valueString,
    enableWhen: enableWhen
      ? {
          question: enableWhenQuestion || 'Unknown',
          operator: enableWhenOperator,
          answer: enableWhenAnswer || 'Unknown',
        }
      : undefined,
    requireWhen: requireWhen
      ? {
          question: requireWhenQuestion || 'Unknown',
          operator: requireWhenOperator,
          answer: requireWhenAnswer || 'Unknown',
        }
      : undefined,
  };
}
