import { RULES_ENGINE_TYPES, RULES_ENGINES } from './rules-engine.constants';
import {
  ADD_SERVICE_LINE_FIELDS,
  DATE_SOURCE_CATALOG,
  POS_SOURCE_CATALOG,
  RULE_FIELD_CATALOG,
  RULE_FIELD_GROUP_LABELS,
  RULE_FIELD_GROUPS,
  RULE_VALUE_FORMATS,
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
import { HOLD_TAG_NAME } from './system-tags';

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
  provider: 'provider reference',
  facility: 'facility reference',
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

// Allowed-values phrase for a def with options: the docs note when present (states and POS codes
// would be unreadable enumerated in a table cell), otherwise the enumerated option list.
const allowedValues = (field: Pick<RuleFieldDef, 'options' | 'optionsDocNote'>): string => {
  if (field.optionsDocNote) return field.optionsDocNote;
  if (!field.options) return '';
  return field.options
    .map((option) => (option.label === option.value ? `\`${option.value}\`` : `\`${option.value}\` (${option.label})`))
    .join(', ');
};

// The validation/constraint suffix of a def's description: allowed values, format hint, and the
// cannot-be-cleared note — everything save-time validation and the engine writers enforce.
const constraintNotes = (
  def: Pick<RuleFieldDef, 'options' | 'optionsDocNote' | 'format' | 'requiredOnSet'>
): string => {
  const notes: string[] = [];
  const values = allowedValues(def);
  if (values) notes.push(` Allowed values: ${values}.`);
  if (def.format && RULE_VALUE_FORMATS[def.format].validate) {
    notes.push(` Format: ${RULE_VALUE_FORMATS[def.format].hint}.`);
  }
  if (def.requiredOnSet) notes.push(' Cannot be cleared — setting it requires a value.');
  return notes.join('');
};

function renderFieldTable(fields: RuleFieldDef[]): string {
  const lines = [
    '| Property | ID | Type | Operators | Settable | Description |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const field of fields) {
    const operators = field.operators.map((op) => operatorLabel(field.valueType, op)).join(', ');
    const description = `${field.description}${constraintNotes(field)}`;
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
    const description = `${property.description}${constraintNotes(property)}`;
    lines.push(
      `| ${cell(property.label)} | \`${property.id}\` | ${VALUE_TYPE_LABELS[property.valueType]} | ${cell(
        operators
      )} | ${property.settable ? 'yes' : 'no'} | ${cell(description)} |`
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

function renderAddServiceLineFieldTable(): string {
  const lines = ['| Field | Type | Required | When left blank |', '| --- | --- | --- | --- |'];
  for (const field of ADD_SERVICE_LINE_FIELDS) {
    lines.push(
      `| ${cell(field.label)} (\`${field.id}\`) | ${VALUE_TYPE_LABELS[field.valueType]} | ${
        field.required ? 'yes' : 'no'
      } | ${cell(field.whenBlank ?? '—')} |`
    );
  }
  return lines.join('\n');
}

function renderDateSourceTable(): string {
  const lines = ['| Source | Description |', '| --- | --- |'];
  for (const option of DATE_SOURCE_CATALOG) lines.push(`| ${cell(option.label)} | ${cell(option.description)} |`);
  return lines.join('\n');
}

function renderPosSourceTable(): string {
  const lines = ['| Source | Description |', '| --- | --- |'];
  for (const option of POS_SOURCE_CATALOG) lines.push(`| ${cell(option.label)} | ${cell(option.description)} |`);
  return lines.join('\n');
}

function renderEnginesTable(): string {
  const lines = ['| Rules | Run automatically | When every rule passes |', '| --- | --- | --- |'];
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
     This document is rendered from the billing rules field catalog and schemas in
     packages/utils/lib/types/data/billing/. To update it, change those sources and run
     \`npm run docs:billing-rules\`. A unit test fails when this file is out of date. -->

# Billing rules

The billing app runs several independent sets of rules. Each set has its own ordered rules, its own
automatic trigger, and its own on-success effect:

${renderEnginesTable()}

Each set of rules runs automatically only when a claim is created in its AR stage, and on demand
from the claim detail page. All of the sets share the same rule shape and the semantics below —
everything in this reference applies to each of them.

Rules run top to bottom; each rule is an **if / else-if / else** conditional whose branches end in a
list of **actions**. When every rule has run without holding the claim, the on-success effect above
is performed.

- A rule that applies the **${HOLD_TAG_NAME}** tag stops the run and holds the claim for manual
  review; the on-success effect does not happen.
- An action that cannot be applied (for example, setting a property whose target is missing from the
  claim) fails the rule: the run stops, the **${HOLD_TAG_NAME}** tag is applied, and the claim never
  proceeds with a silently skipped change.
- Disabled rules are skipped.

This reference lists every supported condition property, operator, and action. It is generated from
the same catalog that drives the rule builder and the rule runs, so it always matches what the rules
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
| Set a property (\`setField\`) | Sets one of the settable claim properties above to a new value. Setting an empty value clears the property. The change is written to the claim's working-copy resources and recorded in the claim history, attributed to the specific rule that made it (linked from the history view). If the property cannot be set (unknown or read-only property, invalid value, or the target resource is missing from the claim), the rule fails and the claim is held. |
| Apply a tag (\`applyTag\`) | Adds a tag to the claim (no-op if the claim already carries it). Applying the **${HOLD_TAG_NAME}** tag holds the claim: the run stops and the on-success effect does not happen. |
| Add a service line (\`addServiceLine\`) | Appends a new service line built from the fields below and recomputes the claim's billed total. Blank optional fields use the claim editor's defaults, and the new line is tied to the claim's rendering provider when one is set. The service date can be a literal date or one of the derived sources below. An invalid field value fails the rule and holds the claim. |
| Update service lines (\`updateServiceLines\`) | Applies one change (an updatable service line property + value; for modifiers, a set/add/remove operation) to every line matching the action's line predicate. When updating the service date, the value can be a literal date or one of the derived sources below; when updating the place of service, the value can be a literal CMS code or copied from the claim's facility (see Place of service sources). Zero matching lines is a no-op, not a failure — pair the action with a condition when a match must exist. An invalid value or an operation that doesn't apply to the property fails the rule and holds the claim. Changing charges recomputes the claim's billed total. |
| Remove service lines (\`removeServiceLines\`) | Removes every line matching the action's line predicate (all lines when the predicate is "all service lines"). Surviving lines are re-sequenced and the claim's billed total is recomputed. Zero matching lines is a no-op. |
| Apply charge master prices (\`applyChargeMasterPrices\`) | Re-prices every line matching the action's line predicate from the best applicable charge master: the active charge master designated as the default for the claim's billing type (insurance when the claim carries a real coverage, self-pay otherwise) whose effective date is the most recent on or before the claim's date of service. Each matched line's charges are set from the entry for its CPT code — an entry with a matching modifier for lines with modifiers, a modifier-less entry otherwise. A matched line the charge master has no entry for (or that has no CPT code) keeps its existing charges. The claim's billed total is recomputed when any line was re-priced. Zero matching lines is a no-op. This action never fails the rule or holds the claim — when no charge master applies (or the claim has no date of service to select one by), no lines are changed. Add a separate rule to hold claims whose lines are missing a price. |
| Do nothing (\`noop\`) | Explicitly does nothing. Useful as an else branch that intentionally takes no action. |

### "Add a service line" fields

${renderAddServiceLineFieldTable()}

### Service date sources

The service date on "Add a service line", and on "Update service lines" when updating the
\`serviceDate\` property, can come from one of:

${renderDateSourceTable()}

"Exact date" is the default. On "Add a service line", leaving it blank is equivalent to "First
service line's date" (kept for rules saved before this option existed). Service line **matching**
always compares against a literal date.

### Place of service sources

The place of service on "Update service lines", when updating the \`placeOfService\` property, can
come from one of:

${renderPosSourceTable()}

"Exact code" is the default. Service line **matching** always compares against a literal code.

Actions after a failed action or after the **${HOLD_TAG_NAME}** tag do not run.`);

  return sections.join('\n\n') + '\n';
}
