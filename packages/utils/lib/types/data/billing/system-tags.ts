// System-managed tags: billing tags that are defined in code and applied by the system itself
// (rules engine holds, claim-creation facts) rather than created by a biller on the Tags page.
// This module is the single source of truth for them — add new system-managed tags to
// SYSTEM_MANAGED_TAGS and everything downstream follows:
// - search-billing-tags always returns them (so the Tags page shows them even before any claim
//   has used them) and marks them isSystemTag,
// - save-billing-tag / delete-billing-tag refuse to edit or delete them, and refuse to create or
//   rename another tag onto their names,
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

// Applied by sub-claim-response-adjust-status when a claim has more than one payer
export const SECONDARY_SUBMISSION_TAG_NAME = 'secondary-submission';

// Applied by sub-claim-response-adjust-status when a claim has more than one payer
export const SECONDARY_SUBMISSION_CROSSOVER_TAG_NAME = 'waiting-for-non-primary-ERA';

export const HOLD_SYSTEM_TAG: SystemManagedTag = {
  name: HOLD_TAG_NAME,
  description: 'Claim was placed on hold either by a user or by a rule and requires review before it can proceed.',
};

export const AUTO_ACCIDENT_SYSTEM_TAG: SystemManagedTag = {
  name: AUTO_ACCIDENT_TAG_NAME,
  description: 'Claim is for a clinical encounter resulting from an auto accident',
};

export const SECONDARY_SUBMISSION_SYSTEM_TAG: SystemManagedTag = {
  name: SECONDARY_SUBMISSION_TAG_NAME,
  description: 'Claim has more than one insurer and has been submitted to primary insurer',
};

export const SECONDARY_SUBMISSION_CROSSOVER_SYSTEM_TAG: SystemManagedTag = {
  name: SECONDARY_SUBMISSION_CROSSOVER_TAG_NAME,
  description: 'Claim has has been submitted to secondary insurer by primary insurer',
};

export const SYSTEM_MANAGED_TAGS: readonly SystemManagedTag[] = [
  HOLD_SYSTEM_TAG,
  AUTO_ACCIDENT_SYSTEM_TAG,
  SECONDARY_SUBMISSION_SYSTEM_TAG,
  SECONDARY_SUBMISSION_CROSSOVER_SYSTEM_TAG,
];

export function isSystemManagedTagName(name: string | undefined): boolean {
  return !!name && SYSTEM_MANAGED_TAGS.some((tag) => tag.name === name);
}

// The canonical system-managed name that `name` collides with, or undefined when there is none.
// Case-insensitive, unlike isSystemManagedTagName: a user-created "hold" would only masquerade as
// Hold, so the whole spelling family is reserved on the Tags page.
export function collidingSystemManagedTagName(name: string | undefined): string | undefined {
  const normalized = name?.trim().toLowerCase();
  if (!normalized) return undefined;
  return SYSTEM_MANAGED_TAGS.find((tag) => tag.name.toLowerCase() === normalized)?.name;
}
