import { QuestionnaireResponseItem } from 'fhir/r4b';
import { OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS } from '../../fhir/constants';
import { CalculatedExpression } from '../../types/data/paperwork/paperwork.types';

/*
  Calculated items (sdc-questionnaire-calculatedExpression) are formula fields: their value is derived from the other
  answers in the form and is never stored on the QuestionnaireResponse. Wherever results are shown (the patient form,
  the EHR response viewer) the value is evaluated from the answers recorded at that moment.

  Expressions are javascript with a single `answers` argument, keyed by linkId, e.g.
    (answers["q1"]||0)+(answers["q2"]||0)
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

const CALCULABLE_ITEM_TYPES = ['string', 'text', 'boolean', 'integer', 'decimal', 'date'];

export const getCalculatedExpression = (item: CalculableItem): CalculatedExpression | undefined => {
  if (item.calculatedExpression) return item.calculatedExpression;
  const valueExpression = item.extension?.find(
    (ext) => ext.url === OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.calculatedExpression
  )?.valueExpression;
  return valueExpression ? { language: valueExpression.language, expression: valueExpression.expression } : undefined;
};

export const isCalculatedItem = (item: CalculableItem): boolean => getCalculatedExpression(item) !== undefined;

const flattenItems = (items: CalculableItem[] | undefined, accum: CalculableItem[] = []): CalculableItem[] => {
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
    const values = (item.answer ?? []).map(answerToValue).filter((v) => v !== undefined);
    if (values.length === 1) accum[item.linkId] = values[0];
    else if (values.length > 1) accum[item.linkId] = values;
    buildAnswersMap(item.item, accum);
  }
  return accum;
};

interface CalculatedItemDef {
  linkId: string;
  item: CalculableItem;
  expression: string;
  references: string[];
}

// callers may pass an already flattened list, so a linkId can be seen more than once
const getCalculatedItemDefs = (items: CalculableItem[]): CalculatedItemDef[] => {
  const seen = new Set<string>();
  return flattenItems(items).flatMap((item) => {
    const expression = getCalculatedExpression(item)?.expression;
    if (!expression || seen.has(item.linkId)) return [];
    seen.add(item.linkId);
    return [{ linkId: item.linkId, item, expression, references: extractAnswerReferences(expression) }];
  });
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
  // the form never stores calculated values, but a stale copy must not shadow the formula
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

const describe = (item: CalculableItem): string => (item.text ? `"${item.linkId}" (${item.text})` : `"${item.linkId}"`);

const editDistance = (a: string, b: string): number => {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0] ?? 0;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = prev[j] ?? 0;
      prev[j] = Math.min(above + 1, (prev[j - 1] ?? 0) + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return prev[b.length] ?? 0;
};

const closestLinkId = (missing: string, linkIds: string[]): string | undefined => {
  let best: { linkId: string; distance: number } | undefined;
  for (const linkId of linkIds) {
    const distance = editDistance(missing.toLowerCase(), linkId.toLowerCase());
    if (!best || distance < best.distance) best = { linkId, distance };
  }
  return best && best.distance <= Math.max(2, Math.floor(missing.length / 3)) ? best.linkId : undefined;
};

const MAX_LISTED_LINK_IDS = 10;

/**
 * Static checks for the calculated items in a questionnaire, for use when a questionnaire is uploaded.
 * Returns one actionable, human-readable message per problem; empty when everything is fine.
 * Expressions are compiled (to catch syntax errors) but never executed.
 */
export const collectCalculatedExpressionIssues = (items: CalculableItem[]): string[] => {
  const issues: string[] = [];
  const allItems = flattenItems(items);
  const allLinkIds = allItems.map((item) => item.linkId);
  const calculated = allItems.filter(isCalculatedItem);

  for (const item of calculated) {
    const label = describe(item);
    const { language, expression } = getCalculatedExpression(item) ?? {};

    if (!CALCULABLE_ITEM_TYPES.includes(item.type)) {
      issues.push(
        `${label}: calculated expressions can only be used on ${CALCULABLE_ITEM_TYPES.slice(0, -1).join(', ')} and ${
          CALCULABLE_ITEM_TYPES[CALCULABLE_ITEM_TYPES.length - 1]
        } items, not "${item.type}".`
      );
    }
    if (!expression || expression.trim() === '') {
      issues.push(
        `${label}: the calculated-expression extension has no expression. Add valueExpression.expression, or remove the extension.`
      );
      continue;
    }
    if (language !== CALCULATED_EXPRESSION_LANGUAGE) {
      issues.push(
        `${label}: expression language ${
          language ? `"${language}" is not supported` : 'is missing'
        }. Set valueExpression.language to "${CALCULATED_EXPRESSION_LANGUAGE}".`
      );
    }

    const compiled = compileExpression(expression);
    if ('error' in compiled) {
      issues.push(
        `${label}: the expression is not valid JavaScript (${compiled.error}). Expression: ${expression} . Fix the syntax and upload again.`
      );
    }

    for (const ref of extractAnswerReferences(expression)) {
      if (ref === item.linkId) {
        issues.push(`${label}: the expression reads its own value. Remove answers["${ref}"] from it.`);
      } else if (!allLinkIds.includes(ref)) {
        const suggestion = closestLinkId(ref, allLinkIds);
        const listed = allLinkIds.filter((id) => id !== item.linkId).slice(0, MAX_LISTED_LINK_IDS);
        const available =
          listed.length === 0
            ? ' The questionnaire has no other items.'
            : ` Available linkIds: ${listed.join(', ')}${allLinkIds.length - 1 > listed.length ? ', ...' : ''}.`;
        issues.push(
          `${label}: the expression reads answers["${ref}"], but no item has linkId "${ref}".${
            suggestion ? ` Did you mean "${suggestion}"?` : ''
          }${available}`
        );
      }
    }
  }

  issues.push(...findCircularReferences(getCalculatedItemDefs(items)));
  return issues;
};

const findCircularReferences = (defs: CalculatedItemDef[]): string[] => {
  const byLinkId = new Map(defs.map((def) => [def.linkId, def]));
  const issues: string[] = [];
  const reported = new Set<string>();
  const finished = new Set<string>();

  const visit = (def: CalculatedItemDef, path: string[]): void => {
    if (finished.has(def.linkId)) return;
    const cycleStart = path.indexOf(def.linkId);
    if (cycleStart !== -1) {
      const cycle = path.slice(cycleStart);
      const key = [...cycle].sort().join('|');
      // a self reference is reported on its own
      if (cycle.length > 1 && !reported.has(key)) {
        reported.add(key);
        const names = cycle.map((id) => `"${id}"`);
        const subject =
          cycle.length === 2
            ? `${names[0]} and ${names[1]}`
            : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
        issues.push(
          `${subject} depend on each other (${[...cycle, def.linkId].join(
            ' -> '
          )}), so none of their values can be calculated. Remove one of the references.`
        );
      }
      return;
    }
    for (const ref of def.references) {
      const dependency = byLinkId.get(ref);
      if (dependency) visit(dependency, [...path, def.linkId]);
    }
    finished.add(def.linkId);
  };

  defs.forEach((def) => visit(def, []));
  return issues;
};
