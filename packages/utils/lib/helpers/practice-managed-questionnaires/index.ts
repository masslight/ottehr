import { FormFieldTrigger } from 'config-types';
import {
  Extension,
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireItemEnableWhen,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
} from 'fhir/r4b';
import { cloneDeep, isEqual } from 'lodash-es';
import {
  createDisabledDisplayExtension,
  createEnableWhen,
  createFillFromWhenDisabledExtension,
  createFilterWhenExtension,
  createRequireWhenExtension,
  createTextWhenExtension,
} from '../../config-helpers/shared-questionnaire';
import {
  OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS,
  PRACTICE_MANAGED_QUESTIONNAIRE_TAG,
  QR_DISTRIBUTION_TAG,
} from '../../fhir/constants';
import {
  DataTypeSchema,
  DisabledDisplaySchema,
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
import { mapQuestionnaireAndValueSetsToItemsList, structureExtension } from '../paperwork/paperwork';
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

// Conditional-behavior extension roots compiled from the typed `triggers` / `dynamicPopulation` /
// `disabledDisplay` / `hideControlLabel` fields on emit and rehydrated into them on parse. Unlike the simple
// string fields (handled item-by-item in the parse switch, which preserves unrecognized values as raw
// extensions), these are always owned by the mapping, so on parse they are dropped wholesale from the
// leftover raw extensions.
const CONDITIONAL_ITEM_EXTENSION_URLS = new Set<string>([
  OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.requireWhen.extension,
  OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.filterWhen.extension,
  OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.textWhen.extension,
  OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.disabledDisplay,
  OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.autofillFromWhenDisabled,
  OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.hideControlLabel,
]);

// Every extension url the managed<->fhir mapping owns; on emit these are stripped from preserved raw
// extensions before the compiled ones are re-added, to avoid duplicates.
const MANAGED_ITEM_EXTENSION_URLS = new Set<string>([
  ...STRING_ITEM_EXTENSION_FIELDS.map((f) => f.url),
  MIN_ROWS_EXTENSION_URL,
  ...CONDITIONAL_ITEM_EXTENSION_URLS,
]);

// Map a parsed *-when condition (answerString | answerBoolean | answerInteger | answerDate) onto the FormFieldTrigger
// answer shape (exactly one of answerBoolean | answerString | answerDateTime, per FormFieldTriggerSchema).
const conditionAnswerToTriggerAnswer = (cond: {
  answerString?: string;
  answerBoolean?: boolean;
  answerInteger?: string | number;
  answerDate?: string;
}): Pick<FormFieldTrigger, 'answerBoolean' | 'answerString' | 'answerDateTime'> => {
  if (cond.answerBoolean !== undefined) return { answerBoolean: cond.answerBoolean };
  if (cond.answerString !== undefined) return { answerString: cond.answerString };
  if (cond.answerDate !== undefined) return { answerDateTime: cond.answerDate };
  if (cond.answerInteger !== undefined) return { answerString: String(cond.answerInteger) };
  // `exists` conditions with no explicit answer default to answerBoolean so exactly one answer is always present
  return { answerBoolean: true };
};

// Map a native FHIR enableWhen answer onto the FormFieldTrigger answer shape.
const enableWhenAnswerToTriggerAnswer = (
  ew: QuestionnaireItemEnableWhen
): Pick<FormFieldTrigger, 'answerBoolean' | 'answerString' | 'answerDateTime'> => {
  if (ew.answerBoolean !== undefined) return { answerBoolean: ew.answerBoolean };
  if (ew.answerString !== undefined) return { answerString: ew.answerString };
  if (ew.answerDateTime !== undefined) return { answerDateTime: ew.answerDateTime };
  if (ew.answerDate !== undefined) return { answerDateTime: ew.answerDate };
  if (ew.answerInteger !== undefined) return { answerString: String(ew.answerInteger) };
  if (ew.answerDecimal !== undefined) return { answerString: String(ew.answerDecimal) };
  if (ew.answerCoding?.code !== undefined) return { answerString: ew.answerCoding.code };
  return { answerBoolean: true };
};

// Compile the typed conditional-behavior fields (triggers / dynamicPopulation / disabledDisplay / hideControlLabel)
// into the native FHIR enableWhen(+enableBehavior) plus the Ottehr *-when / disabled-display / fill-from-when-disabled /
// hide-control-label extensions. Mirrors convertFormFieldToQuestionnaireItem in config-helpers/shared-questionnaire.ts.
const compileConditionalFields = (
  item: PracticeManagedQuestionnaireItem
): {
  enableWhen?: QuestionnaireItemEnableWhen[];
  enableBehavior?: QuestionnaireItem['enableBehavior'];
  extensions: Extension[];
} => {
  const extensions: Extension[] = [];
  const triggers = item.triggers ?? [];

  const enableTriggers = triggers.filter((t) => t.effect.includes('enable'));
  const enableWhen = enableTriggers.length > 0 ? enableTriggers.flatMap((t) => createEnableWhen(t)!) : undefined;
  // enableBehavior is only meaningful when more than one enableWhen condition is present
  const enableBehavior = enableWhen && enableWhen.length > 1 ? item.enableBehavior ?? 'all' : undefined;

  for (const t of triggers.filter((t) => t.effect.includes('require'))) {
    extensions.push(createRequireWhenExtension(t));
  }
  for (const t of triggers.filter((t) => t.effect.includes('filter'))) {
    extensions.push(createFilterWhenExtension(t));
  }
  for (const t of triggers.filter((t) => t.effect.includes('sub-text'))) {
    extensions.push(createTextWhenExtension(t));
  }

  if (item.disabledDisplay) {
    extensions.push(createDisabledDisplayExtension(item.disabledDisplay));
  }
  if (item.dynamicPopulation) {
    extensions.push(createFillFromWhenDisabledExtension(item.dynamicPopulation.sourceLinkId));
    // the autofill runtime only copies while the field is hidden/protected, so force protected when unset
    if (!item.disabledDisplay) {
      extensions.push(createDisabledDisplayExtension('protected'));
    }
  }
  if (item.hideControlLabel === true) {
    extensions.push({ url: OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.hideControlLabel, valueBoolean: true });
  }

  return { enableWhen, enableBehavior, extensions };
};

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

  // compile triggers / dynamicPopulation / disabledDisplay / hideControlLabel into enableWhen + Ottehr extensions
  const { enableWhen, enableBehavior, extensions: conditionalExtensions } = compileConditionalFields(item);
  extension.push(...conditionalExtensions);

  const fhirItem = omitManagedFields(item, preview);

  if (!fhirItem) {
    return undefined;
  }

  return {
    ...fhirItem,
    item: managedNestedItems,
    ...(enableWhen && enableWhen.length > 0 ? { enableWhen } : {}),
    ...(enableBehavior ? { enableBehavior } : {}),
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
    // conditional-behavior fields are re-emitted by compileConditionalFields; strip them (and the native
    // enableWhen/enableBehavior they own) so they are not duplicated or passed through stale
    triggers: _triggers,
    dynamicPopulation: _dynamicPopulation,
    disabledDisplay: _disabledDisplay,
    hideControlLabel: _hideControlLabel,
    enableWhen: _enableWhen,
    enableBehavior: _enableBehavior,
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

  // rehydrate conditional-behavior fields from native enableWhen + the Ottehr *-when / disabled-display /
  // fill-from-when-disabled / hide-control-label extensions into the typed triggers / dynamicPopulation /
  // disabledDisplay / hideControlLabel fields (inverse of compileConditionalFields)
  const {
    enableWhen: nativeEnableWhen,
    enableBehavior: nativeEnableBehavior,
    extension: _rawExtension,
    ...restItem
  } = item;
  const structured = structureExtension(item);

  const triggers: FormFieldTrigger[] = [];
  for (const ew of nativeEnableWhen ?? []) {
    triggers.push({
      targetQuestionLinkId: ew.question,
      effect: ['enable'],
      operator: ew.operator,
      ...enableWhenAnswerToTriggerAnswer(ew),
    });
  }
  // only the first require-when is honored at runtime, and structureExtension already returns just that one
  if (structured.requireWhen) {
    triggers.push({
      targetQuestionLinkId: structured.requireWhen.question,
      effect: ['require'],
      operator: structured.requireWhen.operator,
      ...conditionAnswerToTriggerAnswer(structured.requireWhen),
    });
  }
  for (const fw of structured.filterWhen ?? []) {
    triggers.push({
      targetQuestionLinkId: fw.question,
      effect: ['filter'],
      operator: fw.operator,
      ...conditionAnswerToTriggerAnswer(fw),
    });
  }
  for (const tw of structured.textWhen ?? []) {
    triggers.push({
      targetQuestionLinkId: tw.question,
      effect: ['sub-text'],
      operator: tw.operator,
      substituteText: tw.substituteText,
      ...conditionAnswerToTriggerAnswer(tw),
    });
  }

  const conditionalFields: Pick<
    PracticeManagedQuestionnaireItem,
    'triggers' | 'enableBehavior' | 'dynamicPopulation' | 'disabledDisplay' | 'hideControlLabel'
  > = {};
  if (triggers.length > 0) {
    conditionalFields.triggers = triggers;
  }
  if (nativeEnableBehavior && (nativeEnableWhen?.length ?? 0) > 1) {
    conditionalFields.enableBehavior = nativeEnableBehavior;
  }
  if (structured.autofillFromWhenDisabled) {
    conditionalFields.dynamicPopulation = { sourceLinkId: structured.autofillFromWhenDisabled };
  }
  const disabledDisplayResult = DisabledDisplaySchema.safeParse(structured.disabledDisplay);
  if (disabledDisplayResult.success) {
    conditionalFields.disabledDisplay = disabledDisplayResult.data;
  }
  if (structured.hideControlLabel === true) {
    conditionalFields.hideControlLabel = true;
  }

  // drop the conditional-behavior extensions (now represented as typed triggers / dynamicPopulation /
  // disabledDisplay / hideControlLabel); the simple-field switch above already consumed or preserved the rest
  const rawExtension = extension.filter((ext) => !CONDITIONAL_ITEM_EXTENSION_URLS.has(ext.url));

  const itemWithKey = {
    ...restItem,
    _key: generatePracticeManagedQuestionnaireItemKey(),
    item: managedNestedItems,
    ...managedFields,
    ...conditionalFields,
    ...(rawExtension.length > 0 ? { extension: rawExtension } : { extension: undefined }),
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
