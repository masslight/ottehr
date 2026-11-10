import Oystehr from '@oystehr/sdk';
import { Basic } from 'fhir/r4b';
import { AdHocBillingRulesRow, SERVICE_LINE_CONDITION_FIELDS } from 'utils/lib/types/adhoc/datasets/billing-rules';
import { RULES_ENGINE_TYPES, RulesEngineType } from 'utils/lib/types/data/billing/rules-engine.constants';
import {
  BillingRule,
  RuleAction,
  RuleCondition,
  RuleConditional,
  RuleOutcome,
} from 'utils/lib/types/data/billing/rules-engine.schemas';
import { containedBasicToRule } from '../rules-engine/serialization';
import { findRulesEngineList } from '../shared';

const SERVICE_LINE_FIELDS = new Set<string>(SERVICE_LINE_CONDITION_FIELDS);

interface RuleParts {
  conditionFields: Set<string>;
  actions: RuleAction[];
}

function collectCondition(condition: RuleCondition, parts: RuleParts): void {
  if (condition.type === 'field') parts.conditionFields.add(condition.field);
  if (condition.type === 'group') condition.conditions.forEach((nested) => collectCondition(nested, parts));
}

function collectOutcome(outcome: RuleOutcome | undefined, parts: RuleParts): void {
  if (outcome?.type === 'actions') parts.actions.push(...outcome.actions);
  if (outcome?.type === 'conditional') collectConditional(outcome.conditional, parts);
}

function collectConditional(conditional: RuleConditional, parts: RuleParts): void {
  conditional.branches.forEach((branch) => {
    collectCondition(branch.condition, parts);
    collectOutcome(branch.outcome, parts);
  });

  collectOutcome(conditional.otherwise, parts);
}

const serviceLineMatchProperty = (action: RuleAction): string | undefined =>
  (action.type === 'updateServiceLines' ||
    action.type === 'removeServiceLines' ||
    action.type === 'applyChargeMasterPrices') &&
  action.match.type === 'field'
    ? action.match.property
    : undefined;

export function mapRuleToAdHocRow(rule: BillingRule, engine: RulesEngineType, position: number): AdHocBillingRulesRow {
  const parts: RuleParts = { conditionFields: new Set(), actions: [] };
  collectConditional(rule.conditional, parts);
  const conditionFields = [...parts.conditionFields];
  const serviceLineConditionFields = conditionFields.filter((field) => SERVICE_LINE_FIELDS.has(field));

  const serviceLineMatchProperties = [
    ...new Set(parts.actions.map(serviceLineMatchProperty).filter((property): property is string => !!property)),
  ];

  return {
    ruleId: rule.id,
    engine,
    position,
    name: rule.name,
    description: rule.description,
    enabled: rule.enabled,
    conditionFields,
    serviceLineConditionFields,
    serviceLineMatchProperties,
    hasServiceLineConditions: serviceLineConditionFields.length > 0 || serviceLineMatchProperties.length > 0,
    actionTypes: [...new Set(parts.actions.map((action) => action.type).filter((type) => type !== 'noop'))],
  };
}

export async function fetchAdHocRuleRows(oystehr: Oystehr): Promise<AdHocBillingRulesRow[]> {
  const lists = await Promise.all(RULES_ENGINE_TYPES.map((engine) => findRulesEngineList(oystehr, engine)));

  return lists.flatMap((list, index) => {
    const engine = RULES_ENGINE_TYPES[index];
    const basicsById = new Map(
      (list?.contained ?? [])
        .filter((resource): resource is Basic => resource.resourceType === 'Basic' && !!resource.id)
        .map((basic) => [`#${basic.id}`, basic])
    );

    return (list?.entry ?? []).flatMap((entry, position) => {
      const basic = basicsById.get(entry.item?.reference ?? '');
      return basic ? [mapRuleToAdHocRow(containedBasicToRule(basic), engine, position + 1)] : [];
    });
  });
}
