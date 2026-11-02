import { OTHER_SPECIALTY_TRANSFER_OPTION, specialtyTransferOptions } from 'utils/lib/fhir/disposition';
import { FaxDocumentKind } from 'utils/lib/types/api/fax.types';
import {
  REFERRAL_DEFAULTS,
  ReferralAsk,
  ReferralDTO,
  ReferralScheduler,
  ReferralUrgency,
  SaveReferralInput,
} from 'utils/lib/types/api/referrals/referrals.types';
import { normalizeAddressBookTag } from 'utils/lib/types/data/address-book';

/** The disposition's specialty list without "Other"; "Other" is a free-text entry on the referral form. */
export const REFERRAL_SPECIALTY_OPTIONS = specialtyTransferOptions.filter(
  (option) => option !== OTHER_SPECIALTY_TRANSFER_OPTION
);

/** The directory tag a specialty filters by, normalized the way tags are stored. */
export const specialtyTag = (specialty: string): string | undefined =>
  specialty && specialty !== OTHER_SPECIALTY_TRANSFER_OPTION ? normalizeAddressBookTag(specialty) : undefined;

export interface ReferralFormValues {
  specialty: string;
  /** Free text when `specialty` is "Other". */
  specialtyOther: string;
  /** The picker's text; `recipientContactId` says which directory contact it came from. */
  recipientName: string;
  recipientContactId: string;
  recipientFax: string;
  recipientPhone: string;
  reason: string;
  urgency: ReferralUrgency;
  whatIsAsked: ReferralAsk;
  whoSchedules: ReferralScheduler;
  responseRequested: boolean;
  includeDocuments: FaxDocumentKind[];
  notesToRecipient: string;
}

/** `hasVisit` false (a referral made from the patient record) starts with no visit documents to include. */
export const toReferralFormValues = (referral?: ReferralDTO, hasVisit = true): ReferralFormValues => {
  const listed = !referral || REFERRAL_SPECIALTY_OPTIONS.includes(referral.specialty);
  return {
    specialty: referral ? (listed ? referral.specialty : OTHER_SPECIALTY_TRANSFER_OPTION) : '',
    specialtyOther: referral && !listed ? referral.specialty : '',
    recipientName: referral?.recipient?.name ?? '',
    recipientContactId: referral?.recipient?.contactId ?? '',
    recipientFax: referral?.recipient?.fax ?? '',
    recipientPhone: referral?.recipient?.phone ?? '',
    reason: referral?.reason ?? '',
    urgency: referral?.urgency ?? REFERRAL_DEFAULTS.urgency,
    whatIsAsked: referral?.whatIsAsked ?? REFERRAL_DEFAULTS.whatIsAsked,
    whoSchedules: referral?.whoSchedules ?? REFERRAL_DEFAULTS.whoSchedules,
    responseRequested: referral?.responseRequested ?? REFERRAL_DEFAULTS.responseRequested,
    includeDocuments: referral?.includeDocuments ?? (hasVisit ? [...REFERRAL_DEFAULTS.includeDocuments] : []),
    notesToRecipient: referral?.notesToRecipient ?? '',
  };
};

export const toSaveReferralInput = (
  values: ReferralFormValues,
  ids: { patientId: string; encounterId?: string; referralId?: string }
): SaveReferralInput => ({
  referralId: ids.referralId,
  patientId: ids.patientId,
  encounterId: ids.encounterId,
  specialty: values.specialty === OTHER_SPECIALTY_TRANSFER_OPTION ? values.specialtyOther.trim() : values.specialty,
  recipientContactId: values.recipientContactId || undefined,
  recipientFax: values.recipientContactId ? values.recipientFax.trim() || undefined : undefined,
  reason: values.reason.trim(),
  urgency: values.urgency,
  whatIsAsked: values.whatIsAsked,
  whoSchedules: values.whoSchedules,
  // Nobody is asked to return a response when there is no recipient.
  responseRequested: values.recipientContactId ? values.responseRequested : false,
  // Visit documents only exist for a referral made on a visit.
  includeDocuments: ids.encounterId ? values.includeDocuments : [],
  notesToRecipient: values.notesToRecipient.trim() || undefined,
});

/** What the row and the discharge dialog print when the patient picks the specialist. */
export const NO_RECIPIENT_TEXT = 'No recipient: patient chooses a provider their insurance covers';

/** Hover text on the disabled Send fax button when the recipient has no fax number. */
export const NO_FAX_SEND_TEXT =
  'No fax number. Enter one in the Fax field, or add it to the contact in the Directory so it is remembered.';
/** Hover text on the disabled Send fax button when no recipient was picked. */
export const NO_RECIPIENT_SEND_TEXT = 'Pick a recipient with a fax number to send by fax.';
