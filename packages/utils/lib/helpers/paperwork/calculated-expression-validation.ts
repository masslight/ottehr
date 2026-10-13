import { parse } from 'acorn';
import {
  CALCULABLE_ITEM_TYPES,
  CalculableItem,
  CALCULATED_EXPRESSION_LANGUAGE,
  CalculatedItemDef,
  extractAnswerReferences,
  flattenItems,
  getCalculatedExpression,
  getCalculatedItemDefs,
  isCalculatedItem,
} from './calculated-answers';

/*
  Static checks for the calculated items of a questionnaire that is being uploaded. Expressions are parsed (to catch
  syntax errors) but never compiled into a function or executed, so this is safe to run on the server.
*/

// undefined when the expression is a single, well formed javascript expression; otherwise what is wrong with it
const findSyntaxProblem = (expression: string): string | undefined => {
  try {
    // the newline lets an expression end with a line comment
    const program = parse(`(${expression}\n)`, { ecmaVersion: 'latest' });
    if (program.body.length !== 1 || program.body[0]?.type !== 'ExpressionStatement') {
      return 'it must be a single expression';
    }
    return undefined;
  } catch (error) {
    // acorn reports a position in the wrapped text, which would only confuse
    return error instanceof Error ? error.message.replace(/\s*\(\d+:\d+\)$/, '') : String(error);
  }
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
 * Returns one actionable, human-readable message per problem with the calculated items of a questionnaire;
 * empty when everything is fine.
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

    const syntaxProblem = findSyntaxProblem(expression);
    if (syntaxProblem) {
      issues.push(
        `${label}: the expression is not valid JavaScript (${syntaxProblem}). Expression: ${expression} . Fix the syntax and upload again.`
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
