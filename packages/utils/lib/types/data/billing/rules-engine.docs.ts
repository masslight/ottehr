import { HOLD_TAG_NAME, RULES_ENGINE_TYPES, RULES_ENGINES } from './rules-engine.constants';
import {
  RULE_FIELD_CATALOG,
  RULE_FIELD_GROUP_LABELS,
  RULE_FIELD_GROUPS,
  RuleFieldDef,
  RuleFieldValueType,
  SERVICE_LINE_PROPERTY_CATALOG,
  ServiceLinePropertyDef,
  ServiceLineValueType,
} from './rules-engine.field-catalog';
import {
  MULTI_VALUE_OPERATORS,
  NO_VALUE_OPERATORS,
  RULE_OPERATOR_METADATA,
  RULE_OPERATORS,
} from './rules-engine.schemas';

// ---------------------------------------------------------------------------
// Generated documentation for the pre-submission rules engine.
//
// Everything the engine supports — conditions (claim properties + operators) and actions — is
// declared in RULE_FIELD_CATALOG and the rule schemas, so the reference documentation is rendered
// from those same declarations. `npm run docs:billing-rules` writes the result to
// docs/billing-rules-engine.md, and a unit test (rules-engine.docs.test.ts) fails when the committed
// file is stale, so the docs cannot drift from the code.
// ---------------------------------------------------------------------------

const VALUE_TYPE_LABELS: Record<RuleFieldValueType, string> = {
  string: 'text',
  number: 'number',
  date: 'date',
  select: 'one of the listed values',
  list: 'list of codes',
  payer: 'payer ID',
};

// Escape/normalize a string for use inside a markdown table cell.
const cell = (text: string): string => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');

const operatorLabel = (
  valueType: RuleFieldValueType | ServiceLineValueType,
  op: (typeof RULE_OPERATORS)[number]
): string => {
  const metadata = RULE_OPERATOR_METADATA[op];
  return valueType === 'date' && metadata.dateLabel ? metadata.dateLabel : metadata.label;
};

const allowedValues = (field: RuleFieldDef): string => {
  if (!field.options) return '';
  return field.options
    .map((option) => (option.label === option.value ? `\`${option.value}\`` : `\`${option.value}\` (${option.label})`))
    .join(', ');
};

function renderFieldTable(fields: RuleFieldDef[]): string {
  const lines = [
    '| Property | ID | Type | Operators | Settable | Description |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const field of fields) {
    const operators = field.operators.map((op) => operatorLabel(field.valueType, op)).join(', ');
    const values = allowedValues(field);
    const description = values ? `${field.description} Allowed values: ${values}.` : field.description;
    lines.push(
      `| ${cell(field.label)} | \`${field.id}\` | ${VALUE_TYPE_LABELS[field.valueType]} | ${cell(operators)} | ${
        field.settable ? 'yes' : 'no'
      } | ${cell(description)} |`
    );
  }
  return lines.join('\n');
}

function renderServiceLinePropertyTable(properties: ServiceLinePropertyDef[]): string {
  const lines = [
    '| Property | ID | Type | Match operators | Updatable | Description |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const property of properties) {
    const operators = property.operators.map((op) => operatorLabel(property.valueType, op)).join(', ');
    lines.push(
      `| ${cell(property.label)} | \`${property.id}\` | ${VALUE_TYPE_LABELS[property.valueType]} | ${cell(
        operators
      )} | ${property.settable ? 'yes' : 'no'} | ${cell(property.description)} |`
    );
  }
  return lines.join('\n');
}

function renderOperatorTable(): string {
  const lines = ['| Operator | Reads as | Value | Description |', '| --- | --- | --- | --- |'];
  for (const op of RULE_OPERATORS) {
    const metadata = RULE_OPERATOR_METADATA[op];
    const label = metadata.dateLabel ? `${metadata.label} / ${metadata.dateLabel} (dates)` : metadata.label;
    const value = NO_VALUE_OPERATORS.includes(op)
      ? 'none'
      : MULTI_VALUE_OPERATORS.includes(op)
      ? 'list of values'
      : 'single value';
    lines.push(`| \`${op}\` | ${cell(label)} | ${value} | ${cell(metadata.description)} |`);
  }
  return lines.join('\n');
}

function renderEnginesTable(): string {
  const lines = ['| Engine | Runs automatically | When every rule passes |', '| --- | --- | --- |'];
  for (const type of RULES_ENGINE_TYPES) {
    const engine = RULES_ENGINES[type];
    lines.push(`| ${cell(engine.label)} (\`${type}\`) | ${cell(engine.runsWhen)} | ${cell(engine.onPass)} |`);
  }
  return lines.join('\n');
}

export function generateRulesEngineDocumentation(): string {
  const settableCount = RULE_FIELD_CATALOG.filter((f) => f.settable).length;

  const sections: string[] = [];

  sections.push(`<!-- GENERATED FILE — DO NOT EDIT.
     This document is rendered from the rules-engine field catalog and schemas in
     packages/utils/lib/types/data/billing/. To update it, change those sources and run
     \`npm run docs:billing-rules\`. A unit test fails when this file is out of date. -->

# Billing rules engines

The billing app runs several independent rules engines. Each engine has its own ordered rule set,
its own automatic trigger, and its own on-success effect:

${renderEnginesTable()}

Engines run automatically only when a claim is created in their AR stage, and on demand from the
claim detail page. All engines share the same rule shape and the semantics below — everything in
this reference applies to every engine.

Rules run top to bottom; each rule is an **if / else-if / else** conditional whose branches end in a
list of **actions**. When every rule has run without holding the claim, the engine performs its
on-success effect.

- A rule that applies the **${HOLD_TAG_NAME}** tag stops the run and holds the claim for manual
  review; the engine's on-success effect does not happen.
- An action that cannot be applied (for example, setting a property whose target is missing from the
  claim) fails the rule: the run stops, the **${HOLD_TAG_NAME}** tag is applied, and the claim never
  proceeds with a silently skipped change.
- Disabled rules are skipped.

This reference lists every supported condition property, operator, and action. It is generated from
the same catalog that drives the rule builder and the engines, so it always matches what the engines
actually support (${RULE_FIELD_CATALOG.length} properties, ${settableCount} of them settable).`);

  sections.push(`## Conditions

A condition is one of:

- **All claims** — always matches; useful for a rule that should apply unconditionally.
- **Claim property** — compares one claim property (below) against a value using an operator.
- **Group (AND / OR)** — combines nested conditions with *all of* (AND) or *any of* (OR) logic.
  Groups can nest.

### Operators

Which operators a property supports depends on its type (see the property tables).

${renderOperatorTable()}`);

  const fieldSections = RULE_FIELD_GROUPS.map((group) => {
    const fields = RULE_FIELD_CATALOG.filter((f) => f.group === group);
    if (fields.length === 0) return undefined;
    return `### ${RULE_FIELD_GROUP_LABELS[group]}\n\n${renderFieldTable(fields)}`;
  }).filter((section): section is string => !!section);

  sections.push(`## Claim properties\n\n${fieldSections.join('\n\n')}`);

  sections.push(`## Service line properties

Service lines are an array, so their per-line properties are not claim properties: they are matched
and changed by the **Update service lines** / **Remove service lines** actions below, each of which
carries its own line predicate — either *all service lines* or *lines matching a property*
comparison (one property, operator, and value per predicate). A rule's condition can detect that a
matching line exists (e.g. \`cptCodes\` *contains* X, \`duplicateCptCodes\` *is present*,
\`serviceLineCount\` *is greater than* N); the action's own match is what binds *which* lines it
touches.

${renderServiceLinePropertyTable(SERVICE_LINE_PROPERTY_CATALOG)}`);

  sections.push(`## Actions

A matched branch's outcome is a list of actions, applied in order:

| Action | Description |
| --- | --- |
| Set a property (\`setField\`) | Sets one of the settable claim properties above to a new value. Setting an empty value clears the property. The change is written to the claim's working-copy resources and recorded in the claim history, attributed to the rules engine. If the property cannot be set (unknown or read-only property, invalid value, or the target resource is missing from the claim), the rule fails and the claim is held. |
| Apply a tag (\`applyTag\`) | Adds a tag to the claim (no-op if the claim already carries it). Applying the **${HOLD_TAG_NAME}** tag holds the claim: the run stops and the engine's on-success effect does not happen. |
| Update service lines (\`updateServiceLines\`) | Applies one change (an updatable service line property + value; for modifiers, a set/add/remove operation) to every line matching the action's line predicate. Zero matching lines is a no-op, not a failure — pair the action with a condition when a match must exist. An invalid value or an operation that doesn't apply to the property fails the rule and holds the claim. Changing charges recomputes the claim's billed total. |
| Remove service lines (\`removeServiceLines\`) | Removes every line matching the action's line predicate (all lines when the predicate is "all service lines"). Surviving lines are re-sequenced and the claim's billed total is recomputed. Zero matching lines is a no-op. |
| Do nothing (\`noop\`) | Explicitly does nothing. Useful as an else branch that intentionally takes no action. |

Actions after a failed action or after the **${HOLD_TAG_NAME}** tag do not run.`);

  return sections.join('\n\n') + '\n';
}
