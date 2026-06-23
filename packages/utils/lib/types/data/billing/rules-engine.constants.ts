import { ottehrCodeSystemUrl, ottehrExtensionUrl } from '../../../fhir/systemUrls';

// The pre-submission rules engine stores its rules as an ordered FHIR List (a singleton per
// environment) whose entries reference Basic resources contained within the List — one Basic per
// rule. The List.entry order is the order the rules run in. The rules never stand alone outside the
// List.

// meta.tag on the singleton List, and the code on each contained Basic rule.
export const RULES_ENGINE_TAG_SYSTEM = 'https://fhir.ottehr.com/billing/rules-engine';
export const PRESUBMISSION_RULES_LIST_CODE = 'presubmission-rules-list';
export const PRESUBMISSION_RULE_CODE = 'presubmission-rule';
export const PRESUBMISSION_RULES_LIST_TITLE = 'Pre-submission rules engine';

// Extensions on each rule's contained Basic. name/description/enabled are stored as discrete
// extensions for FHIR readability; the conditional/action tree is stored as a JSON string in the
// definition extension (validated by RuleConditionalSchema on read).
export const RULE_NAME_EXTENSION_URL = ottehrExtensionUrl('presubmission-rule-name');
export const RULE_DESCRIPTION_EXTENSION_URL = ottehrExtensionUrl('presubmission-rule-description');
export const RULE_ENABLED_EXTENSION_URL = ottehrExtensionUrl('presubmission-rule-enabled');
export const RULE_DEFINITION_EXTENSION_URL = ottehrExtensionUrl('presubmission-rule-definition');

// The FHIR Task that kicks off the engine. A working-copy claim's creation enqueues a Task with this
// code (status `requested`); a Subscription invokes the sub-presubmission-rules-engine zambda.
export const PRESUBMISSION_RULES_TASK_SYSTEM = ottehrCodeSystemUrl('billing-rules-engine');
export const PRESUBMISSION_RULES_TASK_CODE = 'run-presubmission-rules';

// The well-known tag whose application by a rule terminates the engine and holds the claim from
// submission. It is a system tag (seeded as a Basic tag definition) so it appears in the Tags screen.
export const HOLD_TAG_NAME = 'Hold';
export const HOLD_TAG_DESCRIPTION =
  'Claim was placed on hold by the pre-submission rules engine and will not be submitted until reviewed.';
