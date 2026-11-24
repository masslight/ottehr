import Oystehr from '@oystehr/sdk';
import { Organization, ServiceRequest } from 'fhir/r4b';
import { getAddressString } from 'utils/lib/fhir/helpers';
import { getReferralRecipientContactId, getReferralRecipientFax } from 'utils/lib/fhir/referral';
import { ReferralRecipient } from 'utils/lib/types/api/referrals/referrals.types';
import { formatAddressBookPersonName } from 'utils/lib/types/data/address-book';
import { getAddressBookOrganizationOrThrow, mapAddressBookContact } from '../../ehr/address-book/helpers';

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

export const withReferralFax = (serviceRequest: ServiceRequest, recipient: ReferralRecipient): ReferralRecipient => {
  const fax = getReferralRecipientFax(serviceRequest);
  return fax ? { ...recipient, fax } : recipient;
};

export const loadRecipientContact = async (oystehr: Oystehr, contactId: string): Promise<ReferralRecipient> =>
  mapReferralRecipient(await getAddressBookOrganizationOrThrow(oystehr, contactId));

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
