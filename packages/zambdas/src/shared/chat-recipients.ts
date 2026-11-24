import { RelatedPerson } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { getCoding } from 'utils/lib/fhir/helpers';
import { SMSRecipient } from 'utils/lib/types/api/messaging.types';

export const isUserRelatedPerson = (rp: RelatedPerson): boolean =>
  getCoding(rp.relationship, `${PRIVATE_EXTENSION_BASE_URL}/relationship`)?.code === 'user-relatedperson';

/**
 * The SMS recipients of a patient: one per (RelatedPerson, phone) pair, for the patient's own RelatedPersons only.
 * `phonesByRelatedPersonRef` maps `RelatedPerson/<id>` to every number known for it (its own SMS number and the
 * phone of a Person linking to it). Pairs of a RelatedPerson that is not in `relatedPersons` are never used,
 * so a Person shared with a sibling's RelatedPerson cannot add that sibling's recipient. The tracking board and
 * the patient record chat both build their recipients here so they always agree.
 */
export const buildSmsRecipients = (
  relatedPersons: RelatedPerson[],
  phonesByRelatedPersonRef: Record<string, Set<string>>
): SMSRecipient[] => {
  const recipients = new Map<string, SMSRecipient>();
  relatedPersons.forEach((rp) => {
    const recipientResourceUri = `RelatedPerson/${rp.id}`;
    (phonesByRelatedPersonRef[recipientResourceUri] ?? new Set<string>()).forEach((smsNumber) => {
      const key = `${recipientResourceUri}|${smsNumber}`;
      if (!recipients.has(key)) recipients.set(key, { recipientResourceUri, smsNumber });
    });
  });
  return Array.from(recipients.values());
};
