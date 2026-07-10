import { ottehrCodeSystemUrl, ottehrExtensionUrl } from 'utils/lib/fhir/systemUrls';

// FHIR identifiers for the pre-submission rules engine's storage and kickoff resources. These are
// backend-only: the billing app talks to the rules via the get/save zambdas and never touches the
// FHIR encoding. The storage model (an ordered List of contained Basic rules) is documented in
// ./serialization.ts.

// meta.tag on the singleton List, and the code on each contained Basic rule.
export const RULES_ENGINE_TAG_SYSTEM = 'https://fhir.ottehr.com/billing/rules-engine';
export const PRESUBMISSION_RULES_LIST_CODE = 'presubmission-rules-list';
export const PRESUBMISSION_RULE_CODE = 'presubmission-rule';
export const PRESUBMISSION_RULES_LIST_TITLE = 'Pre-submission rules engine';

// Extensions on each rule's contained Basic.
export const RULE_NAME_EXTENSION_URL = ottehrExtensionUrl('presubmission-rule-name');
export const RULE_DESCRIPTION_EXTENSION_URL = ottehrExtensionUrl('presubmission-rule-description');
export const RULE_ENABLED_EXTENSION_URL = ottehrExtensionUrl('presubmission-rule-enabled');
export const RULE_DEFINITION_EXTENSION_URL = ottehrExtensionUrl('presubmission-rule-definition');

// The FHIR Task that kicks off the engine. A working-copy claim's creation enqueues a Task with this
// code (status `requested`); a Subscription invokes the sub-presubmission-rules-engine zambda.
export const PRESUBMISSION_RULES_TASK_SYSTEM = ottehrCodeSystemUrl('billing-rules-engine');
export const PRESUBMISSION_RULES_TASK_CODE = 'run-presubmission-rules';

// Description on the seeded Hold system-tag definition (the tag name itself, HOLD_TAG_NAME, lives in
// utils because the rule schemas canonicalize against it and the rule-builder UI displays it).
export const HOLD_TAG_DESCRIPTION =
  'Claim was placed on hold by the pre-submission rules engine and will not be submitted until reviewed.';
