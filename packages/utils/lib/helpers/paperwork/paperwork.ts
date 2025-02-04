import {
  FhirResource,
  Extension,
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireItemAnswerOption,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  QuestionnaireResponseItemAnswer,
  ValueSet,
} from 'fhir/r4b';
import {
  FormItemType,
  IntakeQuestionnaireItem,
  Question,
  QuestionOperator,
  QuestionnaireItemExtension,
  QuestionnaireItemRequireWhen,
  QuestionnaireItemTextWhen,
  validateQuestionnaireDataType,
  QuestionnaireItemFilterWhen,
  FormDisplayElementList,
  FormSelectionElementList,
  FormElement,
  QuestionnaireItemGroupType,
  AnswerLoadingOptions,
} from '../../types';
import Oystehr from '@oystehr/sdk';
import { getCanonicalQuestionnaire, PRIVATE_EXTENSION_BASE_URL } from '../../fhir';

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
  questionnaireUrl: string,
  questionnaireVersion: string,
  valueSetRef: string,
  oystehr: Oystehr
): Promise<{ questionnaire: Questionnaire; valueSets: ValueSet[] }> {
  console.log(`searching for a questionnaire with canonical ${questionnaireUrl}`);
  const questionnaire = await getCanonicalQuestionnaire(
    { version: questionnaireVersion, url: questionnaireUrl },
    oystehr
  );

  console.log(`searching for value sets with reference ${valueSetRef}`);
  const valueSets = (
    await oystehr.fhir.search<ValueSet>({
      resourceType: 'ValueSet',
      params: [
        {
          name: 'reference',
          value: valueSetRef,
        },
      ],
    })
  ).unbundle();
  console.log(`${valueSets.length} value sets found`);
  return { questionnaire, valueSets };
}

const getPreferredElement = (extension: Extension[]): FormElement | undefined => {
  const preferredElementExt = extension?.find((ext) => {
    return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/preferred-element`;
  })?.valueString as FormElement | undefined;
  if (preferredElementExt && [...FormSelectionElementList, ...FormDisplayElementList].includes(preferredElementExt)) {
    return preferredElementExt;
  }
  return undefined;
};

const structureExtension = (item: QuestionnaireItem): QuestionnaireItemExtension => {
  const extension = item.extension ?? [];
  let disabledDisplay = extension.find((ext) => {
    return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/disabled-display`;
  })?.valueString;
  if (disabledDisplay !== 'hidden' && disabledDisplay !== 'protected') {
    disabledDisplay = undefined;
  }
  const requiredWhenExt = extension.find((ext) => {
    return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/require-when`;
  })?.extension;
  let requireWhen: QuestionnaireItemRequireWhen | undefined;
  if (requiredWhenExt) {
    const question = requiredWhenExt.find((ext) => {
      return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/require-when-question`;
    })?.valueString;
    const operator = requiredWhenExt.find((ext) => {
      return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/require-when-operator`;
    })?.valueString;
    const answerString = requiredWhenExt.find((ext) => {
      return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/require-when-answer`;
    })?.valueString;
    const answerBoolean = requiredWhenExt.find((ext) => {
      return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/require-when-answer`;
    })?.valueBoolean;
    if (
      operator !== undefined &&
      ['=', '!='].includes(operator) &&
      question !== undefined &&
      (answerString !== undefined || answerBoolean !== undefined)
    ) {
      requireWhen = {
        question,
        operator: operator as '=' | '!=',
        answerString,
        answerBoolean,
      };
    }
  }

  const textWhenExt = extension.find((ext) => {
    return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/text-when`;
  })?.extension;
  let textWhen: QuestionnaireItemTextWhen | undefined;
  if (textWhenExt) {
    const question = textWhenExt.find((ext) => {
      return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/text-when-question`;
    })?.valueString;
    const operator = textWhenExt.find((ext) => {
      return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/text-when-operator`;
    })?.valueString;
    const answerString = textWhenExt.find((ext) => {
      return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/text-when-answer`;
    })?.valueString;
    const answerBoolean = textWhenExt.find((ext) => {
      return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/text-when-answer`;
    })?.valueBoolean;
    const substituteText = textWhenExt.find((ext) => {
      return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/text-when-substitute-text`;
    })?.valueString;

    if (
      operator !== undefined &&
      ['=', '!='].includes(operator) &&
      question !== undefined &&
      substituteText !== undefined &&
      (answerString !== undefined || answerBoolean !== undefined)
    ) {
      textWhen = {
        question,
        operator: operator as '=' | '!=',
        answerString,
        answerBoolean,
        substituteText,
      };
    }
  }

  const filterWhenExt = extension.find((ext) => {
    return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/filter-when`;
  })?.extension;
  let filterWhen: QuestionnaireItemFilterWhen | undefined;
  if (filterWhenExt) {
    const question = filterWhenExt.find((ext) => {
      return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/filter-when-question`;
    })?.valueString;
    const operator = filterWhenExt.find((ext) => {
      return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/filter-when-operator`;
    })?.valueString;
    const answerString = filterWhenExt.find((ext) => {
      return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/filter-when-answer`;
    })?.valueString;
    const answerBoolean = filterWhenExt.find((ext) => {
      return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/filter-when-answer`;
    })?.valueBoolean;
    if (
      operator !== undefined &&
      ['=', '!='].includes(operator) &&
      question !== undefined &&
      (answerString !== undefined || answerBoolean !== undefined)
    ) {
      filterWhen = {
        question,
        operator: operator as '=' | '!=',
        answerString,
        answerBoolean,
      };
    }
  }

  const attachmentText = extension.find((ext) => {
    return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/attachment-text`;
  })?.valueString;

  const autofillFromWhenDisabled = extension.find((ext) => {
    return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/fill-from-when-disabled`;
  })?.valueString;

  const infoText = extension.find((ext) => {
    return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/information-text`;
  })?.valueString;

  const secondaryInfoText = extension.find((ext) => {
    return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/information-text-secondary`;
  })?.valueString;

  const randomize = extension.find((ext) => {
    return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/randomize`;
  })?.valueBoolean;

  const dataType = validateQuestionnaireDataType(
    extension.find((ext) => {
      return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/data-type`;
    })?.valueString
  );

  const validateAgeOver = extension.find((ext) => {
    return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/validate-age-over`;
  })?.valueInteger;

  const preferredElement = getPreferredElement(extension);

  const acceptsMultipleAnswers =
    extension.find((ext) => {
      return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/accepts-multiple-answers`;
    })?.valueBoolean ?? false;

  let groupType = extension.find((ext) => {
    return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/group-type`;
  })?.valueString as QuestionnaireItemGroupType | undefined;

  const validGroupTypes = Object.values(QuestionnaireItemGroupType) as string[];
  if (!validGroupTypes.includes(groupType ?? '')) {
    groupType = undefined;
  }

  const alwaysFilter =
    extension.find((ext) => {
      return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/always-filter`;
    })?.valueBoolean ?? false;

  const categoryTag = extension.find((ext) => {
    return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/category-tag`;
  })?.valueString;

  const answerLoadingExtensionRoot = extension.find((ext) => {
    return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/answer-loading-options`;
  })?.extension;

  const answerLoadingStrategy = answerLoadingExtensionRoot?.find((ext) => {
    return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/strategy`;
  })?.valueString;

  const source = answerLoadingExtensionRoot?.find((ext) => {
    return ext.url === `${PRIVATE_EXTENSION_BASE_URL}/source`;
  })?.valueExpression;

  let answerLoadingOptions: AnswerLoadingOptions | undefined;

  if (answerLoadingStrategy && (answerLoadingStrategy === 'prefetch' || answerLoadingStrategy === 'dynamic')) {
    const option: AnswerLoadingOptions = {
      strategy: answerLoadingStrategy,
    };
    if (source) {
      const { expression, language } = source;
      if (language === 'application/x-fhir-query' && expression) {
        const [resourceType, query] = expression.split('?');
        if (resourceType && query) {
          option.answerSource = {
            resourceType: resourceType as FhirResource['resourceType'],
            query,
          };
        }
      }
    }
    if (option.answerSource || item.answerValueSet) {
      answerLoadingOptions = option;
    }
  }

  return {
    acceptsMultipleAnswers,
    alwaysFilter,
    disabledDisplay,
    requireWhen,
    textWhen,
    attachmentText,
    autofillFromWhenDisabled,
    infoText,
    secondaryInfoText,
    randomize,
    dataType,
    filterWhen,
    validateAgeOver,
    preferredElement,
    groupType,
    categoryTag,
    answerLoadingOptions,
  };
};

export const mapQuestionnaireAndValueSetsToItemsList = (
  questionnaireItems: QuestionnaireItem[],
  valueSets: ValueSet[]
): IntakeQuestionnaireItem[] => {
  return questionnaireItems.map((item) => {
    if (item.item !== undefined) {
      item.item = mapQuestionnaireAndValueSetsToItemsList(item.item, valueSets);
    }
    const additionalProps = structureExtension(item);
    const enhancedItem = {
      ...item,
      ...additionalProps,
    } as IntakeQuestionnaireItem; // todo: this is cheating
    const answerOption = getItemOptionsArray(enhancedItem, valueSets);
    const mapped = { ...enhancedItem, answerOption };
    // we've mapped the extension to our more conveniently structured additionalProps
    // so we remove the extension field to unclutter the questionnaire items
    (mapped as any).extension = undefined;
    return mapped;
  });
};

interface QuestionnaireProgressData {
  items: IntakeQuestionnaireItem[];
  fullQRResource: QuestionnaireResponse;
}

export const getQuestionnaireItemsAndProgress = async (
  questionnaireResponseId: string,
  oystehr: Oystehr
): Promise<QuestionnaireProgressData | undefined> => {
  const results = (
    await oystehr.fhir.search<QuestionnaireResponse | Questionnaire>({
      resourceType: 'QuestionnaireResponse',
      params: [
        {
          name: '_id',
          value: questionnaireResponseId,
        },
        {
          name: '_include',
          value: 'QuestionnaireResponse:questionnaire',
        },
      ],
    })
  ).unbundle();

  console.log('qrs', JSON.stringify(results));
  const qr: QuestionnaireResponse | undefined = results.find((res) => {
    return res.resourceType === 'QuestionnaireResponse';
  }) as QuestionnaireResponse | undefined;
  const questionnaire: Questionnaire | undefined = results.find((res) => {
    if (res.resourceType === 'Questionnaire') {
      // this in-memory filtering is a workaround for an Oystehr search bug: https://github.com/masslight/zapehr/issues/6051
      const q = res as Questionnaire;
      return `${q.url}|${q.version}` === qr?.questionnaire;
    }
    return false;
  }) as Questionnaire | undefined;

  if (!questionnaire || !qr) {
    return undefined;
  }

  const [sourceQuestionaireUrl, sourceQuestionnaireVersion] = qr?.questionnaire?.split('|') ?? [null, null];

  console.log('source questionnaire url', sourceQuestionaireUrl, sourceQuestionnaireVersion);
  console.log('questionnaire id, canonical', questionnaire.id, `${questionnaire.url}|${questionnaire.version}`);

  return {
    // todo: support fetching up value sets. we currently don't use any, so just pass an empty list here.
    items: mapQuestionnaireAndValueSetsToItemsList(questionnaire.item ?? [], []),
    fullQRResource: qr,
  };
};

export function getOptionsArray(item: QuestionnaireItem, valueSets?: ValueSet[]): OptionConfig[] | undefined {
  let options;
  if (item.answerValueSet && valueSets) {
    const valueSetId = item.answerValueSet.replace('ValueSet/', '');
    const valueSetFound = valueSets.find((valueSet) => valueSet.id === valueSetId);
    options = valueSetFound?.compose?.include
      .find((included) => included.system === 'ip-questionnaire-item-value-set') // make this a const somewhere
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

export function getItemOptionsArray(
  item: QuestionnaireItem,
  valueSets?: ValueSet[]
): QuestionnaireItemAnswerOption[] | undefined {
  let options;
  if (item.answerValueSet && valueSets) {
    const valueSetId = item.answerValueSet.replace('ValueSet/', '');
    const valueSetFound = valueSets.find((valueSet) => valueSet.id === valueSetId);
    options = valueSetFound?.compose?.include
      .find((included) => included.system === 'ip-questionnaire-item-value-set') // make this a const somewhere
      ?.concept?.reduce((acc: QuestionnaireItemAnswerOption[], val) => {
        acc.push({
          id: val.code ?? val.display ?? val.id ?? `${Math.round(Math.random() * 1000)}`,
          valueString: val.display ?? val.code ?? 'Unknown',
        });
        return acc;
      }, []);
    // console.log('THE options', JSON.stringify(options), valueSets, item.answerValueSet);
  } else {
    options = item.answerOption;
  }
  // console.log('THE options', JSON.stringify(options), valueSets, JSON.stringify(item));
  return options;
}

export function checkEnable(item: Pick<Question, 'enableWhen' | 'hidden'>, values: Record<string, any>): boolean {
  if (item.hidden && !item.enableWhen) {
    return false;
  }

  if (item.enableWhen) {
    const value = values[item.enableWhen.question];
    if (item.enableWhen.operator === '=') {
      let test = value === item.enableWhen.answer;

      if (item.enableWhen.answer.includes('|')) {
        const answerArray = item.enableWhen.answer.split('|');
        test = answerArray.includes(value);
      }

      item.hidden = !test;
      return test;
    }
  }

  return true;
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
        (attributeTemp) => attributeTemp.name === 'group-type' && attributeTemp.value === 'list-with-form'
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

  const disableWhen = item.extension?.find(
    (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/disable-when'
  )?.extension;
  const disableWhenQuestion = disableWhen?.find(
    (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/disable-when-question'
  )?.valueString;
  const disableWhenOperator: QuestionOperator = disableWhen?.find(
    (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/disable-when-operator'
  )?.valueString as QuestionOperator;
  const disableWhenAnswer = disableWhen?.find(
    (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/disable-when-answer'
  )?.valueString;
  const disableWhenValue = disableWhen?.find(
    (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/disable-when-value'
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
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/placeholder'
    )?.valueString,
    helperText: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/helper-text'
    )?.valueString,
    showHelperTextIcon: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/show-helper-text-icon'
    )?.valueBoolean,
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
    options,
    attachmentText: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/attachment-text'
    )?.valueString,
    format: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/input-format'
    )?.valueString,
    docType: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/document-type'
    )?.valueString,
    autoComplete: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/autocomplete'
    )?.valueString,
    freeSelectMultiple: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/free-select-multiple'
    )?.valueBoolean,
    submitOnChange: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/submit-on-change'
    )?.valueBoolean,
    disableError: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/disable-error'
    )?.valueBoolean,
    freeSelectFreeSolo: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/free-select-free-solo'
    )?.valueBoolean,
    virtualization: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/virtualization'
    )?.valueBoolean,
    fileUploadType: item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/file-upload-type'
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

export const unflattenAnswers = (
  items: QuestionnaireItem[],
  responses: QuestionnaireResponseItem[]
): QuestionnaireResponseItem[] => {
  const allPages: QuestionnaireResponseItem[] = items.map((itemTemp) => ({ linkId: itemTemp.linkId, item: [] }));
  responses.forEach((resp) => {
    items.forEach((item) => {
      if (checkItemIncludesItemWithLinkId(item, resp.linkId)) {
        const pageFound = allPages.find((page) => page.linkId === item.linkId);
        pageFound?.item?.push(resp);
      }
    });
  });
  console.log('allPages', JSON.stringify(allPages));
  return allPages;
};

const checkItemIncludesItemWithLinkId = (item: QuestionnaireItem, linkId: string): boolean => {
  if (item.item === undefined) {
    return false;
  }
  return item.item.some((it) => it.linkId === linkId);
};

type DateKeys = { dayKey: string | undefined; monthKey: string | undefined; yearKey: string | undefined };
export const getComponentKeysFromDateGroup = (item: QuestionnaireItem): DateKeys => {
  const keys: DateKeys = { dayKey: undefined, monthKey: undefined, yearKey: undefined };

  const items = item.item;
  if (items && items.length === 3) {
    keys.dayKey = items[0]?.linkId;
    keys.monthKey = items[1]?.linkId;
    keys.yearKey = items[2]?.linkId;
  }
  return keys;
};

export const pickFirstValueFromAnswerItem = (
  item: QuestionnaireResponseItem | undefined,
  type: 'string' | 'boolean' | 'attachment' | 'reference' = 'string'
): any => {
  const valString = `value${capitalizeFirstLetter(type)}` as keyof QuestionnaireResponseItemAnswer;
  return item?.answer?.[0]?.[valString];
};
export const pickValueAsStringListFromAnswerItem = (
  item: QuestionnaireResponseItem | undefined,
  type: 'string' | 'boolean' | 'attachment' | 'reference' = 'string'
): any => {
  const valString = `value${capitalizeFirstLetter(type)}` as keyof QuestionnaireResponseItemAnswer;
  return (item?.answer ?? []).map((ent) => {
    return ent[valString];
  });
};
function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
