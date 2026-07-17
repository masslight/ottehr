import { z } from 'zod';
import { HOLD_TAG_NAME, RULES_ENGINE_TYPES, RulesEngineType } from './rules-engine.constants';

// ---------------------------------------------------------------------------
// Rule structure
//
// A rule is metadata (name/description/enabled) plus a recursive if / else-if / else `Conditional`
// whose branches terminate in an `Outcome`. An outcome is either a list of `Action`s to take, a
// nested `Conditional` (for else-if / deeper branching), or an explicit no-op.
//
// These schemas are the single contract shared by the serializer (rule <-> FHIR Basic), the engine
// evaluator, and the billing app's rule-builder UI. Every rules engine (see RULES_ENGINE_TYPES)
// uses the same rule shape; the `engine` parameter on the CRUD schemas selects which engine's rule
// set an operation targets.
// ---------------------------------------------------------------------------

export const RulesEngineTypeSchema = z.enum(RULES_ENGINE_TYPES);

export const RULE_OPERATORS = [
  'eq',
  'neq',
  'in',
  'notIn',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'notContains',
  'exists',
  'notExists',
] as const;
export type RuleOperator = (typeof RULE_OPERATORS)[number];
export const RuleOperatorSchema = z.enum(RULE_OPERATORS);

// Operator groupings shared by the evaluator and the rule-builder UI.
export const NO_VALUE_OPERATORS: readonly RuleOperator[] = ['exists', 'notExists'];
export const MULTI_VALUE_OPERATORS: readonly RuleOperator[] = ['in', 'notIn'];
export const operatorNeedsValue = (op: RuleOperator): boolean => !NO_VALUE_OPERATORS.includes(op);
export const operatorIsMultiValue = (op: RuleOperator): boolean => MULTI_VALUE_OPERATORS.includes(op);

// Operator semantics shared by the rule-builder UI (labels) and the generated documentation
// (labels + descriptions). `dateLabel` overrides the label when the field being compared is a date.
export interface RuleOperatorMetadata {
  label: string;
  dateLabel?: string;
  description: string;
}

export const RULE_OPERATOR_METADATA: Record<RuleOperator, RuleOperatorMetadata> = {
  eq: { label: 'equals', description: 'The property exactly equals the value.' },
  neq: { label: 'does not equal', description: 'The property does not exactly equal the value.' },
  in: { label: 'is one of', description: 'The property equals one of the listed values.' },
  notIn: { label: 'is not one of', description: 'The property equals none of the listed values.' },
  gt: {
    label: 'is greater than',
    dateLabel: 'is after',
    description: 'The property is greater than the value (numerically for amounts, chronologically for dates).',
  },
  gte: {
    label: 'is at least',
    dateLabel: 'is on or after',
    description: 'The property is greater than or equal to the value.',
  },
  lt: {
    label: 'is less than',
    dateLabel: 'is before',
    description: 'The property is less than the value (numerically for amounts, chronologically for dates).',
  },
  lte: {
    label: 'is at most',
    dateLabel: 'is on or before',
    description: 'The property is less than or equal to the value.',
  },
  contains: {
    label: 'contains',
    description: 'A text property contains the value as a substring; a list property includes the value as an entry.',
  },
  notContains: { label: 'does not contain', description: 'The negation of "contains".' },
  exists: { label: 'is present', description: 'The property has a (non-empty) value on the claim.' },
  notExists: { label: 'is empty', description: 'The property is missing or empty on the claim.' },
};

export const RULE_LOGIC = ['and', 'or'] as const;
export type RuleLogic = (typeof RULE_LOGIC)[number];

// Discriminator values, named so consumers (schemas, evaluator, UI) don't sprinkle raw strings.
export const RULE_CONDITION_TYPE = { all: 'all', field: 'field', group: 'group' } as const;
export const RULE_ACTION_TYPE = {
  setField: 'setField',
  applyTag: 'applyTag',
  addServiceLine: 'addServiceLine',
  updateServiceLines: 'updateServiceLines',
  removeServiceLines: 'removeServiceLines',
  noop: 'noop',
} as const;
export const RULE_OUTCOME_TYPE = { actions: 'actions', conditional: 'conditional', noop: 'noop' } as const;

// A condition's comparison value: a scalar (eq/neq/contains), a list (in/notIn), or absent
// (exists/notExists). The evaluator coerces per operator.
const ConditionValueSchema = z.union([z.string(), z.array(z.string())]);
export type RuleConditionValue = z.output<typeof ConditionValueSchema>;

// --- Condition (recursive: a `group` nests conditions) ---
export type RuleCondition =
  | { type: 'all' }
  | { type: 'field'; field: string; operator: RuleOperator; value?: RuleConditionValue }
  | { type: 'group'; logic: RuleLogic; conditions: RuleCondition[] };

export const RuleConditionSchema: z.ZodType<RuleCondition> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal(RULE_CONDITION_TYPE.all) }),
    z.object({
      type: z.literal(RULE_CONDITION_TYPE.field),
      field: z.string().min(1),
      operator: RuleOperatorSchema,
      value: ConditionValueSchema.optional(),
    }),
    z.object({
      type: z.literal(RULE_CONDITION_TYPE.group),
      logic: z.enum(RULE_LOGIC),
      conditions: z.array(RuleConditionSchema),
    }),
  ])
);

// --- Service line match (the line predicate carried by the service-line actions) ---
//
// Service lines are an array, so the actions that touch them carry their own per-line predicate
// ("update lines where cptCode = X") instead of relying on the rule's condition — a condition can
// detect that a matching line exists, but only the action's match binds *which* lines to change.
// Shaped as a discriminated union so a `group` variant (AND/OR across line properties) can be added
// later without a breaking change.
export const SERVICE_LINE_MATCH_TYPE = { all: 'all', field: 'field' } as const;

export type ServiceLineMatch =
  | { type: 'all' }
  | { type: 'field'; property: string; operator: RuleOperator; value?: RuleConditionValue };

export const ServiceLineMatchSchema: z.ZodType<ServiceLineMatch> = z.discriminatedUnion('type', [
  z.object({ type: z.literal(SERVICE_LINE_MATCH_TYPE.all) }),
  z.object({
    type: z.literal(SERVICE_LINE_MATCH_TYPE.field),
    property: z.string().min(1),
    operator: RuleOperatorSchema,
    value: ConditionValueSchema.optional(),
  }),
]);

// How an updateServiceLines action applies its value: `set` replaces the property (the default);
// `add`/`remove` edit one entry of a list-valued property (modifiers).
export const SERVICE_LINE_SET_OPERATIONS = ['set', 'add', 'remove'] as const;
export type ServiceLineSetOperation = (typeof SERVICE_LINE_SET_OPERATIONS)[number];

// The fields of a new service line added by the addServiceLine action. All values are strings (the
// rule value model) and are validated at save time (format) and apply time (claim-dependent checks);
// blank optional fields fall back to the same defaults the claim editor uses — see
// ADD_SERVICE_LINE_FIELDS in the field catalog, which documents each field and drives the UI.
export const AddServiceLineInputSchema = z.object({
  cptCode: z.string().min(1),
  // Comma-separated modifier codes.
  modifiers: z.string().optional(),
  units: z.string().optional(),
  charges: z.string().min(1),
  placeOfService: z.string().optional(),
  serviceDate: z.string().optional(),
  // Comma-separated 1-based pointers into the claim's diagnosis list.
  diagnosisPointers: z.string().optional(),
});
export type AddServiceLineInput = z.output<typeof AddServiceLineInputSchema>;

// --- Action ---
export type RuleAction =
  | { type: 'setField'; field: string; value: string | null }
  | { type: 'applyTag'; tag: string }
  | { type: 'addServiceLine'; line: AddServiceLineInput }
  | {
      type: 'updateServiceLines';
      match: ServiceLineMatch;
      set: { property: string; value: string; operation?: ServiceLineSetOperation };
    }
  | { type: 'removeServiceLines'; match: ServiceLineMatch }
  | { type: 'noop' };

// Tags are free text in the UI, but the engine halts on an exact HOLD_TAG_NAME match — so
// canonicalize case/whitespace variants of the Hold tag here, at the validation boundary.
const tagNameSchema = z
  .string()
  .trim()
  .min(1)
  .transform((tag) => (tag.toLowerCase() === HOLD_TAG_NAME.toLowerCase() ? HOLD_TAG_NAME : tag));

export const RuleActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal(RULE_ACTION_TYPE.setField), field: z.string().min(1), value: z.string().nullable() }),
  z.object({ type: z.literal(RULE_ACTION_TYPE.applyTag), tag: tagNameSchema }),
  z.object({ type: z.literal(RULE_ACTION_TYPE.addServiceLine), line: AddServiceLineInputSchema }),
  z.object({
    type: z.literal(RULE_ACTION_TYPE.updateServiceLines),
    match: ServiceLineMatchSchema,
    set: z.object({
      property: z.string().min(1),
      // Empty is meaningful only for list-valued properties ("clear the modifiers"); scalar-property
      // writers reject it at apply time and the engine holds the claim.
      value: z.string(),
      operation: z.enum(SERVICE_LINE_SET_OPERATIONS).optional(),
    }),
  }),
  z.object({ type: z.literal(RULE_ACTION_TYPE.removeServiceLines), match: ServiceLineMatchSchema }),
  z.object({ type: z.literal(RULE_ACTION_TYPE.noop) }),
]);

// --- Outcome / Branch / Conditional (mutually recursive) ---
export type RuleOutcome =
  | { type: 'actions'; actions: RuleAction[] }
  | { type: 'conditional'; conditional: RuleConditional }
  | { type: 'noop' };

export interface RuleBranch {
  condition: RuleCondition;
  outcome: RuleOutcome;
}

export interface RuleConditional {
  branches: RuleBranch[];
  otherwise?: RuleOutcome;
}

export const RuleOutcomeSchema: z.ZodType<RuleOutcome> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal(RULE_OUTCOME_TYPE.actions), actions: z.array(RuleActionSchema) }),
    z.object({ type: z.literal(RULE_OUTCOME_TYPE.conditional), conditional: RuleConditionalSchema }),
    z.object({ type: z.literal(RULE_OUTCOME_TYPE.noop) }),
  ])
);

export const RuleBranchSchema: z.ZodType<RuleBranch> = z.lazy(() =>
  z.object({
    condition: RuleConditionSchema,
    outcome: RuleOutcomeSchema,
  })
);

export const RuleConditionalSchema: z.ZodType<RuleConditional> = z.lazy(() =>
  z.object({
    branches: z.array(RuleBranchSchema),
    otherwise: RuleOutcomeSchema.optional(),
  })
);

export const BillingRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  enabled: z.boolean().default(true),
  conditional: RuleConditionalSchema,
});
export type BillingRule = z.output<typeof BillingRuleSchema>;

// Save input variant: a new rule arrives without an id — save-billing-rules assigns one server-side,
// so the backend owns rule identifiers.
export const BillingRuleInputSchema = BillingRuleSchema.extend({
  id: z.string().min(1).optional(),
});
export type BillingRuleInput = z.output<typeof BillingRuleInputSchema>;

// --- CRUD API contract (save-billing-rules / get-billing-rules) ---
//
// Every operation names the engine whose rule set it targets.

export const GetBillingRulesInputSchema = z.object({ engine: RulesEngineTypeSchema });
export type GetBillingRulesInput = z.output<typeof GetBillingRulesInputSchema>;

// The whole ordered rule set is saved at once (each engine's rules live in a single FHIR List), so
// create, edit, reorder, and delete are all expressed as "save this full ordered array".
export const SaveBillingRulesInputSchema = z
  .object({
    engine: RulesEngineTypeSchema,
    rules: z.array(BillingRuleInputSchema),
    // Optimistic-locking guard: the List versionId the client last read. When provided, the save is
    // rejected if the rules List changed in the meantime.
    expectedVersionId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    data.rules.forEach((rule, index) => {
      if (rule.id == null) return; // new rules get their ids assigned server-side
      if (seen.has(rule.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rules', index, 'id'],
          message: `Duplicate rule id "${rule.id}"`,
        });
      }
      seen.add(rule.id);
    });
  });
export type SaveBillingRulesInput = z.output<typeof SaveBillingRulesInputSchema>;

export interface BillingRulesResponse {
  rules: BillingRule[];
  // List.meta.versionId, echoed so the client can pass it back as expectedVersionId on the next save.
  versionId?: string;
}

export const MAX_RUN_RULES_ENGINE_CLAIMS = 20;

// run-billing-rules-engine: manually kick off the rules engine for one or more existing claims
// (claim detail Submit claim / Prepare for invoice, claims list bulk submit). The backend picks each
// claim's engine from its AR stage and enqueues that engine's Task; a Subscription then runs it
// asynchronously.
export const RunBillingRulesEngineInputSchema = z.object({
  claimIds: z.array(z.string().min(1)).min(1).max(MAX_RUN_RULES_ENGINE_CLAIMS),
});
export type RunBillingRulesEngineInput = z.output<typeof RunBillingRulesEngineInputSchema>;

export interface RunBillingRulesEngineResult {
  claimId: string;
  taskId: string;
  engine: RulesEngineType;
}

export interface RunBillingRulesEngineResponse {
  results: RunBillingRulesEngineResult[];
}
