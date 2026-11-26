import { RelatedPerson } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { getCoding } from 'utils/lib/fhir/helpers';
import { getSMSNumberForIndividual } from 'utils/lib/fhir/patient';
import { SMSRecipient } from 'utils/lib/types/api/messaging.types';

export const isUserRelatedPerson = (rp: RelatedPerson): boolean =>
  getCoding(rp.relationship, `${PRIVATE_EXTENSION_BASE_URL}/relationship`)?.code === 'user-relatedperson';

export const buildSmsRecipients = (
  relatedPersons: RelatedPerson[],
  phonesByRelatedPersonRef: Record<string, Set<string>>
): SMSRecipient[] => {
  const recipients = new Map<string, SMSRecipient>();
  relatedPersons.forEach((rp) => {
    const recipientResourceUri = `RelatedPerson/${rp.id}`;
    if (recipients.has(recipientResourceUri)) return;
    const phones = phonesByRelatedPersonRef[recipientResourceUri] ?? new Set<string>();
    const ownNumber = getSMSNumberForIndividual(rp);
    const smsNumber = ownNumber && phones.has(ownNumber) ? ownNumber : phones.values().next().value;
    if (smsNumber) recipients.set(recipientResourceUri, { recipientResourceUri, smsNumber });
  });
  return Array.from(recipients.values());
};
