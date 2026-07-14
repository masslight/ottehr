import { z } from 'zod';
import { DEFAULT_RULES_ENGINE, HOLD_TAG_NAME, RULES_ENGINE_TYPES, RulesEngineType } from './rules-engine.constants';

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

export const RULE_OPERATORS = ['eq', 'neq', 'in', 'notIn', 'contains', 'notContains', 'exists', 'notExists'] as const;
export type RuleOperator = (typeof RULE_OPERATORS)[number];
export const RuleOperatorSchema = z.enum(RULE_OPERATORS);

// Operator groupings shared by the evaluator and the rule-builder UI.
export const NO_VALUE_OPERATORS: readonly RuleOperator[] = ['exists', 'notExists'];
export const MULTI_VALUE_OPERATORS: readonly RuleOperator[] = ['in', 'notIn'];
export const operatorNeedsValue = (op: RuleOperator): boolean => !NO_VALUE_OPERATORS.includes(op);
export const operatorIsMultiValue = (op: RuleOperator): boolean => MULTI_VALUE_OPERATORS.includes(op);

export const RULE_LOGIC = ['and', 'or'] as const;
export type RuleLogic = (typeof RULE_LOGIC)[number];

// Discriminator values, named so consumers (schemas, evaluator, UI) don't sprinkle raw strings.
export const RULE_CONDITION_TYPE = { all: 'all', field: 'field', group: 'group' } as const;
export const RULE_ACTION_TYPE = { setField: 'setField', applyTag: 'applyTag', noop: 'noop' } as const;
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

// --- Action ---
export type RuleAction =
  | { type: 'setField'; field: string; value: string | null }
  | { type: 'applyTag'; tag: string }
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

// The engine whose rule set an operation targets. Optional for callers (older clients predate the
// multi-engine split), defaulting to the original Claim Submission engine.
const engineField = RulesEngineTypeSchema.default(DEFAULT_RULES_ENGINE);

export const GetBillingRulesInputSchema = z.object({ engine: engineField });
export type GetBillingRulesInput = z.output<typeof GetBillingRulesInputSchema>;

// The whole ordered rule set is saved at once (each engine's rules live in a single FHIR List), so
// create, edit, reorder, and delete are all expressed as "save this full ordered array".
export const SaveBillingRulesInputSchema = z
  .object({
    engine: engineField,
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

// run-billing-rules-engine: manually kick off the rules engine for an existing claim. The backend
// picks the engine from the claim's AR stage (Submit claim / Prepare for invoice both land here) and
// enqueues that engine's Task; a Subscription then runs it asynchronously.
export const RunBillingRulesEngineInputSchema = z.object({ claimId: z.string().min(1) });
export type RunBillingRulesEngineInput = z.output<typeof RunBillingRulesEngineInputSchema>;

export interface RunBillingRulesEngineResponse {
  taskId: string;
  engine: RulesEngineType;
}
