// @ts-check
'use strict';

/**
 * Every eslint-disable comment that switches off one of the given rules says why, after " -- ":
 *
 *   // eslint-disable-next-line ottehr/billing-fhir-client-only -- reads the clinical encounter
 *
 * A comment that names no rules switches them all off, the given ones included, so it needs a reason
 * too. This is its own rule because a rule can't police the comments that disable it: an
 * eslint-disable-line or a block eslint-disable would switch off its own report. For the same reason a
 * bare eslint-disable-line or block eslint-disable also switches this rule off, which only review catches.
 */

/**
 * @typedef {import('@typescript-eslint/utils').TSESTree.Comment} Comment
 * @typedef {'missingReason' | 'missingReasonAllRules'} MessageId
 * @typedef {[{ rules: string[] }]} Options
 */

// ESLint's own parsing: a disable directive, then the reason after two or more dashes set off by whitespace.
const DISABLE_DIRECTIVE = /^(eslint-disable(?:-next-line|-line)?)(?:\s|$)/u;
const REASON_SEPARATOR = /\s-{2,}\s/u;

/** @type {import('@typescript-eslint/utils').TSESLint.RuleModule<MessageId, Options>} */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'eslint-disable comments for the given rules say why',
    },
    schema: [
      {
        type: 'object',
        properties: {
          rules: { type: 'array', items: { type: 'string' }, minItems: 1, uniqueItems: true },
        },
        required: ['rules'],
        additionalProperties: false,
      },
    ],
    messages: {
      missingReason: 'Say why {{rule}} is disabled here: add the reason after " -- " in this comment.',
      missingReasonAllRules:
        'This comment disables every rule, {{rules}} included: add the reason after " -- " in this comment.',
    },
  },
  defaultOptions: [{ rules: [] }],
  create(context) {
    const rules = context.options[0]?.rules ?? [];

    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const directive = parseDisableDirective(comment);
          if (!directive || directive.reason) continue;

          const rule = directive.rules.find((name) => rules.includes(name));
          if (rule) {
            context.report({ loc: comment.loc, messageId: 'missingReason', data: { rule } });
          } else if (directive.rules.length === 0) {
            context.report({ loc: comment.loc, messageId: 'missingReasonAllRules', data: { rules: rules.join(', ') } });
          }
        }
      },
    };
  },
};

/**
 * The rules an eslint-disable comment names (none means all of them) and its reason, or undefined when
 * the comment is not one ESLint acts on.
 * @param {Comment} comment
 */
function parseDisableDirective(comment) {
  const separator = REASON_SEPARATOR.exec(comment.value);
  const directive = (separator ? comment.value.slice(0, separator.index) : comment.value).trim();
  const reason = separator ? comment.value.slice(separator.index + separator[0].length).trim() : '';

  const match = DISABLE_DIRECTIVE.exec(directive);
  // Line comments take only the -line forms; ESLint ignores a `// eslint-disable`.
  if (!match || (comment.type === 'Line' && match[1] === 'eslint-disable')) return undefined;

  const rules = directive
    .slice(match[1].length)
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  return { rules, reason };
}
