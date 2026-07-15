// The well-known tag whose application by a rule terminates a rules-engine run and holds the claim.
// It lives in utils because the rule schemas canonicalize free-text tag input against it and the
// billing app's rule builder displays it; everything else about the engines (FHIR storage,
// evaluation) is backend-only and lives in packages/zambdas/src/billing/rules-engine/.
export const HOLD_TAG_NAME = 'Hold';

// ---------------------------------------------------------------------------
// Rules engines
//
// The billing app runs several independent rules engines. Each engine has its own ordered rule set
// (stored in its own FHIR List), its own trigger, and its own on-success effect — but they all share
// the same rule shape (BillingRule), evaluator, and Hold semantics: rules run top to bottom and a
// run stops when a rule applies the Hold tag or fails.
// ---------------------------------------------------------------------------

// Engines run automatically only when a claim is created in their AR stage, and on demand via the
// claim-detail button. Changing an existing claim's AR Stage never runs an engine — the claim is
// held (Hold tag) instead, and the biller runs the rules when the claim is ready.
export const RULES_ENGINE_TYPES = [
  // Created in Insurance Payer AR / "Submit claim"; submits the claim to the payer when every rule
  // passes.
  'claim-submission',
  // Created in Non-insurance Payer AR / "Prepare for invoice"; moves the Non-insurance AR Status to
  // Ready to invoice when every rule passes.
  'non-insurance-payer-pre-invoice',
  // Created self-pay (no coverage) in Patient AR / "Prepare for invoice"; moves the Patient AR
  // Status to Ready to invoice when every rule passes.
  'patient-ar-pre-invoice',
] as const;

export type RulesEngineType = (typeof RULES_ENGINE_TYPES)[number];

export const DEFAULT_RULES_ENGINE: RulesEngineType = 'claim-submission';

export function isRulesEngineType(value: string | undefined): value is RulesEngineType {
  return !!value && (RULES_ENGINE_TYPES as readonly string[]).includes(value);
}

export interface RulesEngineDef {
  type: RulesEngineType;
  label: string;
  // "when …" clause describing the engine's automatic trigger (UI copy).
  runsWhen: string;
  // "… happens" clause describing the on-success effect (UI copy).
  onPass: string;
  // Label of the claim-detail button that runs this engine manually.
  runButtonLabel: string;
}

export const RULES_ENGINES: Record<RulesEngineType, RulesEngineDef> = {
  'claim-submission': {
    type: 'claim-submission',
    label: 'Claim Submission Rules',
    runsWhen: 'when an Insurance Payer AR claim is submitted',
    onPass: 'the claim is submitted to the payer',
    runButtonLabel: 'Submit claim',
  },
  'non-insurance-payer-pre-invoice': {
    type: 'non-insurance-payer-pre-invoice',
    label: 'Non-insurance Payer Pre-Invoice Rules',
    runsWhen: 'when a claim is created in Non-insurance Payer AR',
    onPass: 'the Non-insurance AR Status moves to Ready to invoice',
    runButtonLabel: 'Prepare for invoice',
  },
  'patient-ar-pre-invoice': {
    type: 'patient-ar-pre-invoice',
    label: 'Patient AR Pre-Invoice Rules',
    runsWhen: 'when a self-pay claim is created in Patient AR',
    onPass: 'the Patient AR Status moves to Ready to invoice',
    runButtonLabel: 'Prepare for invoice',
  },
};
