import { Questionnaire, QuestionnaireItem, ValueSet } from 'fhir/r4';
import { FormItemType, Question, QuestionOperator } from '../../types';
import { FhirClient } from '@zapehr/sdk';

export interface OptionConfig {
  label: string;
  value: string;
}

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

export async function getQuestionnaireAndValueSets(
  questionnaireName: string,
  valueSetRef: string,
  fhirClient: FhirClient,
): Promise<{ questionnaire: Questionnaire; valueSets: ValueSet[] }> {
  console.log(`searching for a questionnaire with name ${questionnaireName}`);
  const questionnaireSearch: Questionnaire[] = await fhirClient.searchResources({
    resourceType: 'Questionnaire',
    searchParams: [
      {
        name: 'name',
        value: questionnaireName,
      },
    ],
  });

  // if we do not get exactly one result, throw an error
  if (questionnaireSearch.length < 1) {
    throw new Error('Could not find questionnaire with provided name');
  } else if (questionnaireSearch.length > 1) {
    throw new Error('Found multiple questionnaires with the provided name');
  }

  // otherwise, take the one result
  const questionnaire: Questionnaire = questionnaireSearch[0];

  console.log(`searching for value sets with reference ${valueSetRef}`);
  const valueSets: ValueSet[] = await fhirClient.searchResources({
    resourceType: 'ValueSet',
    searchParams: [
      {
        name: 'reference',
        value: valueSetRef,
      },
    ],
  });
  console.log(`${valueSets.length} value sets found`);
  return { questionnaire, valueSets };
}

export function getOptionsArray(item: QuestionnaireItem, valueSets?: ValueSet[]): OptionConfig[] | undefined {
  let options;
  if (item.answerValueSet && valueSets) {
    const valueSetId = item.answerValueSet.replace('ValueSet/', '');
    const valueSetFound = valueSets.find((valueSet) => valueSet.id === valueSetId);
    options = valueSetFound?.compose?.include
      .find((included) => included.system === 'uc-questionnaire-item-value-set') // make this a const somewhere
      ?.concept?.reduce((acc: OptionConfig[], val) => {
        acc.push({ label: val.display || 'Unknown', value: val.code || 'Unknown' });
        return acc;
      }, []);
  } else {
    options = item.answerOption?.map((option) => {
      const formatOption = { label: option.valueString || 'Unknown', value: option.valueString || 'Unknown' };
      return formatOption;
    });
  }
  return options;
}

export function questionnaireItemToInputType(item: QuestionnaireItem, valueSets?: ValueSet[]): Question {
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
    if (
      attributes?.find((attributeTemp) => attributeTemp.name === 'select-type' && attributeTemp.value == 'Free select')
    ) {
      formItemType = 'Free Select';
    }
  } else if (questionItemType === 'display') {
    const textType = item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/text-type',
    )?.valueString;
    if (textType === 'h3') {
      formItemType = 'Header 3';
    } else if (textType === 'h4') {
      formItemType = 'Header 4';
    } else if (textType === 'button') {
      formItemType = 'Button';
    } else if (textType === 'p') {
      formItemType = 'Description';
    } else if (textType === 'html') {
      formItemType = 'HTML';
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
    if (
      attributes?.find((attributeTemp) => attributeTemp.name === 'attachment-type' && attributeTemp.value === 'photos')
    ) {
      formItemType = 'Photos';
    } else {
      formItemType = 'File';
    }
  } else if (questionItemType === 'boolean') {
    formItemType = 'Checkbox';
  } else if (questionItemType === 'group') {
    if (
      attributes?.find(
        (attributeTemp) => attributeTemp.name === 'group-type' && attributeTemp.value === 'list-with-form',
      )
    ) {
      formItemType = 'Form list';
    } else {
      formItemType = 'Group';
    }
    subitem = item.item?.map((innerItem) => questionnaireItemToInputType(innerItem, valueSets));
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
    (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when',
  )?.extension;
  const requireWhenQuestion = requireWhen?.find(
    (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question',
  )?.valueString;
  const requireWhenOperator: QuestionOperator = requireWhen?.find(
    (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator',
  )?.valueString as QuestionOperator;
  const requireWhenAnswer = requireWhen?.find(
    (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer',
  )?.valueString;

  const disableWhen = item.extension?.find(
    (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/disable-when',
  )?.extension;
  const disableWhenQuestion = disableWhen?.find(
    (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/disable-when-question',
  )?.valueString;
  const disableWhenOperator: QuestionOperator = disableWhen?.find(
    (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/disable-when-operator',
  )?.valueString as QuestionOperator;
  const disableWhenAnswer = disableWhen?.find(
    (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/disable-when-answer',
  )?.valueString;
  const disableWhenValue = disableWhen?.find(
    (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/disable-when-value',
  )?.valueString;

  const minRows = attributes?.find((attributeTemp) => attributeTemp.name === 'input-multiline-minimum-rows')
    ?.value as number;

  const options = getOptionsArray(item, valueSets);

  return {
    id: linkId,
    text: item.text || 'Unknown',
    type: formItemType,
    item: subitem,
    multiline,
    minRows,
    placeholder: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/placeholder',
    )?.valueString,
    helperText: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/helper-text',
    )?.valueString,
    showHelperTextIcon: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/show-helper-text-icon',
    )?.valueBoolean,
    infoText: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/information-text',
    )?.valueString,
    infoTextSecondary: item.extension?.find(
      (extensionTemp) =>
        extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/information-text-secondary',
    )?.valueString,
    required: item.required,
    submitOnChange: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/submit-on-change',
    )?.valueBoolean,
    disableError: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/disable-error',
    )?.valueBoolean,
    width: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/text-width',
    )?.valuePositiveInt,
    options,
    attachmentText: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/attachment-text',
    )?.valueString,
    format: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/input-format',
    )?.valueString,
    docType: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/document-type',
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
    disableWhen: disableWhen
      ? {
          question: disableWhenQuestion || 'Unknown',
          operator: disableWhenOperator,
          answer: disableWhenAnswer || 'Unknown',
          value: disableWhenValue,
        }
      : undefined,
  };
}
