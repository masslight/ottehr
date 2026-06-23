import { z } from 'zod';

// ---------------------------------------------------------------------------
// Rule structure
//
// A rule is metadata (name/description/enabled) plus a recursive if / else-if / else `Conditional`
// whose branches terminate in an `Outcome`. An outcome is either a list of `Action`s to take, a
// nested `Conditional` (for else-if / deeper branching), or an explicit no-op.
//
// These schemas are the single contract shared by the serializer (rule <-> FHIR Basic), the engine
// evaluator, and the billing app's rule-builder UI.
// ---------------------------------------------------------------------------

export const RULE_OPERATORS = ['eq', 'neq', 'in', 'notIn', 'contains', 'notContains', 'exists', 'notExists'] as const;
export type RuleOperator = (typeof RULE_OPERATORS)[number];
export const RuleOperatorSchema = z.enum(RULE_OPERATORS);

export const RULE_LOGIC = ['and', 'or'] as const;
export type RuleLogic = (typeof RULE_LOGIC)[number];

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
    z.object({ type: z.literal('all') }),
    z.object({
      type: z.literal('field'),
      field: z.string().min(1),
      operator: RuleOperatorSchema,
      value: ConditionValueSchema.optional(),
    }),
    z.object({
      type: z.literal('group'),
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

export const RuleActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('setField'), field: z.string().min(1), value: z.string().nullable() }),
  z.object({ type: z.literal('applyTag'), tag: z.string().min(1) }),
  z.object({ type: z.literal('noop') }),
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
    z.object({ type: z.literal('actions'), actions: z.array(RuleActionSchema) }),
    z.object({ type: z.literal('conditional'), conditional: RuleConditionalSchema }),
    z.object({ type: z.literal('noop') }),
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

export const PreSubmissionRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  enabled: z.boolean().default(true),
  conditional: RuleConditionalSchema,
});
export type PreSubmissionRule = z.output<typeof PreSubmissionRuleSchema>;
