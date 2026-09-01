import { Questionnaire, QuestionnaireResponseItem, QuestionnaireResponseItemAnswer } from 'fhir/r4b';
import { mapQuestionnaireAndValueSetsToItemsList } from 'utils/lib/helpers/paperwork/paperwork';
import {
  flattenIntakeQuestionnaireItems,
  IntakeQuestionnaireItem,
} from 'utils/lib/types/data/paperwork/paperwork.types';

export interface ContextField {
  // top-level page the field lives on (used to place stub answers back on their page)
  pageLinkId: string;
  field: IntakeQuestionnaireItem;
  // distinct answer values the questionnaire's conditions test this field against — offered as dropdown
  // suggestions so the tester can pick the exact values that flip logic (e.g. 'occupational-medicine').
  suggestions: string[];
}

export interface CollectContextResult {
  contextFields: ContextField[];
  // true when some condition references the `$status` sentinel (so the panel offers a status selector)
  statusReferenced: boolean;
}

const lastPathNode = (question: string | undefined): string | undefined => question?.split('.').pop();

interface ConditionLike {
  answerString?: string;
  answerBoolean?: boolean;
  answerDate?: string;
  answerInteger?: number | string;
}

const extractAnswerValue = (cond: ConditionLike): string | undefined => {
  if (cond.answerString !== undefined) return cond.answerString;
  if (cond.answerBoolean !== undefined) return String(cond.answerBoolean); // 'true' | 'false'
  if (cond.answerInteger !== undefined) return String(cond.answerInteger);
  if (cond.answerDate !== undefined) return cond.answerDate;
  return undefined;
};

/**
 * Collects the set of linkIds that any condition in the questionnaire references as a trigger — across
 * native `enableWhen` and the ottehr `require-when`/`filter-when`/`text-when`/`complex-validation`/
 * `answer-display-filter` extensions. Dotted references (e.g. `contact-information-page.reason-for-visit`)
 * are reduced to their last node (the bare linkId), matching how the engine resolves values. Also gathers
 * the distinct answer values each field is tested against, and whether `$status` is referenced.
 */
export const collectReferencedQuestions = (
  allItems: IntakeQuestionnaireItem[]
): { referenced: Set<string>; statusReferenced: boolean; suggestions: Map<string, Set<string>> } => {
  const referenced = new Set<string>();
  const suggestions = new Map<string, Set<string>>();
  let statusReferenced = false;

  const addCondition = (question: string | undefined, cond: ConditionLike): void => {
    if (!question) return;
    if (question === '$status') {
      statusReferenced = true;
      return;
    }
    const node = lastPathNode(question);
    if (!node) return;
    referenced.add(node);
    const answer = extractAnswerValue(cond);
    if (answer !== undefined && answer !== '') {
      if (!suggestions.has(node)) suggestions.set(node, new Set());
      suggestions.get(node)!.add(answer);
    }
  };

  const visit = (item: IntakeQuestionnaireItem): void => {
    item.enableWhen?.forEach((ew) => addCondition(ew.question, ew));
    item.filterWhen?.forEach((c) => addCondition(c.question, c));
    if (item.requireWhen) addCondition(item.requireWhen.question, item.requireWhen);
    item.textWhen?.forEach((c) => addCondition(c.question, c));
    if (item.complexValidation?.triggerWhen) {
      addCondition(item.complexValidation.triggerWhen.question, item.complexValidation.triggerWhen);
    }
    item.answerDisplayFilters?.forEach(
      (f) => f.conditions?.forEach((c) => addCondition(c.question, { answerString: c.answer }))
    );
    item.item?.forEach(visit);
  };

  allItems.forEach(visit);
  return { referenced, statusReferenced, suggestions };
};

/**
 * Finds the hidden "context" fields a tester must be able to set to exercise the questionnaire's
 * conditional logic: readOnly fields (rendered hidden; populated from appointment/patient in production)
 * that are ALSO referenced by some condition. readOnly-but-only-autofill fields (e.g. patient-first-name
 * used solely as a fill-from source) are excluded. Returns them grouped by owning top-level page, each
 * with the answer values the conditions test against.
 */
export const collectContextFields = (questionnaire: Questionnaire): CollectContextResult => {
  // mapQuestionnaireAndValueSetsToItemsList mutates its input, so clone.
  const allItems = mapQuestionnaireAndValueSetsToItemsList(structuredClone(questionnaire.item ?? []), []);
  const { referenced, statusReferenced, suggestions } = collectReferencedQuestions(allItems);

  const contextFields: ContextField[] = [];
  for (const page of allItems) {
    if (!page.linkId) continue;
    for (const field of flattenIntakeQuestionnaireItems(page.item ?? [])) {
      if (field.readOnly && field.type !== 'group' && field.linkId && referenced.has(field.linkId)) {
        contextFields.push({
          pageLinkId: page.linkId,
          field,
          suggestions: Array.from(suggestions.get(field.linkId) ?? []),
        });
      }
    }
  }

  return { contextFields, statusReferenced };
};

const buildAnswer = (
  type: IntakeQuestionnaireItem['type'],
  raw: string
): QuestionnaireResponseItemAnswer | undefined => {
  switch (type) {
    case 'boolean':
      return { valueBoolean: raw === 'true' };
    case 'integer': {
      const n = parseInt(raw, 10);
      return Number.isNaN(n) ? undefined : { valueInteger: n };
    }
    case 'decimal': {
      const n = parseFloat(raw);
      return Number.isNaN(n) ? undefined : { valueDecimal: n };
    }
    case 'date':
      return { valueDate: raw };
    default:
      // string / text / choice / open-choice and anything else the panel renders as text/select
      return { valueString: raw };
  }
};

/**
 * Turns the tester's `{ linkId -> raw string }` selections into stub QR answers grouped by page, ready
 * to hand to QuestionnairePreview's `stubAnswersByPage`. Fields left unset (undefined/empty) are omitted.
 */
export const buildStubAnswersByPage = (
  contextFields: ContextField[],
  values: Record<string, string | undefined>
): Record<string, QuestionnaireResponseItem[]> => {
  const byPage: Record<string, QuestionnaireResponseItem[]> = {};

  for (const { pageLinkId, field } of contextFields) {
    const linkId = field.linkId;
    if (!linkId) continue;
    const raw = values[linkId];
    if (raw === undefined || raw === '') continue;

    const answer = buildAnswer(field.type, raw);
    if (!answer) continue;

    (byPage[pageLinkId] ??= []).push({ linkId, answer: [answer] });
  }

  return byPage;
};
