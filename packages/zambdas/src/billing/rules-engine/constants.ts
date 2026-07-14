import { RulesEngineType } from 'utils';
import { ottehrCodeSystemUrl, ottehrExtensionUrl } from 'utils/lib/fhir/systemUrls';

// FHIR identifiers for the rules engines' storage and kickoff resources. These are backend-only:
// the billing app talks to the rules via the get/save zambdas and never touches the FHIR encoding.
// The storage model (one ordered List of contained Basic rules per engine) is documented in
// ./serialization.ts.

// meta.tag system on each engine's singleton List, and the code system on each contained Basic rule.
export const RULES_ENGINE_TAG_SYSTEM = 'https://fhir.ottehr.com/billing/rules-engine';

// Code on each rule's contained Basic (shared by every engine — the owning List identifies the
// engine). The value predates the multi-engine split, so it keeps its legacy "presubmission" name
// for compatibility with already-stored rules.
export const RULE_BASIC_CODE = 'presubmission-rule';

// Extensions on each rule's contained Basic. The URLs predate the multi-engine split (see
// RULE_BASIC_CODE) and are kept for compatibility with already-stored rules.
export const RULE_NAME_EXTENSION_URL = ottehrExtensionUrl('presubmission-rule-name');
export const RULE_DESCRIPTION_EXTENSION_URL = ottehrExtensionUrl('presubmission-rule-description');
export const RULE_ENABLED_EXTENSION_URL = ottehrExtensionUrl('presubmission-rule-enabled');
export const RULE_DEFINITION_EXTENSION_URL = ottehrExtensionUrl('presubmission-rule-definition');

// System of the code on the FHIR Task that kicks off an engine. Each engine has its own Task code;
// a Subscription per code (config/billing-app-core/zambdas.json) invokes the
// sub-presubmission-rules-engine zambda, which dispatches on the code.
export const RULES_ENGINE_TASK_SYSTEM = ottehrCodeSystemUrl('billing-rules-engine');

interface RulesEngineFhirIds {
  // meta.tag code identifying the engine's singleton rules List.
  listCode: string;
  listTitle: string;
  // Task.code that kicks this engine off (matched by the engine's Subscription).
  taskCode: string;
}

// The Claim Submission engine keeps its original "presubmission" codes so existing deployments'
// rules Lists, queued Tasks, and Subscription criteria stay valid across the rename.
export const RULES_ENGINE_FHIR: Record<RulesEngineType, RulesEngineFhirIds> = {
  'claim-submission': {
    listCode: 'presubmission-rules-list',
    listTitle: 'Claim submission rules engine',
    taskCode: 'run-presubmission-rules',
  },
  'non-insurance-payer-pre-invoice': {
    listCode: 'non-insurance-payer-pre-invoice-rules-list',
    listTitle: 'Non-insurance payer pre-invoice rules engine',
    taskCode: 'run-non-insurance-payer-pre-invoice-rules',
  },
  'patient-ar-pre-invoice': {
    listCode: 'patient-ar-pre-invoice-rules-list',
    listTitle: 'Patient AR pre-invoice rules engine',
    taskCode: 'run-patient-ar-pre-invoice-rules',
  },
};

// Reverse lookup for the subscription zambda: which engine does a kickoff Task belong to?
export function rulesEngineForTaskCode(taskCode: string | undefined): RulesEngineType | undefined {
  if (!taskCode) return undefined;
  return (Object.keys(RULES_ENGINE_FHIR) as RulesEngineType[]).find(
    (engine) => RULES_ENGINE_FHIR[engine].taskCode === taskCode
  );
}

// Description on the seeded Hold system-tag definition (the tag name itself, HOLD_TAG_NAME, lives in
// utils because the rule schemas canonicalize against it and the rule-builder UI displays it).
export const HOLD_TAG_DESCRIPTION =
  'Claim was placed on hold by a billing rules engine and requires review before it can proceed.';
