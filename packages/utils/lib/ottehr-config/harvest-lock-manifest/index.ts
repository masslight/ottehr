import { pageHarvestStrategy } from 'config-types';
import { BIRTH_SEXES, SUBSCRIBER_RELATIONSHIP_CODE_MAP } from '../../fhir/constants';
import {
  INSURANCE_CARD_BACK_2_ID,
  INSURANCE_CARD_BACK_ID,
  INSURANCE_CARD_FRONT_2_ID,
  INSURANCE_CARD_FRONT_ID,
  PHOTO_ID_BACK_ID,
  PHOTO_ID_FRONT_ID,
  SCHOOL_WORK_NOTE_SCHOOL_ID,
  SCHOOL_WORK_NOTE_WORK_ID,
} from '../../types/data/paperwork/paperwork.constants';
import {
  PracticeManagedQuestionnaire,
  PracticeManagedQuestionnaireItem,
} from '../../types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { PHARMACY_COLLECTION_LINK_IDS } from '../../types/data/search-places';
import {
  DOES_NOT_HAVE_ATTORNEY_OPTION,
  HAS_ATTORNEY_OPTION,
  INSURANCE_PAY_OPTION,
  SELF_PAY_OPTION,
  VALUE_SETS,
} from '../value-sets';

/**
 * Harvest-lock manifest — the single, code-defined source of truth for which QuestionnaireResponse
 * linkIds (and which specific answer-option codes) are load-bearing for the intake "harvest" pipeline
 * that turns paperwork into Patient / Coverage / Account / RelatedPerson / Consent / DocumentReference.
 *
 * Editing a `practice-default` questionnaire in the admin portal is validated against this manifest so a
 * Customer-Success user cannot remove/rename/retype a harvested item, remove a harvested page, or change a
 * harvest-critical option's frozen `code` — while still being free to reword labels/help text and add new
 * (non-harvested) fields. See `resolveLocksForQuestionnaire`, and the lock validator in
 * `helpers/practice-managed-questionnaires/lock-validation.ts`.
 *
 * NOTE: this is hand-authored (first cut, deliberately over-locked). The harvest reads are spread across
 * `packages/zambdas/src/ehr/shared/harvest/index.ts` (`paperworkToPatientFieldMap` + the per-section
 * sub-extractors) and are not yet machine-exported, so a CI drift-guard test is a deliberate follow-up.
 * Keep this list in sync with that module until the guard lands.
 */

// Insurance/policy-holder fields exist once for primary coverage (no suffix) and once for secondary (`-2`).
const withInsuranceSuffixes = (base: string): string[] => [base, `${base}-2`];

// ---- Patient master record (contact-information-page / patient-details-page / card-payment-page) ----
const PATIENT_MASTER_RECORD_LINK_IDS = [
  'patient-first-name',
  'patient-middle-name',
  'patient-last-name',
  'patient-birthdate',
  'patient-pronouns',
  'patient-pronouns-custom',
  'patient-name-suffix',
  'patient-preferred-name',
  'patient-birth-sex',
  'patient-number',
  'patient-email',
  'patient-no-email',
  'preferred-language',
  'patient-street-address',
  'patient-street-address-2',
  'patient-city',
  'patient-state',
  'patient-zip',
  'patient-filling-out-as',
  'guardian-email',
  'guardian-number',
  'patient-ethnicity',
  'patient-race',
  'patient-gender-identity',
  'patient-gender-identity-details',
  'patient-sexual-orientation',
  'patient-point-of-discovery',
  'mobile-opt-in',
  'common-well-consent',
  'patient-ssn',
  'patient-preferred-communication-method',
  'patient-has-medicaid',
];

// ---- Primary care physician (primary-care-physician-page) ----
const PCP_LINK_IDS = ['pcp-first', 'pcp-last', 'pcp-practice', 'pcp-address', 'pcp-number', 'pcp-fax', 'pcp-active'];

// ---- Coverage + policy holder (payment-option-page), primary + secondary ----
const COVERAGE_LINK_IDS = [
  'payment-option',
  ...withInsuranceSuffixes('insurance-carrier'),
  ...withInsuranceSuffixes('insurance-member-id'),
  ...withInsuranceSuffixes('insurance-plan-type'),
  ...withInsuranceSuffixes('insurance-additional-information'),
  ...withInsuranceSuffixes('insurance-priority'),
  ...withInsuranceSuffixes('patient-relationship-to-insured'),
  ...withInsuranceSuffixes('policy-holder-first-name'),
  ...withInsuranceSuffixes('policy-holder-middle-name'),
  ...withInsuranceSuffixes('policy-holder-last-name'),
  ...withInsuranceSuffixes('policy-holder-date-of-birth'),
  ...withInsuranceSuffixes('policy-holder-birth-sex'),
  ...withInsuranceSuffixes('policy-holder-number'),
  ...withInsuranceSuffixes('policy-holder-email'),
  ...withInsuranceSuffixes('policy-holder-address-as-patient'),
  ...withInsuranceSuffixes('policy-holder-address'),
  ...withInsuranceSuffixes('policy-holder-address-additional-line'),
  ...withInsuranceSuffixes('policy-holder-city'),
  ...withInsuranceSuffixes('policy-holder-state'),
  ...withInsuranceSuffixes('policy-holder-zip'),
];

// ---- Responsible party / guarantor (responsible-party-page) ----
const RESPONSIBLE_PARTY_LINK_IDS = [
  'responsible-party-first-name',
  'responsible-party-last-name',
  'responsible-party-date-of-birth',
  'responsible-party-birth-sex',
  'responsible-party-relationship',
  'responsible-party-email',
  'responsible-party-number',
  'responsible-party-no-email',
  'responsible-party-address',
  'responsible-party-address-2',
  'responsible-party-city',
  'responsible-party-state',
  'responsible-party-zip',
  'responsible-party-address-as-patient',
];

// ---- Emergency contact (emergency-contact-page) ----
const EMERGENCY_CONTACT_LINK_IDS = [
  'emergency-contact-first-name',
  'emergency-contact-middle-name',
  'emergency-contact-last-name',
  'emergency-contact-relationship',
  'emergency-contact-number',
  'emergency-contact-address',
  'emergency-contact-address-2',
  'emergency-contact-city',
  'emergency-contact-state',
  'emergency-contact-zip',
  'emergency-contact-address-as-patient',
];

// ---- Employer + occupational medicine (employer-information-page / occupational-medicine-*) ----
const EMPLOYER_LINK_IDS = [
  'employer-name',
  'employer-address',
  'employer-address-2',
  'employer-city',
  'employer-state',
  'employer-zip',
  'employer-contact-first-name',
  'employer-contact-last-name',
  'employer-contact-title',
  'employer-contact-email',
  'employer-contact-phone',
  'employer-contact-fax',
  'workers-comp-insurance-name',
  'workers-comp-insurance-member-id',
  'occupational-medicine-employer',
];

// ---- Attorney / MVA (attorney-mva-page) ----
const ATTORNEY_LINK_IDS = [
  'attorney-mva-has-attorney',
  'attorney-mva-firm',
  'attorney-mva-first-name',
  'attorney-mva-last-name',
  'attorney-mva-email',
  'attorney-mva-mobile',
  'attorney-mva-fax',
];

// ---- Pharmacy (pharmacy-page) ----
const PHARMACY_LINK_IDS = [...Object.values(PHARMACY_COLLECTION_LINK_IDS), 'pharmacy-page-manual-entry'];

// ---- Consent (consent-forms-page) ----
const CONSENT_LINK_IDS = ['signature', 'full-name', 'consent-form-signer-relationship', 'signature-timezone'];

// ---- Documents / attachments (contact-information-page, payment-option-page, school-work-note-page) ----
const DOCUMENT_LINK_IDS = [
  PHOTO_ID_FRONT_ID,
  PHOTO_ID_BACK_ID,
  INSURANCE_CARD_FRONT_ID,
  INSURANCE_CARD_BACK_ID,
  INSURANCE_CARD_FRONT_2_ID,
  INSURANCE_CARD_BACK_2_ID,
  SCHOOL_WORK_NOTE_SCHOOL_ID,
  SCHOOL_WORK_NOTE_WORK_ID,
];

export interface HarvestLockManifest {
  /** Page linkIds whose removal breaks harvest (the keys of `pageHarvestStrategy`). */
  lockedPageLinkIds: string[];
  /** Field linkIds harvest reads — locked from remove/rename/retype/required-change. */
  lockedItemLinkIds: string[];
  /** linkId → option `code`s that must stay frozen (label/`display` remains editable). */
  protectedOptionCodes: Record<string, string[]>;
}

export const HARVEST_LOCK_MANIFEST: HarvestLockManifest = {
  lockedPageLinkIds: Object.keys(pageHarvestStrategy),
  lockedItemLinkIds: [
    ...PATIENT_MASTER_RECORD_LINK_IDS,
    ...PCP_LINK_IDS,
    ...COVERAGE_LINK_IDS,
    ...RESPONSIBLE_PARTY_LINK_IDS,
    ...EMERGENCY_CONTACT_LINK_IDS,
    ...EMPLOYER_LINK_IDS,
    ...ATTORNEY_LINK_IDS,
    ...PHARMACY_LINK_IDS,
    ...CONSENT_LINK_IDS,
    ...DOCUMENT_LINK_IDS,
  ],
  protectedOptionCodes: {
    'payment-option': [INSURANCE_PAY_OPTION, SELF_PAY_OPTION],
    ...Object.fromEntries(
      withInsuranceSuffixes('insurance-priority').map((id) => [
        id,
        VALUE_SETS.insurancePriorityOptions.map((o) => o.value),
      ])
    ),
    ...Object.fromEntries(
      withInsuranceSuffixes('patient-relationship-to-insured').map((id) => [
        id,
        Object.keys(SUBSCRIBER_RELATIONSHIP_CODE_MAP),
      ])
    ),
    'patient-birth-sex': [...BIRTH_SEXES],
    ...Object.fromEntries(withInsuranceSuffixes('policy-holder-birth-sex').map((id) => [id, [...BIRTH_SEXES]])),
    'responsible-party-birth-sex': [...BIRTH_SEXES],
    'attorney-mva-has-attorney': [HAS_ATTORNEY_OPTION, DOES_NOT_HAVE_ATTORNEY_OPTION],
  },
};

export interface ResolvedLocks {
  /** Top-level (page) linkIds that cannot be removed. */
  lockedPageLinkIds: Set<string>;
  /** Item linkIds that are read-only (no remove/rename/retype/required-change). */
  lockedItemLinkIds: Set<string>;
  /** linkId → frozen option codes. */
  protectedOptionCodesByLinkId: Map<string, Set<string>>;
}

// gather every linkId referenced by a conditional pointer (trigger target, dynamic-population source, or a
// raw native enableWhen) so the referenced *target* item can also be locked from removal
const collectReferencedLinkIds = (items: PracticeManagedQuestionnaireItem[] | undefined, acc: Set<string>): void => {
  for (const item of items ?? []) {
    for (const trigger of item.triggers ?? []) {
      if (trigger.targetQuestionLinkId) acc.add(trigger.targetQuestionLinkId);
    }
    if (item.dynamicPopulation?.sourceLinkId) acc.add(item.dynamicPopulation.sourceLinkId);
    for (const ew of item.enableWhen ?? []) {
      if (ew.question) acc.add(ew.question);
    }
    collectReferencedLinkIds(item.item, acc);
  }
};

const collectPresentLinkIds = (items: PracticeManagedQuestionnaireItem[] | undefined, acc: Set<string>): void => {
  for (const item of items ?? []) {
    if (item.linkId) acc.add(item.linkId);
    collectPresentLinkIds(item.item, acc);
  }
};

/**
 * Resolve the concrete locks for a questionnaire against the manifest. Starts from the manifest's static
 * harvest-critical linkIds/pages/option-codes, then augments the item-lock set with any item that is the
 * *target* of a conditional pointer present in this questionnaire (so removing a referenced item is blocked
 * too — over-lock first). Pure; reused by the editor UI and the server-side lock validator.
 */
export const resolveLocksForQuestionnaire = (
  questionnaire: Pick<PracticeManagedQuestionnaire, 'item'>,
  manifest: HarvestLockManifest = HARVEST_LOCK_MANIFEST
): ResolvedLocks => {
  const lockedItemLinkIds = new Set<string>(manifest.lockedItemLinkIds);

  const referenced = new Set<string>();
  collectReferencedLinkIds(questionnaire.item, referenced);
  const present = new Set<string>();
  collectPresentLinkIds(questionnaire.item, present);
  // only lock a referenced target that actually exists in this questionnaire
  for (const linkId of referenced) {
    if (present.has(linkId)) lockedItemLinkIds.add(linkId);
  }

  const protectedOptionCodesByLinkId = new Map<string, Set<string>>();
  for (const [linkId, codes] of Object.entries(manifest.protectedOptionCodes)) {
    protectedOptionCodesByLinkId.set(linkId, new Set(codes));
  }

  return {
    lockedPageLinkIds: new Set(manifest.lockedPageLinkIds),
    lockedItemLinkIds,
    protectedOptionCodesByLinkId,
  };
};
