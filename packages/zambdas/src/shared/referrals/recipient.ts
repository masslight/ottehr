import Oystehr from '@oystehr/sdk';
import { Organization, ServiceRequest } from 'fhir/r4b';
import { getAddressString } from 'utils/lib/fhir/helpers';
import { getReferralRecipientContactId, getReferralRecipientFax } from 'utils/lib/fhir/referral';
import { ReferralRecipient } from 'utils/lib/types/api/referrals/referrals.types';
import { formatAddressBookPersonName } from 'utils/lib/types/data/address-book';
import { getAddressBookOrganizationOrThrow, mapAddressBookContact } from '../../ehr/address-book/helpers';

/**
 * The recipient as every referral surface shows it: the organization, else the person (the mockups, the form,
 * the discharge summary and the fax log all lead with the organization).
 */
export const mapReferralRecipient = (organization: Organization): ReferralRecipient => {
  const contact = mapAddressBookContact(organization);
  const personName = formatAddressBookPersonName(contact) || undefined;
  return {
    contactId: contact.id,
    name: contact.organizationName || personName || '',
    organizationName: contact.organizationName,
    personName,
    fax: contact.fax,
    phone: contact.phone,
    address: getAddressString(organization.address?.[0]) || undefined,
  };
};

/** The recipient with the fax number typed on the referral, when one was, in place of the contact's. */
export const withReferralFax = (serviceRequest: ServiceRequest, recipient: ReferralRecipient): ReferralRecipient => {
  const fax = getReferralRecipientFax(serviceRequest);
  return fax ? { ...recipient, fax } : recipient;
};

/** The address-book contact a referral is sent to; not found or not an address-book contact are client errors. */
export const loadRecipientContact = async (oystehr: Oystehr, contactId: string): Promise<ReferralRecipient> =>
  mapReferralRecipient(await getAddressBookOrganizationOrThrow(oystehr, contactId));

/** A referral's recipient, or nothing when it has none or the contact was deleted from the directory since. */
export const loadReferralRecipient = async (
  oystehr: Oystehr,
  serviceRequest: ServiceRequest
): Promise<ReferralRecipient | undefined> => {
  const contactId = getReferralRecipientContactId(serviceRequest);
  if (!contactId) return undefined;
  const [organization] = (
    await oystehr.fhir.search<Organization>({
      resourceType: 'Organization',
      params: [{ name: '_id', value: contactId }],
    })
  ).unbundle();
  return organization ? withReferralFax(serviceRequest, mapReferralRecipient(organization)) : undefined;
};
