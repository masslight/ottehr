// System-managed tags: billing tags that are defined in code and applied by the system itself
// (rules engine holds, claim-creation facts) rather than created by a biller on the Tags page.
// This module is the single source of truth for them — add new system-managed tags to
// SYSTEM_MANAGED_TAGS and everything downstream follows:
// - search-billing-tags always returns them (so the Tags page shows them even before any claim
//   has used them) and marks them isSystemTag,
// - save-billing-tag / delete-billing-tag refuse to edit or delete them,
// - tag validations (save-billing-rules, tag-billing-claim) always accept them,
// - the zambdas seed their Basic definitions from these entries (see systemTagBasic in
//   packages/zambdas/src/billing/shared.ts),
// - the billing app's TagSelect offers them even while the tag list is unavailable.
// It lives in utils because both the billing app and the zambdas consume it.

export interface SystemManagedTag {
  name: string;
  description: string;
}

// The well-known tag whose application by a rule terminates a rules-engine run and holds the claim.
// The rule schemas canonicalize free-text tag input against this name and the billing app's rule
// builder displays it; everything else about the engines (FHIR storage, evaluation) is backend-only
// and lives in packages/zambdas/src/billing/rules-engine/.
export const HOLD_TAG_NAME = 'Hold';

// Applied by create-billing-claim-from-encounter when the clinical visit was booked as an auto
// accident.
export const AUTO_ACCIDENT_TAG_NAME = 'Auto Accident';

export const HOLD_SYSTEM_TAG: SystemManagedTag = {
  name: HOLD_TAG_NAME,
  description: 'Claim was placed on hold either by a user or by a rule and requires review before it can proceed.',
};

export const AUTO_ACCIDENT_SYSTEM_TAG: SystemManagedTag = {
  name: AUTO_ACCIDENT_TAG_NAME,
  description: 'Claim is for a clinical encounter resulting from an auto accident',
};

export const SYSTEM_MANAGED_TAGS: readonly SystemManagedTag[] = [HOLD_SYSTEM_TAG, AUTO_ACCIDENT_SYSTEM_TAG];

export function isSystemManagedTagName(name: string | undefined): boolean {
  return !!name && SYSTEM_MANAGED_TAGS.some((tag) => tag.name === name);
}
