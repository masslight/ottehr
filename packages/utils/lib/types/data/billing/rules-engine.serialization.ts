import { Basic, Extension, List, Task } from 'fhir/r4b';
import {
  PRESUBMISSION_RULE_CODE,
  PRESUBMISSION_RULES_LIST_CODE,
  PRESUBMISSION_RULES_LIST_TITLE,
  PRESUBMISSION_RULES_TASK_CODE,
  PRESUBMISSION_RULES_TASK_SYSTEM,
  RULE_DEFINITION_EXTENSION_URL,
  RULE_DESCRIPTION_EXTENSION_URL,
  RULE_ENABLED_EXTENSION_URL,
  RULE_NAME_EXTENSION_URL,
  RULES_ENGINE_TAG_SYSTEM,
} from './rules-engine.constants';
import {
  PreSubmissionRule,
  PreSubmissionRuleSchema,
  RuleConditional,
  RuleConditionalSchema,
} from './rules-engine.schemas';

// ---------------------------------------------------------------------------
// Serialization between the rule domain model and FHIR.
//
// The rules live as an ordered List whose entries reference Basic resources contained within the
// List (one Basic per rule). The List.entry order is the order the rules run in. Each rule's
// conditional/action tree is stored as a JSON string on a Basic extension; name/description/enabled
// are discrete extensions for readability.
// ---------------------------------------------------------------------------

const LIST_ORDER_SYSTEM = 'http://terminology.hl7.org/CodeSystem/list-order';

export function ruleToContainedBasic(rule: PreSubmissionRule): Basic {
  return {
    resourceType: 'Basic',
    id: rule.id,
    code: { coding: [{ system: RULES_ENGINE_TAG_SYSTEM, code: PRESUBMISSION_RULE_CODE }], text: rule.name },
    extension: [
      { url: RULE_NAME_EXTENSION_URL, valueString: rule.name },
      ...(rule.description ? [{ url: RULE_DESCRIPTION_EXTENSION_URL, valueString: rule.description }] : []),
      { url: RULE_ENABLED_EXTENSION_URL, valueBoolean: rule.enabled },
      { url: RULE_DEFINITION_EXTENSION_URL, valueString: JSON.stringify(rule.conditional) },
    ],
  };
}

// Utils has no Sentry access; callers that do (the zambdas) pass `onMalformed` to report the error.
export type MalformedRuleHandler = (error: unknown, context: { ruleId: string; ruleName: string }) => void;

export function containedBasicToRule(basic: Basic, onMalformed?: MalformedRuleHandler): PreSubmissionRule {
  const ext = (url: string): Extension | undefined => basic.extension?.find((e) => e.url === url);
  const name = ext(RULE_NAME_EXTENSION_URL)?.valueString ?? basic.code?.text ?? '';
  const description = ext(RULE_DESCRIPTION_EXTENSION_URL)?.valueString ?? '';
  const enabled = ext(RULE_ENABLED_EXTENSION_URL)?.valueBoolean ?? true;
  const raw = ext(RULE_DEFINITION_EXTENSION_URL)?.valueString;
  try {
    const conditional: RuleConditional = raw ? RuleConditionalSchema.parse(JSON.parse(raw)) : { branches: [] };
    return PreSubmissionRuleSchema.parse({ id: basic.id ?? '', name, description, enabled, conditional });
  } catch (error) {
    // One unparseable rule must not take down the whole list (the admin screen and every engine run
    // read it). Surface it as a disabled no-op — not a skip, which the next full-list save would
    // silently delete.
    console.error(`[rules-engine] unparseable rule "${name}" (Basic/${basic.id}):`, error);
    onMalformed?.(error, { ruleId: basic.id ?? '', ruleName: name });
    return {
      id: basic.id ?? '',
      name: name || 'Unparseable rule',
      description,
      enabled: false,
      conditional: { branches: [] },
    };
  }
}

export function rulesToList(rules: PreSubmissionRule[]): List {
  return {
    resourceType: 'List',
    status: 'current',
    mode: 'working',
    title: PRESUBMISSION_RULES_LIST_TITLE,
    orderedBy: { coding: [{ system: LIST_ORDER_SYSTEM, code: 'user' }] },
    meta: { tag: [{ system: RULES_ENGINE_TAG_SYSTEM, code: PRESUBMISSION_RULES_LIST_CODE }] },
    contained: rules.map(ruleToContainedBasic),
    entry: rules.map((r) => ({ item: { reference: `#${r.id}` } })),
  };
}

export function listToRules(list: List, onMalformed?: MalformedRuleHandler): PreSubmissionRule[] {
  const containedById = new Map<string, Basic>();
  for (const resource of list.contained ?? []) {
    if (resource.resourceType === 'Basic' && resource.id) containedById.set(resource.id, resource);
  }
  const rules: PreSubmissionRule[] = [];
  for (const entry of list.entry ?? []) {
    const reference = entry.item?.reference;
    if (!reference || !reference.startsWith('#')) continue;
    const basic = containedById.get(reference.slice(1));
    if (basic) rules.push(containedBasicToRule(basic, onMalformed));
  }
  return rules;
}

export function isPresubmissionRulesList(list: Pick<List, 'meta'>): boolean {
  return (list.meta?.tag ?? []).some(
    (t) => t.system === RULES_ENGINE_TAG_SYSTEM && t.code === PRESUBMISSION_RULES_LIST_CODE
  );
}

// The Task whose creation kicks off the engine for a freshly created working-copy claim. A
// Subscription matches `status=requested` + this code and invokes the sub-presubmission-rules-engine
// zambda, which marks the Task completed/failed.
export function buildRulesEngineKickoffTask(claimId: string): Task {
  return {
    resourceType: 'Task',
    status: 'requested',
    intent: 'order',
    code: { coding: [{ system: PRESUBMISSION_RULES_TASK_SYSTEM, code: PRESUBMISSION_RULES_TASK_CODE }] },
    focus: { reference: `Claim/${claimId}` },
  };
}
