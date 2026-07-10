import {
  CLAIM_TAG_SYSTEM,
  HOLD_TAG_NAME,
  PreSubmissionRule,
  resourceHasTag,
  RULE_ACTION_TYPE,
  RULE_CONDITION_TYPE,
  RULE_OUTCOME_TYPE,
  RuleAction,
  RuleCondition,
  RuleConditional,
  RuleConditionValue,
  RuleOperator,
  RuleOutcome,
} from 'utils';
import { readField, RulesEngineClaimModel, writeField } from './claim-model';

// ---------------------------------------------------------------------------
// Pure evaluator
//
// Everything here is a pure function over a RulesEngineClaimModel (no IO). The engine zambda assembles
// the model, calls executeRule for each rule in order, and halts the run when one reports `held`.
// ---------------------------------------------------------------------------

const asArray = (v?: RuleConditionValue): string[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

const valueExists = (actual: string | string[] | undefined): boolean => {
  if (actual == null) return false;
  if (Array.isArray(actual)) return actual.length > 0;
  return actual !== '';
};

const asScalar = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? undefined : v ?? undefined;

export const evaluateOperator = (
  operator: RuleOperator,
  actual: string | string[] | undefined,
  expected?: RuleConditionValue
): boolean => {
  const expectedScalar = Array.isArray(expected) ? expected[0] : expected;

  const equals = (): boolean => {
    const a = asScalar(actual);
    return a != null && expectedScalar != null && a === expectedScalar;
  };
  const includedIn = (): boolean => {
    const a = asScalar(actual);
    return a != null && asArray(expected).includes(a);
  };
  const contains = (): boolean => {
    if (expectedScalar == null) return false;
    if (Array.isArray(actual)) return actual.includes(expectedScalar);
    return typeof actual === 'string' && actual.includes(expectedScalar);
  };

  switch (operator) {
    case 'exists':
      return valueExists(actual);
    case 'notExists':
      return !valueExists(actual);
    case 'eq':
      return equals();
    case 'neq':
      return !equals();
    case 'in':
      return includedIn();
    case 'notIn':
      return !includedIn();
    case 'contains':
      return contains();
    case 'notContains':
      return !contains();
    default:
      return false;
  }
};

export function evaluateCondition(condition: RuleCondition, model: RulesEngineClaimModel): boolean {
  switch (condition.type) {
    case RULE_CONDITION_TYPE.all:
      return true;
    case RULE_CONDITION_TYPE.group: {
      const results = condition.conditions.map((c) => evaluateCondition(c, model));
      return condition.logic === 'and' ? results.every(Boolean) : results.some(Boolean);
    }
    case RULE_CONDITION_TYPE.field:
      return evaluateOperator(condition.operator, readField(model, condition.field), condition.value);
    default:
      return false;
  }
}

// Walk a conditional top-to-bottom; the first branch whose condition matches wins. Its outcome is
// resolved to a terminal list of actions (recursing through nested conditionals). Falls back to
// `otherwise` when no branch matches, or to [] (do nothing) when there is no else.
export function resolveConditionalActions(conditional: RuleConditional, model: RulesEngineClaimModel): RuleAction[] {
  for (const branch of conditional.branches) {
    if (evaluateCondition(branch.condition, model)) {
      return resolveOutcomeActions(branch.outcome, model);
    }
  }
  if (conditional.otherwise) return resolveOutcomeActions(conditional.otherwise, model);
  return [];
}

export function resolveOutcomeActions(outcome: RuleOutcome, model: RulesEngineClaimModel): RuleAction[] {
  switch (outcome.type) {
    case RULE_OUTCOME_TYPE.actions:
      return outcome.actions;
    case RULE_OUTCOME_TYPE.conditional:
      return resolveConditionalActions(outcome.conditional, model);
    case RULE_OUTCOME_TYPE.noop:
      return [];
    default:
      return [];
  }
}

export const isHoldAction = (action: RuleAction): boolean =>
  action.type === RULE_ACTION_TYPE.applyTag && action.tag === HOLD_TAG_NAME;

// Mutate the model by applying a single action. setField delegates to the claim-model writer;
// applyTag adds the tag to Claim.meta.tag (deduped); noop does nothing. Returns an error message
// when the action could not be applied — the engine holds the claim rather than submit it with a
// silently skipped change.
export const applyAction = (action: RuleAction, model: RulesEngineClaimModel): string | undefined => {
  switch (action.type) {
    case RULE_ACTION_TYPE.noop:
      return undefined;
    case RULE_ACTION_TYPE.setField:
      return writeField(model, action.field, action.value)
        ? undefined
        : `could not set "${action.field}" — the field is unknown or read-only, or the target is missing from this claim`;
    case RULE_ACTION_TYPE.applyTag: {
      const { claim } = model;
      if (resourceHasTag(claim, { system: CLAIM_TAG_SYSTEM, code: action.tag })) return undefined;
      claim.meta = claim.meta ?? {};
      claim.meta.tag = [...(claim.meta.tag ?? []), { system: CLAIM_TAG_SYSTEM, code: action.tag }];
      return undefined;
    }
  }
};

export interface RuleExecutionResult {
  // Actions that were applied (in order). Stops at the Hold action when held, or at a failed action.
  appliedActions: RuleAction[];
  held: boolean;
  // Set when an action could not be applied; the run stops at that action.
  error?: string;
}

// Evaluate one rule against the (mutable) model and apply the matched branch's actions in order.
// Returns `held: true` as soon as an action applies the Hold tag — the engine then halts the whole
// run — and stops with `error` when an action cannot be applied. Disabled rules are skipped.
export const executeRule = (rule: PreSubmissionRule, model: RulesEngineClaimModel): RuleExecutionResult => {
  if (!rule.enabled) return { appliedActions: [], held: false };
  const actions = resolveConditionalActions(rule.conditional, model);
  const appliedActions: RuleAction[] = [];
  for (const action of actions) {
    const error = applyAction(action, model);
    if (error) return { appliedActions, held: false, error };
    appliedActions.push(action);
    if (isHoldAction(action)) return { appliedActions, held: true };
  }
  return { appliedActions, held: false };
};
