import { QuestionnaireResponseItem, QuestionnaireResponseItemAnswer } from 'fhir/r4b';
import { OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS } from '../../fhir/constants';
import { CalculatedExpression } from '../../types/data/paperwork/paperwork.types';

/*
  Calculated items (sdc-questionnaire-calculatedExpression) are formula fields whose value is derived from the other
  answers in the form. The javascript expression is only ever run in the browser (see calculated-expressions.ts); the
  browser then sends the computed values to the server as `calculatedAnswers`, which are recorded on the
  QuestionnaireResponse.

  This module is the part that is safe to use anywhere, the server included: it only reads the shape of the
  questionnaire and the computed values. It never compiles or evaluates an expression, so it must not import
  calculated-expressions.ts.

  calculatedAnswers are an array of page-shaped QuestionnaireResponseItems (nesting preserved), e.g.
    [{ linkId: 'results', item: [{ linkId: 'total', answer: [{ valueString: '2' }] }] }]
  An entry without an `answer` means "clear the stored value".
*/

export const CALCULATED_EXPRESSION_LANGUAGE = 'text/javascript';

export type CalculatedValue = string | number | boolean | undefined;

// satisfied by both raw FHIR QuestionnaireItems (extension) and our IntakeQuestionnaireItems (calculatedExpression)
export interface CalculableItem {
  linkId: string;
  type: string;
  text?: string;
  item?: CalculableItem[];
  extension?: { url: string; valueExpression?: { language?: string; expression?: string } }[];
  calculatedExpression?: CalculatedExpression;
}

export const CALCULABLE_ITEM_TYPES = ['string', 'text', 'boolean', 'integer', 'decimal', 'date'];

export const getCalculatedExpression = (item: CalculableItem): CalculatedExpression | undefined => {
  if (item.calculatedExpression) return item.calculatedExpression;
  const valueExpression = item.extension?.find(
    (ext) => ext.url === OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.calculatedExpression
  )?.valueExpression;
  return valueExpression ? { language: valueExpression.language, expression: valueExpression.expression } : undefined;
};

export const isCalculatedItem = (item: CalculableItem): boolean => getCalculatedExpression(item) !== undefined;

export const flattenItems = (items: CalculableItem[] | undefined, accum: CalculableItem[] = []): CalculableItem[] => {
  for (const item of items ?? []) {
    accum.push(item);
    flattenItems(item.item, accum);
  }
  return accum;
};

// linkIds an expression reads: answers["x"], answers['x'] or answers.x
const REFERENCE_REGEX = /answers\s*(?:\[\s*(['"])(.*?)\1\s*\]|\.\s*([A-Za-z_$][\w$]*))/g;

export const extractAnswerReferences = (expression: string): string[] => {
  const references = new Set<string>();
  for (const match of expression.matchAll(REFERENCE_REGEX)) {
    const linkId = match[2] ?? match[3];
    if (linkId) references.add(linkId);
  }
  return [...references];
};

export interface CalculatedItemDef {
  linkId: string;
  item: CalculableItem;
  expression: string;
  references: string[];
}

// callers may pass an already flattened list, so a linkId can be seen more than once
export const getCalculatedItemDefs = (items: CalculableItem[]): CalculatedItemDef[] => {
  const seen = new Set<string>();
  return flattenItems(items).flatMap((item) => {
    const expression = getCalculatedExpression(item)?.expression;
    if (!expression || seen.has(item.linkId)) return [];
    seen.add(item.linkId);
    return [{ linkId: item.linkId, item, expression, references: extractAnswerReferences(expression) }];
  });
};

// the answer a calculated value is recorded as, typed by the item's declared type. undefined when there is nothing to
// record: no value, or one that doesn't fit the type (e.g. a fraction for an integer item)
export const coerceCalculatedValue = (
  item: Pick<CalculableItem, 'type'>,
  value: CalculatedValue
): QuestionnaireResponseItemAnswer | undefined => {
  if (value === undefined) return undefined;
  switch (item.type) {
    case 'boolean':
      return typeof value === 'boolean' ? { valueBoolean: value } : undefined;
    case 'integer': {
      const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
      return typeof n === 'number' && Number.isInteger(n) ? { valueInteger: n } : undefined;
    }
    case 'decimal': {
      const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
      return typeof n === 'number' && Number.isFinite(n) ? { valueDecimal: n } : undefined;
    }
    case 'string':
    case 'text':
    case 'date':
      // dates are recorded as strings, like every other date answer
      return typeof value === 'boolean' ? undefined : { valueString: String(value) };
    default:
      return undefined;
  }
};

// does the answer have the one value[x] that the item's declared type calls for
const answerMatchesItemType = (
  item: Pick<CalculableItem, 'type'>,
  answer: QuestionnaireResponseItemAnswer
): boolean => {
  const keys = Object.keys(answer).filter((key) => (answer as Record<string, unknown>)[key] !== undefined);
  if (keys.length !== 1) return false;
  const [key] = keys;
  const value = (answer as Record<string, unknown>)[key as string];
  switch (item.type) {
    case 'boolean':
      return key === 'valueBoolean' && typeof value === 'boolean';
    case 'integer':
      return key === 'valueInteger' && typeof value === 'number' && Number.isInteger(value);
    case 'decimal':
      return key === 'valueDecimal' && typeof value === 'number' && Number.isFinite(value);
    case 'string':
    case 'text':
    case 'date':
      return key === 'valueString' && typeof value === 'string';
    default:
      return false;
  }
};

const hasAnswer = (item: QuestionnaireResponseItem): boolean => (item.answer?.length ?? 0) > 0;

/**
 * Checks `calculatedAnswers` received from a client against the questionnaire, without evaluating anything:
 * every entry must be a calculated item on the page it names, and its answer must have the item's declared type.
 * Returns one human-readable message per problem; empty when everything is acceptable.
 */
export const validateCalculatedAnswers = (
  questionnaireItems: CalculableItem[],
  calculatedAnswers: QuestionnaireResponseItem[]
): string[] => {
  const issues: string[] = [];

  const validateEntries = (
    definitions: CalculableItem[],
    entries: QuestionnaireResponseItem[],
    location: string
  ): void => {
    for (const entry of entries) {
      const definition = definitions.find((def) => def.linkId === entry.linkId);
      if (!definition) {
        issues.push(`"${entry.linkId}" is not an item of ${location}.`);
      } else if (definition.type === 'group') {
        if (hasAnswer(entry)) {
          issues.push(`"${entry.linkId}" is a group and cannot have an answer.`);
        }
        validateEntries(definition.item ?? [], entry.item ?? [], `group "${entry.linkId}"`);
      } else if (!isCalculatedItem(definition)) {
        issues.push(`"${entry.linkId}" is not a calculated item, so its value cannot be set this way.`);
      } else if (entry.item?.length) {
        issues.push(`"${entry.linkId}" is not a group and cannot have child items.`);
      } else if (hasAnswer(entry)) {
        const answers = entry.answer ?? [];
        if (answers.length !== 1 || !answers[0] || !answerMatchesItemType(definition, answers[0])) {
          issues.push(`The value of "${entry.linkId}" does not match its item type "${definition.type}".`);
        }
      }
    }
  };

  for (const page of calculatedAnswers) {
    const definition = questionnaireItems.find((item) => item.linkId === page.linkId);
    if (!definition) {
      issues.push(`"${page.linkId}" is not a page of this questionnaire.`);
      continue;
    }
    if (hasAnswer(page)) {
      issues.push(`"${page.linkId}" is a page and cannot have an answer.`);
    }
    validateEntries(definition.item ?? [], page.item ?? [], `page "${page.linkId}"`);
  }
  return issues;
};

const orderLike = (items: QuestionnaireResponseItem[], definitions: CalculableItem[]): QuestionnaireResponseItem[] => {
  const position = (linkId: string): number => {
    const index = definitions.findIndex((def) => def.linkId === linkId);
    return index === -1 ? definitions.length : index;
  };
  return [...items].sort((a, b) => position(a.linkId) - position(b.linkId));
};

/**
 * Records calculated values on a page's response items: each entry is upserted by linkId (groups are walked,
 * and created when missing), and an entry without an answer removes the stored value. Items that are not named
 * in `calculated` are left exactly as they are, so a page's real answers are never touched.
 * `definitions` are the questionnaire's items for the same level, used to keep the questionnaire's order.
 */
export const applyCalculatedAnswers = (
  existing: QuestionnaireResponseItem[] | undefined,
  calculated: QuestionnaireResponseItem[],
  definitions: CalculableItem[]
): QuestionnaireResponseItem[] => {
  // nothing to record: leave the items, and their order, exactly as they are
  if (calculated.length === 0) return existing ?? [];
  let result = [...(existing ?? [])];

  for (const entry of calculated) {
    const definition = definitions.find((def) => def.linkId === entry.linkId);
    const index = result.findIndex((item) => item.linkId === entry.linkId);

    if (definition?.type === 'group' || (entry.item && !hasAnswer(entry))) {
      const current = index === -1 ? { linkId: entry.linkId } : result[index];
      const updated: QuestionnaireResponseItem = {
        ...current,
        linkId: entry.linkId,
        item: applyCalculatedAnswers(current?.item, entry.item ?? [], definition?.item ?? []),
      };
      if (index === -1) result.push(updated);
      else result[index] = updated;
    } else if (hasAnswer(entry)) {
      const updated: QuestionnaireResponseItem = {
        ...(result[index] ?? {}),
        linkId: entry.linkId,
        answer: entry.answer,
      };
      if (index === -1) result.push(updated);
      else result[index] = updated;
    } else if (index !== -1) {
      result = result.filter((_, i) => i !== index);
    }
  }

  return orderLike(result, definitions);
};

/**
 * The calculated values a page currently stores, as entries that applyCalculatedAnswers can put back (groups kept
 * where they hold one). A page save replaces the page's items with the answers the browser sent, which never include
 * calculated items, so the values already stored must be carried over or they would be lost on every save.
 */
export const extractCalculatedItems = (
  existing: QuestionnaireResponseItem[] | undefined,
  definitions: CalculableItem[]
): QuestionnaireResponseItem[] =>
  definitions.flatMap((definition): QuestionnaireResponseItem[] => {
    const stored = (existing ?? []).find((item) => item.linkId === definition.linkId);
    if (!stored) return [];
    if (definition.type === 'group') {
      const nested = extractCalculatedItems(stored.item, definition.item ?? []);
      return nested.length > 0 ? [{ linkId: stored.linkId, item: nested }] : [];
    }
    return isCalculatedItem(definition) && hasAnswer(stored) ? [{ linkId: stored.linkId, answer: stored.answer }] : [];
  });
