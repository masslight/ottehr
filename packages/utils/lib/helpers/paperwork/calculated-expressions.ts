import { QuestionnaireResponseItem } from 'fhir/r4b';
import {
  CalculableItem,
  CalculatedItemDef,
  CalculatedValue,
  coerceCalculatedValue,
  getCalculatedItemDefs,
  isCalculatedItem,
} from './calculated-answers';

/*
  Calculated items (sdc-questionnaire-calculatedExpression) are formula fields: their value is derived from the other
  answers in the form. The expression is javascript with a single `answers` argument, keyed by linkId, e.g.
    (answers["q1"]||0)+(answers["q2"]||0)

  THIS IS BROWSER-ONLY CODE. The javascript in a questionnaire is only ever evaluated in a browser, never on the
  server, so nothing in packages/zambdas may import this module. The server works with the computed values through
  calculated-answers.ts instead.

  The browser records the values it computes on the QuestionnaireResponse by sending them as `calculatedAnswers`
  (see buildCalculatedAnswers). Wherever a form is being filled in, the live value is evaluated from the answers on
  screen.
*/

type CompiledExpression = { fn: (answers: Record<string, unknown>) => unknown } | { error: string };
const compileCache = new Map<string, CompiledExpression>();

const compileExpression = (expression: string): CompiledExpression => {
  const cached = compileCache.get(expression);
  if (cached) return cached;
  let compiled: CompiledExpression;
  try {
    // the newline lets an expression end with a line comment
    const fn = new Function('answers', `return (${expression}\n);`) as (answers: Record<string, unknown>) => unknown;
    compiled = { fn };
  } catch (error) {
    compiled = { error: error instanceof Error ? error.message : String(error) };
  }
  compileCache.set(expression, compiled);
  return compiled;
};

const NUMERIC_CODE_REGEX = /^-?\d+(\.\d+)?$/;

// a coded answer is exposed to expressions as its code, as a number when the code is numeric (so scores can be summed)
const codingToValue = (code: string | undefined): string | number | undefined => {
  if (code === undefined) return undefined;
  return NUMERIC_CODE_REGEX.test(code) ? Number(code) : code;
};

const answerToValue = (answer: NonNullable<QuestionnaireResponseItem['answer']>[number]): unknown => {
  if (answer.valueCoding) return codingToValue(answer.valueCoding.code ?? answer.valueCoding.display);
  if (answer.valueString !== undefined) return answer.valueString;
  if (answer.valueBoolean !== undefined) return answer.valueBoolean;
  if (answer.valueInteger !== undefined) return answer.valueInteger;
  if (answer.valueDecimal !== undefined) return answer.valueDecimal;
  if (answer.valueDate !== undefined) return answer.valueDate;
  if (answer.valueDateTime !== undefined) return answer.valueDateTime;
  return undefined;
};

// flat map of linkId -> answer value across every (nested) item of a QuestionnaireResponse
export const buildAnswersMap = (
  qrItems: QuestionnaireResponseItem[] | undefined,
  accum: Record<string, unknown> = {}
): Record<string, unknown> => {
  for (const item of qrItems ?? []) {
    // form state can hold an empty `answer: [null]` for an item that was never answered
    const values = (item.answer ?? [])
      .filter((answer) => !!answer)
      .map(answerToValue)
      .filter((v) => v !== undefined);
    if (values.length === 1) accum[item.linkId] = values[0];
    else if (values.length > 1) accum[item.linkId] = values;
    buildAnswersMap(item.item, accum);
  }
  return accum;
};

// dependencies first, so an expression can read another calculated value wherever the author placed it in the form.
// items caught in a circular reference are left out
const orderByDependency = (defs: CalculatedItemDef[]): CalculatedItemDef[] => {
  const byLinkId = new Map(defs.map((def) => [def.linkId, def]));
  const ordered: CalculatedItemDef[] = [];
  const done = new Set<string>();
  const inProgress = new Set<string>();

  const visit = (def: CalculatedItemDef): boolean => {
    if (done.has(def.linkId)) return true;
    if (inProgress.has(def.linkId)) return false;
    inProgress.add(def.linkId);
    let ok = true;
    for (const ref of def.references) {
      const dependency = byLinkId.get(ref);
      if (dependency && !visit(dependency)) ok = false;
    }
    inProgress.delete(def.linkId);
    if (ok) {
      done.add(def.linkId);
      ordered.push(def);
    }
    return ok;
  };

  defs.forEach(visit);
  return ordered;
};

const normalizeResult = (result: unknown): CalculatedValue => {
  if (typeof result === 'number') return Number.isFinite(result) ? result : undefined;
  if (typeof result === 'string' || typeof result === 'boolean') return result;
  return undefined;
};

/**
 * Evaluates every calculated item in `items` (recursively) against the answers in `qrItems`.
 * An expression that fails to compile or throws yields `undefined`; it never throws.
 */
export const evaluateCalculatedItems = (
  items: CalculableItem[],
  qrItems: QuestionnaireResponseItem[] | undefined
): Record<string, CalculatedValue> => {
  const defs = getCalculatedItemDefs(items);
  if (defs.length === 0) return {};

  const answers = buildAnswersMap(qrItems);
  // a stored copy of a calculated value (it may be stale) must not shadow the formula
  defs.forEach((def) => delete answers[def.linkId]);

  const results: Record<string, CalculatedValue> = {};
  const ordered = orderByDependency(defs);
  for (const def of ordered) {
    const compiled = compileExpression(def.expression);
    let value: CalculatedValue;
    if ('error' in compiled) {
      console.warn(`calculated item "${def.linkId}" has an invalid expression: ${compiled.error}`);
    } else {
      try {
        value = normalizeResult(compiled.fn(answers));
      } catch (error) {
        console.warn(`calculated item "${def.linkId}" could not be evaluated: ${String(error)}`);
      }
    }
    results[def.linkId] = value;
    if (value !== undefined) answers[def.linkId] = value;
  }
  defs
    .filter((def) => !(def.linkId in results))
    .forEach((def) => {
      console.warn(`calculated item "${def.linkId}" is part of a circular reference and cannot be calculated`);
      results[def.linkId] = undefined;
    });
  return results;
};

export const formatCalculatedValue = (value: CalculatedValue): string => {
  if (value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

export interface BuildCalculatedAnswersInput {
  // the questionnaire's top-level items (its pages), hidden ones included
  pageItems: CalculableItem[];
  // the values currently in the form, keyed by the linkId of the items they belong to (the freshest answers)
  formValues: Record<string, QuestionnaireResponseItem | undefined>;
  // the response as stored so far, one item per page
  savedPages: QuestionnaireResponseItem[];
  // a calculated item on a page that is not enabled is not worked out, and any stored value is cleared
  isPageEnabled?: (page: CalculableItem) => boolean;
}

const findSavedItem = (
  items: QuestionnaireResponseItem[] | undefined,
  linkId: string
): QuestionnaireResponseItem | undefined => {
  for (const item of items ?? []) {
    if (item.linkId === linkId) return item;
    const nested = findSavedItem(item.item, linkId);
    if (nested) return nested;
  }
  return undefined;
};

interface LocatedCalculatedItem {
  item: CalculableItem;
  page: CalculableItem;
  groupPath: string[];
}

const locateCalculatedItems = (
  items: CalculableItem[] | undefined,
  page: CalculableItem,
  groupPath: string[] = [],
  accum: LocatedCalculatedItem[] = []
): LocatedCalculatedItem[] => {
  for (const item of items ?? []) {
    if (isCalculatedItem(item)) accum.push({ item, page, groupPath });
    locateCalculatedItems(item.item, page, [...groupPath, item.linkId], accum);
  }
  return accum;
};

/**
 * Works out every calculated item in a questionnaire from the saved response overlaid with the values just entered,
 * and returns the ones whose recorded value needs to change.
 * An entry without an `answer` clears a value that is no longer calculable. Empty when nothing changed.
 */
export const buildCalculatedAnswers = (input: BuildCalculatedAnswersInput): QuestionnaireResponseItem[] => {
  const { pageItems, formValues, savedPages, isPageEnabled } = input;

  const located = pageItems.flatMap((page) => locateCalculatedItems(page.item, page));
  if (located.length === 0) return [];

  const overlay: QuestionnaireResponseItem[] = pageItems.map((page) => {
    const savedChildren = savedPages.find((saved) => saved.linkId === page.linkId)?.item ?? [];
    const item = (page.item ?? []).flatMap((child) => {
      const value = formValues[child.linkId] ?? savedChildren.find((saved) => saved.linkId === child.linkId);
      return value ? [value] : [];
    });
    return { linkId: page.linkId, item };
  });

  const results = evaluateCalculatedItems(pageItems, overlay);

  const calculatedPages: QuestionnaireResponseItem[] = [];
  for (const { item, page, groupPath } of located) {
    const enabled = isPageEnabled ? isPageEnabled(page) : true;
    const answer = enabled ? coerceCalculatedValue(item, results[item.linkId]) : undefined;

    const savedAnswers = findSavedItem(savedPages, item.linkId)?.answer ?? [];
    const unchanged = answer
      ? savedAnswers.length === 1 && JSON.stringify(savedAnswers[0]) === JSON.stringify(answer)
      : savedAnswers.length === 0;
    if (unchanged) continue;

    let pageEntry = calculatedPages.find((entry) => entry.linkId === page.linkId);
    if (!pageEntry) {
      pageEntry = { linkId: page.linkId, item: [] };
      calculatedPages.push(pageEntry);
    }
    let container = pageEntry.item ?? [];
    for (const groupLinkId of groupPath) {
      let group = container.find((entry) => entry.linkId === groupLinkId);
      if (!group) {
        group = { linkId: groupLinkId, item: [] };
        container.push(group);
      }
      container = group.item ?? [];
    }
    container.push(answer ? { linkId: item.linkId, answer: [answer] } : { linkId: item.linkId });
  }

  return pageItems.flatMap((page) => calculatedPages.filter((entry) => entry.linkId === page.linkId));
};
