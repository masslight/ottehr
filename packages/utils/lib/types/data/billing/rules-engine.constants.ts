// The well-known tag whose application by a rule terminates the pre-submission rules engine and
// holds the claim from submission. It lives in utils because the rule schemas canonicalize free-text
// tag input against it and the billing app's rule builder displays it; everything else about the
// engine (FHIR storage, evaluation) is backend-only and lives in
// packages/zambdas/src/billing/rules-engine/.
export const HOLD_TAG_NAME = 'Hold';
