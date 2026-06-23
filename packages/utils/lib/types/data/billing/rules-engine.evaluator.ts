import { CLAIM_TAG_SYSTEM } from './billing.constants';
import { HOLD_TAG_NAME } from './rules-engine.constants';
import { readField, RulesEngineClaimModel, writeField } from './rules-engine.field-catalog';
import {
  PreSubmissionRule,
  RuleAction,
  RuleCondition,
  RuleConditional,
  RuleConditionValue,
  RuleOperator,
  RuleOutcome,
} from './rules-engine.schemas';

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
    case 'all':
      return true;
    case 'group': {
      const results = condition.conditions.map((c) => evaluateCondition(c, model));
      return condition.logic === 'and' ? results.every(Boolean) : results.some(Boolean);
    }
    case 'field':
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
    case 'actions':
      return outcome.actions;
    case 'conditional':
      return resolveConditionalActions(outcome.conditional, model);
    case 'noop':
      return [];
    default:
      return [];
  }
}

export const isHoldAction = (action: RuleAction): boolean => action.type === 'applyTag' && action.tag === HOLD_TAG_NAME;

// Mutate the model by applying a single action. setField delegates to the field-catalog writer;
// applyTag adds the tag to Claim.meta.tag (deduped); noop does nothing.
export const applyAction = (action: RuleAction, model: RulesEngineClaimModel): void => {
  switch (action.type) {
    case 'noop':
      return;
    case 'setField':
      writeField(model, action.field, action.value);
      return;
    case 'applyTag': {
      const { claim } = model;
      claim.meta = claim.meta ?? {};
      const tags = claim.meta.tag ?? [];
      if (!tags.some((t) => t.system === CLAIM_TAG_SYSTEM && t.code === action.tag)) {
        tags.push({ system: CLAIM_TAG_SYSTEM, code: action.tag });
      }
      claim.meta.tag = tags;
      return;
    }
  }
};

export interface RuleExecutionResult {
  // Actions that were applied (in order). Stops at the Hold action when held.
  appliedActions: RuleAction[];
  held: boolean;
}

// Evaluate one rule against the (mutable) model and apply the matched branch's actions in order.
// Returns `held: true` as soon as an action applies the Hold tag — the engine then halts the whole
// run. Disabled rules are skipped.
export const executeRule = (rule: PreSubmissionRule, model: RulesEngineClaimModel): RuleExecutionResult => {
  if (!rule.enabled) return { appliedActions: [], held: false };
  const actions = resolveConditionalActions(rule.conditional, model);
  const appliedActions: RuleAction[] = [];
  for (const action of actions) {
    applyAction(action, model);
    appliedActions.push(action);
    if (isHoldAction(action)) return { appliedActions, held: true };
  }
  return { appliedActions, held: false };
};
