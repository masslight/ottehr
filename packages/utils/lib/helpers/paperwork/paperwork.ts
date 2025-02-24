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
  IntakeQuestionnaireItem,
  Question,
  QuestionnaireItemExtension,
  QuestionnaireItemTextWhen,
  validateQuestionnaireDataType,
  FormDisplayElementList,
  FormSelectionElementList,
  FormElement,
  QuestionnaireItemGroupType,
  AnswerLoadingOptions,
  InputWidthOption,
  QuestionnaireItemConditionDefinition,
  ConditionKeyObject,
} from '../../types';
import Oystehr from '@oystehr/sdk';
import { getCanonicalQuestionnaire, OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS } from '../../fhir';

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
    return ext.url === OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.preferredElement;
  })?.valueString as FormElement | undefined;
  if (preferredElementExt && [...FormSelectionElementList, ...FormDisplayElementList].includes(preferredElementExt)) {
    return preferredElementExt;
  }
  return undefined;
};

const getConditionalExtension = (
  extension: Extension[],
  keys: ConditionKeyObject
): { extension: Extension[]; baseConditionDef: QuestionnaireItemConditionDefinition | undefined } => {
  const baseExtension = extension.find((ext) => {
    return ext.url === keys.extension;
  })?.extension;

  if (baseExtension) {
    const question = baseExtension.find((ext) => {
      return ext.url === keys.question;
    })?.valueString;
    const operator = baseExtension.find((ext) => {
      return ext.url === keys.operator;
    })?.valueString;
    const answerObj = baseExtension.find((ext) => {
      return ext.url === keys.answer;
    });
    const answerString = answerObj?.valueString;
    const answerBoolean = answerObj?.valueBoolean;
    const answerInteger = answerObj?.valueInteger;
    const answerDate = answerObj?.valueDate;
    if (
      operator !== undefined &&
      ['=', '!=', '>', '<', '>=', '<='].includes(operator) &&
      question !== undefined &&
      (answerString !== undefined ||
        answerBoolean !== undefined ||
        answerInteger !== undefined ||
        answerDate !== undefined)
    ) {
      return {
        extension: baseExtension,
        baseConditionDef: {
          question,
          operator: operator as QuestionnaireItemConditionDefinition['operator'],
          answerString,
          answerBoolean,
          answerInteger,
          answerDate,
        },
      };
    }
  }
  return { extension: [], baseConditionDef: undefined };
};

const structureExtension = (item: QuestionnaireItem): QuestionnaireItemExtension => {
  const extension = item.extension ?? [];
  let disabledDisplay = extension.find((ext) => {
    return ext.url === OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.disabledDisplay;
  })?.valueString;
  if (disabledDisplay !== 'hidden' && disabledDisplay !== 'protected') {
    disabledDisplay = undefined;
  }

  const { baseConditionDef: requireWhen } = getConditionalExtension(
    extension,
    OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.requireWhen
  );

  const { extension: textWhenExt, baseConditionDef: textWhenPartial } = getConditionalExtension(
    extension,
    OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.textWhen
  );
  let textWhen: QuestionnaireItemTextWhen | undefined;
  if (textWhenPartial) {
    const substituteText = textWhenExt.find((ext) => {
      return ext.url === OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.textWhen.substituteText;
    })?.valueString;

    if (substituteText) {
      textWhen = {
        ...textWhenPartial,
        substituteText,
      };
    }
  }

  const { baseConditionDef: filterWhen } = getConditionalExtension(
    extension,
    OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.filterWhen
  );

  const attachmentText = extension.find((ext) => {
    return ext.url === OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.attachmentText;
  })?.valueString;

  const autofillFromWhenDisabled = extension.find((ext) => {
    return ext.url === OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.autofillFromWhenDisabled;
  })?.valueString;

  const infoText = extension.find((ext) => {
    return ext.url === OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.infoText;
  })?.valueString;

  const secondaryInfoText = extension.find((ext) => {
    return ext.url === OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.secondaryInfoText;
  })?.valueString;

  const dataType = validateQuestionnaireDataType(
    extension.find((ext) => {
      return ext.url === OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.dataType;
    })?.valueString
  );

  const validateAgeOver = extension.find((ext) => {
    return ext.url === OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.validateAgeOver;
  })?.valueInteger;

  const preferredElement = getPreferredElement(extension);

  const acceptsMultipleAnswers =
    extension.find((ext) => {
      return ext.url === OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.acceptsMultipleAnswers;
    })?.valueBoolean ?? false;

  let groupType = extension.find((ext) => {
    return ext.url === OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.groupType;
  })?.valueString as QuestionnaireItemGroupType | undefined;

  const validGroupTypes = Object.values(QuestionnaireItemGroupType) as string[];
  if (!validGroupTypes.includes(groupType ?? '')) {
    groupType = undefined;
  }

  const alwaysFilter =
    extension.find((ext) => {
      return ext.url === OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.alwaysFilter;
    })?.valueBoolean ?? false;

  const categoryTag = extension.find((ext) => {
    return ext.url === OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.categoryTag;
  })?.valueString;

  const answerLoadingExtensionRoot = extension.find((ext) => {
    return ext.url === OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.answerLoadingOptions.extension;
  })?.extension;

  const answerLoadingStrategy = answerLoadingExtensionRoot?.find((ext) => {
    return ext.url === OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.answerLoadingOptions.strategy;
  })?.valueString;

  const source = answerLoadingExtensionRoot?.find((ext) => {
    return ext.url === OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.answerLoadingOptions.source;
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
  let inputWidth = extension.find((ext) => {
    return ext.url === OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.inputWidth;
  })?.valueString;
  if (!['s', 'm', 'l', 'max'].includes(inputWidth ?? '')) {
    inputWidth = undefined;
  }

  const minRows = extension.find((ext) => {
    return ext.url === OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.minRows;
  })?.valuePositiveInt;

  let complexValidation: QuestionnaireItemExtension['complexValidation'] | undefined;
  const complexValidationExtension = extension?.find((ext) => {
    return ext.url === OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.complexValidation.extension;
  })?.extension;
  if (complexValidationExtension) {
    const { baseConditionDef: complexValidationTriggerWhen } = getConditionalExtension(
      complexValidationExtension,
      OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.complexValidation.triggerWhen
    );
    const complexValidationType = complexValidationExtension.find((ext) => {
      return ext.url === OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.complexValidation.type;
    })?.valueString;

    if (complexValidationType && complexValidationTriggerWhen) {
      complexValidation = {
        type: complexValidationType,
        triggerWhen: complexValidationTriggerWhen,
      };
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
    dataType,
    filterWhen,
    validateAgeOver,
    preferredElement,
    groupType,
    categoryTag,
    answerLoadingOptions,
    inputWidth: inputWidth as InputWidthOption | undefined,
    minRows,
    complexValidation,
  };
};

export const mapQuestionnaireAndValueSetsToItemsList = (
  questionnaireItems: QuestionnaireItem[],
  valueSets: ValueSet[]
): IntakeQuestionnaireItem[] => {
  return questionnaireItems.map((startingItem) => {
    let item = startingItem;
    if (item.item !== undefined) {
      item.item = mapQuestionnaireAndValueSetsToItemsList(item.item, valueSets);
      item = { ...item, ...structureExtension(item) };
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

/*
  This is used to convert a QuestionnaireResponse.item from an array of objects to a map where each key is the linkId
  of each object in the array and the value is just the value of that object. It is convenient to make make this conversion
  to make the form values easier to manipulate, though it does add some complexity in introdudcing some stuctural variance
  in the validation schema, which must account both for the map-type object as well as the array, depending on where it is
  being applied.
*/

export const convertQRItemToLinkIdMap = (
  items: QuestionnaireResponseItem[] | undefined
): { [key: string]: QuestionnaireResponseItem } => {
  return (items ?? []).reduce(
    (accum, entry) => {
      accum[entry.linkId] = { ...entry };
      return accum;
    },
    {} as { [key: string]: QuestionnaireResponseItem }
  );
};
export const convertQuesitonnaireItemToQRLinkIdMap = (
  items: QuestionnaireItem[] | undefined
): { [key: string]: QuestionnaireResponseItem } => {
  return (items ?? []).reduce(
    (accum, item) => {
      if ((item as any).type !== 'display') {
        accum[item.linkId] = { linkId: item.linkId };
      }
      return accum;
    },
    {} as { [key: string]: QuestionnaireResponseItem }
  );
};
