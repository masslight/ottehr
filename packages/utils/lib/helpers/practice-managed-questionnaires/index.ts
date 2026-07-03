import { Extension, Questionnaire, QuestionnaireItem } from 'fhir/r4b';
import { isEqual } from 'lodash-es';
import { PRACTICE_MANAGED_QUESTIONNAIRE_TAG } from '../../fhir';
import {
  DATA_TYPE_EXTENSION_URL,
  DataTypeSchema,
  INPUT_WIDTH_EXTENSION_URL,
  InputWidthSchema,
  PracticeManagedQuestionnaire,
  PracticeManagedQuestionnaireItem,
  PracticeManagedQuestionnaireItemSchema,
  PracticeManagedQuestionnaireSchema,
} from '../../types';

/**
 * Mainly massages the item property, PracticeManagedQuestionnaireItem has a few fields that are custom / needed only for front end
 * Custom fields are mapped to extensions and _keys are removed
 * Handles managed questionnaire tag (it should exist and only once)
 * @param questionnaire PracticeManagedQuestionnaire
 * @returns Fhir Questionnaire
 */
export const practiceManagedQuestionnaireToFhir = (questionnaire: PracticeManagedQuestionnaire): Questionnaire => {
  const fhirItems = questionnaire.item?.map(PracticeManagedQuestionnaireItemToFhir);

  const questionnaireWithTag = addPracticeManagedQuestionnaireTag(questionnaire);

  return { ...questionnaireWithTag, item: fhirItems };
};

const PracticeManagedQuestionnaireItemToFhir = (item: PracticeManagedQuestionnaireItem): QuestionnaireItem => {
  const managedNestedItems = item.item?.map(PracticeManagedQuestionnaireItemToFhir);

  // Preserve non-Ottehr extensions from imported questionnaires
  const extension: Extension[] =
    item.extension?.filter((ext) => ![DATA_TYPE_EXTENSION_URL, INPUT_WIDTH_EXTENSION_URL].includes(ext.url)) ?? [];

  // convert custom defined managed questionnaire item fields to extensions
  if (item.dataType) {
    extension.push({ url: DATA_TYPE_EXTENSION_URL, valueString: item.dataType });
  }

  if (item.inputWidth) {
    extension.push({ url: INPUT_WIDTH_EXTENSION_URL, valueString: item.inputWidth });
  }

  // the front end reducer automatically assigns text as an empty string to make updates easier
  // this is technically valid for typescript but if you send the object to oystehr for create or update with an empty string it will error
  if (item.text === '') delete item.text;

  const { _key, dataType: _dataType, inputWidth: _inputWidth, ...fhirItem } = item;

  return {
    ...fhirItem,
    item: managedNestedItems,
    ...(extension.length > 0 ? { extension } : { extension: undefined }),
  };
};

const addPracticeManagedQuestionnaireTag = (
  questionnaire: Questionnaire | PracticeManagedQuestionnaire
): Questionnaire => {
  const existingMeta = questionnaire.meta || { tag: [] };
  const existingTags = existingMeta.tag ?? [];

  if (existingTags.some((t) => isEqual(t, PRACTICE_MANAGED_QUESTIONNAIRE_TAG))) {
    return questionnaire;
  }

  questionnaire.meta = {
    tag: [...existingTags, PRACTICE_MANAGED_QUESTIONNAIRE_TAG],
  };

  return questionnaire;
};

/**
 * ensures fields ottehr excepts to be present on Questionnaire are indeed there
 * namely: resourceType, status, name, title, and url
 * also massages the item property, certain extensions are extracted and mapped to custom attributes on the Managed Item Schema
 * adds keys to items to ensure react stability
 * @param questionnaire Fhir Questionnaire
 * @returns PracticeManagedQuestionnaire
 */
export const fhirQuestionnaireToPracticeManaged = (questionnaire: Questionnaire): PracticeManagedQuestionnaire => {
  // add keys to questionnaire item
  const managedItems = questionnaire.item?.map(fhirQuestionnaireItemToManaged);

  const result = PracticeManagedQuestionnaireSchema.safeParse({ ...questionnaire, item: managedItems });
  if (!result.success) {
    throw new Error(`Questionnaire is missing required fields: ${result.error.message}`);
  } else {
    return result.data;
  }
};

export function generatePracticeManagedQuestionnaireItemKey(): string {
  return crypto.randomUUID().slice(0, 8);
}

export const fhirQuestionnaireItemToManaged = (item: QuestionnaireItem): PracticeManagedQuestionnaireItem => {
  const managedNestedItems = item.item?.map(fhirQuestionnaireItemToManaged);

  // check for custom defined managed questionnaire item fields in extension
  let dataType: PracticeManagedQuestionnaireItem['dataType'] | undefined;
  let inputWidth: PracticeManagedQuestionnaireItem['inputWidth'] | undefined;

  const extension: Extension[] = [];

  if (item.extension) {
    item.extension.forEach((ext) => {
      if (ext.url === DATA_TYPE_EXTENSION_URL) {
        const result = DataTypeSchema.safeParse(ext.valueString);
        if (result.success) {
          dataType = result.data;
        }
      } else if (ext.url === INPUT_WIDTH_EXTENSION_URL) {
        const result = InputWidthSchema.safeParse(ext.valueString);
        if (result.success) {
          inputWidth = result.data;
        }
      } else {
        extension.push(ext);
      }
    });
  }

  const itemWithKey = {
    ...item,
    _key: generatePracticeManagedQuestionnaireItemKey(),
    item: managedNestedItems,
    dataType,
    inputWidth,
    ...(extension.length > 0 ? { extension } : { extension: undefined }),
  };

  const result = PracticeManagedQuestionnaireItemSchema.safeParse(itemWithKey);
  if (!result.success) {
    throw new Error(`Questionnaire item is missing required fields: ${result.error.message}`);
  }

  return result.data;
};
