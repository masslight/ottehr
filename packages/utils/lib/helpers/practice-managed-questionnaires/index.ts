import {
  Coding,
  Extension,
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
} from 'fhir/r4b';
import { cloneDeep, isEqual } from 'lodash-es';
import {
  FORM_PLACEMENT_TAG_SYSTEM,
  JSON_IMPORT_QUESTIONNAIRE_TAG,
  OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS,
  PRACTICE_MANAGED_QUESTIONNAIRE_TAG,
  QR_DISTRIBUTION_TAG,
} from '../../fhir/constants';
import { flattenIntakeQuestionnaireItems } from '../../types/data/paperwork/paperwork.types';
import {
  DataTypeSchema,
  InputWidthSchema,
  PracticeManagedQuestionnaireItemSchema,
  PracticeManagedQuestionnaireSchema,
} from '../../types/data/practice-managed-questionnaires/practice-managed-questionnaire.schema';
import {
  PracticeManagedQuestionnaire,
  PracticeManagedQuestionnaireItem,
  StandaloneFormDTO,
  TAGGED_FORM_PLACEMENTS,
} from '../../types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { CalculableItem, formatCalculatedValue, isCalculatedItem } from '../paperwork/calculated-answers';
import { mapQuestionnaireAndValueSetsToItemsList } from '../paperwork/paperwork';
import { slugify } from '../slugify';

const DATA_TYPE_EXTENSION_URL = OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.dataType;
const INPUT_WIDTH_EXTENSION_URL = OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.inputWidth;

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

  const { _key, dataType: _dataType, inputWidth: _inputWidth, ...fhirItem } = item;

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

export function isPracticeManagedQ(q: Questionnaire | undefined): boolean {
  if (!q) return false;

  const { system, code } = PRACTICE_MANAGED_QUESTIONNAIRE_TAG;
  return Boolean(q.meta?.tag?.some((t) => t.code === code && t.system === system));
}

/** Where a practice-managed form's answers appear. Visit Details is the default (no tag). */
export const FORM_PLACEMENTS = ['visit-details', ...TAGGED_FORM_PLACEMENTS] as const;
export type FormPlacement = (typeof FORM_PLACEMENTS)[number];

export const FORM_PLACEMENT_LABELS: Record<FormPlacement, string> = {
  'visit-details': 'Visit Details',
  screening: 'Screening',
  questionnaires: 'Clinical Forms',
};

export function getFormPlacement(q: Pick<Questionnaire, 'meta'> | undefined): FormPlacement {
  const code = q?.meta?.tag?.find((t) => t.system === FORM_PLACEMENT_TAG_SYSTEM)?.code;
  return FORM_PLACEMENTS.find((placement) => placement === code) ?? 'visit-details';
}

/** Returns the form's tags with its placement replaced; Visit Details is stored as no tag. */
export function withFormPlacement(tags: Coding[] | undefined, placement: FormPlacement): Coding[] {
  const others = (tags ?? []).filter((t) => t.system !== FORM_PLACEMENT_TAG_SYSTEM);
  return placement === 'visit-details' ? others : [...others, { system: FORM_PLACEMENT_TAG_SYSTEM, code: placement }];
}

export function isJsonImportedQ(q: Pick<Questionnaire, 'meta'> | undefined): boolean {
  if (!q) return false;

  const { system, code } = JSON_IMPORT_QUESTIONNAIRE_TAG;
  return Boolean(q.meta?.tag?.some((t) => t.code === code && t.system === system));
}

export function qrSentManually(qr: QuestionnaireResponse | undefined): boolean {
  if (!qr) return false;

  const { system, code } = QR_DISTRIBUTION_TAG;
  return Boolean(qr.meta?.tag?.some((t) => t.code === code && t.system === system));
}

export const formatQuestionnaireItemValueToString = (
  item: QuestionnaireResponseItem | undefined,
  questions: Map<string, CalculableItem>
): string => {
  if (!item) return '';

  const a = item.answer?.[0];
  if (!a) return '';

  const question = questions.get(item.linkId);
  if (question && isCalculatedItem(question)) {
    return formatCalculatedValue(a.valueBoolean ?? a.valueInteger ?? a.valueDecimal ?? a.valueString);
  }

  if (a.valueCoding?.display) return a.valueCoding.display;
  if (a.valueString !== undefined) return a.valueString;
  if (a.valueBoolean !== undefined) return a.valueBoolean ? 'Positive' : 'Negative';
  if (a.valueInteger !== undefined) return String(a.valueInteger);
  if (a.valueDecimal !== undefined) return String(a.valueDecimal);
  if (a.valueDate) return a.valueDate;
  if (a.valueDateTime) return a.valueDateTime;
  return '';
};

/** A filled-out form as question/answer lines, in form order; unanswered questions have an empty answer. */
export const formResponseLines = (
  form: StandaloneFormDTO
): { linkId: string; question: string; answer: string; answered: boolean }[] => {
  const answers = new Map<string, QuestionnaireResponseItem>();
  const walk = (items: QuestionnaireResponseItem[]): void =>
    items.forEach((item) => {
      if (item.answer?.length) answers.set(item.linkId, item);
      walk([...(item.item ?? []), ...(item.answer ?? []).flatMap((answer) => answer.item ?? [])]);
    });
  walk(form.questionnaireResponse.item ?? []);
  const questions = flattenIntakeQuestionnaireItems(form.allItems).filter(
    (q) => q.type !== 'group' && q.type !== 'display'
  );
  const questionsByLinkId = new Map(questions.map((q) => [q.linkId, q]));
  return questions.map((q) => ({
    linkId: q.linkId,
    question: q.text ?? '',
    answer: formatQuestionnaireItemValueToString(answers.get(q.linkId), questionsByLinkId),
    // A recorded score alone doesn't mean anyone has started the form.
    answered: answers.has(q.linkId) && !isCalculatedItem(q),
  }));
};

/** True once at least one of the form's questions has an answer; a sent-but-unopened form has none. */
export const hasAnyAnswer = (form: StandaloneFormDTO): boolean => formResponseLines(form).some((line) => line.answered);

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
    placement: getFormPlacement(questionnaire),
    questionnaireUrl: questionnaire.url,
  };
};
