import {
  Extension,
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
} from 'fhir/r4b';
import { cloneDeep, isEqual } from 'lodash-es';
import {
  OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS,
  PRACTICE_MANAGED_QUESTIONNAIRE_TAG,
  QR_DISTRIBUTION_TAG,
} from '../../fhir/constants';
import {
  DataTypeSchema,
  InputWidthSchema,
  PracticeManagedQuestionnaireItemSchema,
  PracticeManagedQuestionnaireSchema,
  PreferredElementSchema,
} from '../../types/data/practice-managed-questionnaires/practice-managed-questionnaire.schema';
import {
  PracticeManagedQuestionnaire,
  PracticeManagedQuestionnaireItem,
  StandaloneFormDTO,
} from '../../types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { mapQuestionnaireAndValueSetsToItemsList } from '../paperwork/paperwork';
import { slugify } from '../slugify';

// Simple item fields that round-trip 1:1 with a valueString Ottehr item extension.
const STRING_ITEM_EXTENSION_FIELDS = [
  { field: 'dataType', url: OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.dataType },
  { field: 'inputWidth', url: OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.inputWidth },
  { field: 'infoText', url: OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.infoText },
  { field: 'secondaryInfoText', url: OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.secondaryInfoText },
  { field: 'preferredElement', url: OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.preferredElement },
  { field: 'attachmentText', url: OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.attachmentText },
] as const satisfies ReadonlyArray<{ field: keyof PracticeManagedQuestionnaireItem; url: string }>;

// `text-min-rows` is the one non-string simple extension (valuePositiveInt).
const MIN_ROWS_EXTENSION_URL = OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.minRows;

// Every extension url the managed<->fhir mapping owns; stripped from preserved raw extensions to avoid duplicates.
const MANAGED_ITEM_EXTENSION_URLS = new Set<string>([
  ...STRING_ITEM_EXTENSION_FIELDS.map((f) => f.url),
  MIN_ROWS_EXTENSION_URL,
]);

export const PRACTICE_MANAGED_QUESTIONNAIRE_BASE_VERSION = '1.0.0';

/**
 * Mainly massages the item property, PracticeManagedQuestionnaireItem has a few fields that are custom / needed only for front end
 * Custom fields are mapped to extensions and _keys are removed
 * Handles managed questionnaire tag (it should exist and only once)
 * @param questionnaire PracticeManagedQuestionnaire
 * @returns Fhir Questionnaire
 */
export const practiceManagedQuestionnaireToFhir = (
  questionnaire: PracticeManagedQuestionnaire,
  preview = false
): Questionnaire => {
  const fhirItems = questionnaire.item
    ?.map((item: PracticeManagedQuestionnaireItem) => PracticeManagedQuestionnaireItemToFhir(item, preview))
    .filter((item): item is QuestionnaireItem => item !== undefined);

  const questionnaireWithTag = addPracticeManagedQuestionnaireTag(questionnaire);

  return { ...questionnaireWithTag, item: fhirItems };
};

const PracticeManagedQuestionnaireItemToFhir = (
  item: PracticeManagedQuestionnaireItem,
  preview: boolean
): QuestionnaireItem | undefined => {
  const managedNestedItems = item.item
    ?.map((nestedItem: PracticeManagedQuestionnaireItem) => PracticeManagedQuestionnaireItemToFhir(nestedItem, preview))
    .filter((nestedItem): nestedItem is QuestionnaireItem => nestedItem !== undefined);

  // Preserve raw (non-managed) extensions from imported / templated questionnaire items
  const extension: Extension[] = item.extension?.filter((ext) => !MANAGED_ITEM_EXTENSION_URLS.has(ext.url)) ?? [];

  // convert custom managed item fields back to their Ottehr extensions
  for (const { field, url } of STRING_ITEM_EXTENSION_FIELDS) {
    const value = item[field];
    if (typeof value === 'string' && value !== '') {
      extension.push({ url, valueString: value });
    }
  }
  if (typeof item.minRows === 'number') {
    extension.push({ url: MIN_ROWS_EXTENSION_URL, valuePositiveInt: item.minRows });
  }

  const fhirItem = omitManagedFields(item, preview);

  if (!fhirItem) {
    return undefined;
  }

  return {
    ...fhirItem,
    item: managedNestedItems,
    ...(extension.length > 0 ? { extension } : { extension: undefined }),
  };
};

const omitManagedFields = (item: PracticeManagedQuestionnaireItem, preview: boolean): QuestionnaireItem | undefined => {
  // the front end reducer automatically assigns text as an empty string to make updates easier
  // this is technically valid for typescript but if you send the object to oystehr for create or update with an empty string it will error
  if (item.text === '') delete item.text;

  if (!preview && item.answerOption) {
    item.answerOption = item.answerOption.filter((option) => Object.values(option).some((value) => value !== ''));

    if (item.answerOption.length === 0) {
      // an item with no valid answer options left is not usable; drop it from its parent's item array
      return undefined;
    }
  }

  const {
    _key,
    dataType: _dataType,
    inputWidth: _inputWidth,
    infoText: _infoText,
    secondaryInfoText: _secondaryInfoText,
    preferredElement: _preferredElement,
    attachmentText: _attachmentText,
    minRows: _minRows,
    ...fhirItem
  } = item;

  return fhirItem;
};

const addPracticeManagedQuestionnaireTag = (
  questionnaire: Questionnaire | PracticeManagedQuestionnaire
): Questionnaire => {
  const existingMeta = questionnaire.meta || { tag: [] };
  const existingTags = existingMeta.tag ?? [];

  // if the tag is already there just return
  if (existingTags.some((t) => isEqual(t, PRACTICE_MANAGED_QUESTIONNAIRE_TAG))) {
    return questionnaire;
  }

  questionnaire.meta = {
    ...existingMeta,
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

  // if no version is given we give it 1
  const version = questionnaire.version ?? PRACTICE_MANAGED_QUESTIONNAIRE_BASE_VERSION;

  // if no title is provided, safeParse will fail so just temp falling back to form
  const slug = slugify(questionnaire.title ?? 'form', { maxLength: 60 });
  // if no url is provided, we will make one
  const url = questionnaire.url ?? makePracticeManagedUrl(slug);

  const result = PracticeManagedQuestionnaireSchema.safeParse({ ...questionnaire, item: managedItems, version, url });
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

  // pull recognized Ottehr item extensions into typed managed fields; keep everything else as raw extensions
  const managedFields: Pick<
    PracticeManagedQuestionnaireItem,
    'dataType' | 'inputWidth' | 'preferredElement' | 'infoText' | 'secondaryInfoText' | 'attachmentText' | 'minRows'
  > = {};
  const extension: Extension[] = [];

  for (const ext of item.extension ?? []) {
    switch (ext.url) {
      case OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.dataType: {
        const result = DataTypeSchema.safeParse(ext.valueString);
        if (result.success) managedFields.dataType = result.data;
        else extension.push(ext);
        break;
      }
      case OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.inputWidth: {
        const result = InputWidthSchema.safeParse(ext.valueString);
        if (result.success) managedFields.inputWidth = result.data;
        else extension.push(ext);
        break;
      }
      case OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.preferredElement: {
        const result = PreferredElementSchema.safeParse(ext.valueString);
        if (result.success) managedFields.preferredElement = result.data;
        else extension.push(ext);
        break;
      }
      case OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.infoText: {
        if (typeof ext.valueString === 'string') managedFields.infoText = ext.valueString;
        else extension.push(ext);
        break;
      }
      case OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.secondaryInfoText: {
        if (typeof ext.valueString === 'string') managedFields.secondaryInfoText = ext.valueString;
        else extension.push(ext);
        break;
      }
      case OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.attachmentText: {
        if (typeof ext.valueString === 'string') managedFields.attachmentText = ext.valueString;
        else extension.push(ext);
        break;
      }
      case OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.minRows: {
        if (typeof ext.valuePositiveInt === 'number') managedFields.minRows = ext.valuePositiveInt;
        else extension.push(ext);
        break;
      }
      default:
        extension.push(ext);
    }
  }

  const itemWithKey = {
    ...item,
    _key: generatePracticeManagedQuestionnaireItemKey(),
    item: managedNestedItems,
    ...managedFields,
    ...(extension.length > 0 ? { extension } : { extension: undefined }),
  };

  const result = PracticeManagedQuestionnaireItemSchema.safeParse(itemWithKey);
  if (!result.success) {
    throw new Error(`Questionnaire item is missing required fields: ${result.error.message}`);
  }

  return result.data;
};

export function isPracticeManagedQ(q: Questionnaire | undefined): boolean {
  if (!q) return false;

  const { system, code } = PRACTICE_MANAGED_QUESTIONNAIRE_TAG;
  return Boolean(q.meta?.tag?.some((t) => t.code === code && t.system === system));
}

export function qrSentManually(qr: QuestionnaireResponse | undefined): boolean {
  if (!qr) return false;

  const { system, code } = QR_DISTRIBUTION_TAG;
  return Boolean(qr.meta?.tag?.some((t) => t.code === code && t.system === system));
}

export const formatQuestionnaireItemValueToString = (item: QuestionnaireResponseItem | undefined): string => {
  if (!item) return '';

  const a = item.answer?.[0];
  if (!a) return '';
  if (a.valueCoding?.display) return a.valueCoding.display;
  if (a.valueString !== undefined) return a.valueString;
  if (a.valueBoolean !== undefined) return a.valueBoolean ? 'Positive' : 'Negative';
  if (a.valueInteger !== undefined) return String(a.valueInteger);
  if (a.valueDecimal !== undefined) return String(a.valueDecimal);
  if (a.valueDate) return a.valueDate;
  if (a.valueDateTime) return a.valueDateTime;
  return '';
};

export const makePracticeManagedUrl = (slug: string): string => {
  return `https://ottehr.com/FHIR/Questionnaire/${slug}`;
};

export const makeStandaloneFormDTO = (
  questionnaire: Questionnaire,
  questionnaireResponse: QuestionnaireResponse
): StandaloneFormDTO => {
  const questionnaireTitle = questionnaire.title ?? 'A form';
  const questionnaireId = questionnaire.id ?? '';
  const itemsCopy = questionnaire.item ? cloneDeep(questionnaire.item) : [];
  const allItems = mapQuestionnaireAndValueSetsToItemsList(itemsCopy ?? [], []);

  return {
    allItems,
    questionnaireResponse,
    questionnaireTitle,
    questionnaireId,
  };
};
