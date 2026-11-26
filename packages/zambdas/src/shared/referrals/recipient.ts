import Oystehr from '@oystehr/sdk';
import { Organization, ServiceRequest } from 'fhir/r4b';
import { chunkThings } from 'utils/lib/fhir/chat';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
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

const CONTACT_ID_SEARCH_CHUNK = 50;

export const loadRecipientsFor = async (
  oystehr: Oystehr,
  serviceRequests: ServiceRequest[]
): Promise<Map<string, ReferralRecipient>> => {
  const contactIds = [
    ...new Set(serviceRequests.map(getReferralRecipientContactId).filter((id): id is string => !!id)),
  ];
  const organizations = (
    await Promise.all(
      chunkThings(contactIds, CONTACT_ID_SEARCH_CHUNK).map((chunk) =>
        getAllFhirSearchPages<Organization>(
          { resourceType: 'Organization', params: [{ name: '_id', value: chunk.join(',') }] },
          oystehr
        )
      )
    )
  ).flat();
  const byId = new Map(organizations.map((organization) => [organization.id, mapReferralRecipient(organization)]));
  return new Map(
    serviceRequests.flatMap((serviceRequest) => {
      const recipient = byId.get(getReferralRecipientContactId(serviceRequest) ?? '');
      return serviceRequest.id && recipient ? [[serviceRequest.id, withReferralFax(serviceRequest, recipient)]] : [];
    })
  );
};

export const loadReferralRecipient = async (
  oystehr: Oystehr,
  serviceRequest: ServiceRequest
): Promise<ReferralRecipient | undefined> =>
  serviceRequest.id ? (await loadRecipientsFor(oystehr, [serviceRequest])).get(serviceRequest.id) : undefined;
