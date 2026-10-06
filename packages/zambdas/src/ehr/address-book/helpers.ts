import Oystehr from '@oystehr/sdk';
import { Coding, Organization } from 'fhir/r4b';
import { formatPhoneNumber } from 'utils/lib/helpers/helpers';
import {
  ADDRESS_BOOK_TAG_CODE,
  ADDRESS_BOOK_TAG_SYSTEM,
  ADDRESS_BOOK_USER_TAG_SYSTEM,
  AddressBookContact,
  AddressBookContactInput,
  formatAddressBookPersonName,
} from 'utils/lib/types/data/address-book';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { isFhirNotFoundError } from '../../shared/errors';
import { normalizeAddress, normalizeTelecom } from '../../shared/organization';

const ADDRESS_BOOK_TAG_SYSTEMS: (string | undefined)[] = [ADDRESS_BOOK_TAG_SYSTEM, ADDRESS_BOOK_USER_TAG_SYSTEM];

export const isAddressBookOrganization = (organization: Organization): boolean =>
  organization.meta?.tag?.some((tag) => tag.system === ADDRESS_BOOK_TAG_SYSTEM && tag.code === ADDRESS_BOOK_TAG_CODE) ??
  false;

/** The contact's Organization; a contact deleted elsewhere is a client error, not a 500. */
export const getAddressBookOrganizationOrThrow = async (oystehr: Oystehr, contactId: string): Promise<Organization> => {
  let organization: Organization;
  try {
    organization = await oystehr.fhir.get<Organization>({ resourceType: 'Organization', id: contactId });
  } catch (error) {
    if (isFhirNotFoundError(error)) throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Contact ${contactId} not found`);
    throw error;
  }
  if (!isAddressBookOrganization(organization)) {
    throw INVALID_INPUT_ERROR(`Organization ${contactId} is not an address book contact`);
  }
  return organization;
};

/** Full replacement; only the id and meta tags from other systems survive from `existing`. */
export const buildAddressBookOrganization = (input: AddressBookContactInput, existing?: Organization): Organization => {
  const personName = formatAddressBookPersonName(input);
  const foreignTags = (existing?.meta?.tag ?? []).filter((tag) => !ADDRESS_BOOK_TAG_SYSTEMS.includes(tag.system));
  const userTags: Coding[] = (input.tags ?? []).map((code) => ({ system: ADDRESS_BOOK_USER_TAG_SYSTEM, code }));
  const { firstName, lastName, credential, address } = input;

  return {
    resourceType: 'Organization',
    ...(existing?.id ? { id: existing.id } : {}),
    meta: {
      ...existing?.meta,
      tag: [...foreignTags, { system: ADDRESS_BOOK_TAG_SYSTEM, code: ADDRESS_BOOK_TAG_CODE }, ...userTags],
    },
    name: input.organizationName || personName,
    ...(input.organizationName && personName ? { alias: [personName] } : {}),
    ...(personName
      ? {
          contact: [
            {
              name: {
                ...(firstName ? { given: [firstName] } : {}),
                ...(lastName ? { family: lastName } : {}),
                ...(credential ? { suffix: [credential] } : {}),
              },
            },
          ],
        }
      : {}),
    address: normalizeAddress(
      address && {
        line: [address.line1 ?? '', address.line2 ?? ''],
        city: address.city,
        state: address.state,
        postalCode: address.zip,
      }
    ),
    telecom: normalizeTelecom({
      phone: formatPhoneNumber(input.phone),
      fax: formatPhoneNumber(input.fax),
      email: input.email,
    }),
  };
};

export const mapAddressBookContact = (organization: Organization): AddressBookContact => {
  const name = organization.contact?.[0]?.name;
  const address = organization.address?.[0];
  const telecom = (system: string): string | undefined =>
    organization.telecom?.find((point) => point.system === system)?.value;
  const person = { firstName: name?.given?.[0], lastName: name?.family, credential: name?.suffix?.[0] };
  const hasPerson = !!formatAddressBookPersonName(person);

  return {
    id: organization.id ?? '',
    ...person,
    // A person-only contact stores the person display as the name; an org is present otherwise.
    organizationName: hasPerson && !organization.alias?.length ? undefined : organization.name,
    address: address
      ? {
          line1: address.line?.[0],
          line2: address.line?.[1],
          city: address.city,
          state: address.state,
          zip: address.postalCode,
        }
      : undefined,
    phone: telecom('phone'),
    fax: telecom('fax'),
    email: telecom('email'),
    tags: (organization.meta?.tag ?? [])
      .filter((tag) => tag.system === ADDRESS_BOOK_USER_TAG_SYSTEM && tag.code)
      .map((tag) => tag.code as string),
  };
};
