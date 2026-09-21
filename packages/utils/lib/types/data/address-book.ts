import { z } from 'zod';
import { isPhoneNumberValid } from '../../helpers/helpers';

/** Marker tag that makes an Organization an address-book contact. */
export const ADDRESS_BOOK_TAG_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/address-book';
export const ADDRESS_BOOK_TAG_CODE = 'address-book';
/** One coding per free-text tag the user put on the contact. */
export const ADDRESS_BOOK_USER_TAG_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/address-book-tag';

export const ADDRESS_BOOK_ORG_OR_LAST_NAME_MESSAGE = 'Either an organization name or a last name is required';

const optionalString = z.string().trim().optional();
const optionalPhone = z
  .string()
  .trim()
  .refine((value) => !value || isPhoneNumberValid(value), 'Invalid phone number')
  .optional();

const AddressBookContactFieldsSchema = z.object({
  firstName: optionalString,
  lastName: optionalString,
  credential: optionalString,
  organizationName: optionalString,
  address: z
    .object({
      line1: optionalString,
      line2: optionalString,
      city: optionalString,
      state: optionalString,
      zip: optionalString,
    })
    .optional(),
  phone: optionalPhone,
  fax: optionalPhone,
  email: z.string().trim().email().or(z.literal('')).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
});

const hasOrganizationOrLastName = (contact: { organizationName?: string; lastName?: string }): boolean =>
  !!contact.organizationName || !!contact.lastName;

export const AddressBookContactInputSchema = AddressBookContactFieldsSchema.refine(
  hasOrganizationOrLastName,
  ADDRESS_BOOK_ORG_OR_LAST_NAME_MESSAGE
);
export type AddressBookContactInput = z.infer<typeof AddressBookContactInputSchema>;

// `contactId`, not `id`: the SDK's zambda.execute({ id, ...body }) reserves `id` for the zambda name.
export const UpdateAddressBookContactInputSchema = AddressBookContactFieldsSchema.extend({
  contactId: z.string().uuid(),
}).refine(hasOrganizationOrLastName, ADDRESS_BOOK_ORG_OR_LAST_NAME_MESSAGE);
export type UpdateAddressBookContactInput = z.infer<typeof UpdateAddressBookContactInputSchema>;

export const SearchAddressBookInputSchema = z.object({ tag: z.string().trim().min(1).optional() });
export type SearchAddressBookInput = z.infer<typeof SearchAddressBookInputSchema>;

export const DeleteAddressBookContactInputSchema = z.object({ contactId: z.string().uuid() });
export type DeleteAddressBookContactInput = z.infer<typeof DeleteAddressBookContactInputSchema>;

export type AddressBookContact = AddressBookContactInput & { id: string };

export interface SearchAddressBookOutput {
  contacts: AddressBookContact[];
}

export interface AddressBookContactOutput {
  contact: AddressBookContact;
}

/** "First Last, CRED" from whichever parts are present; empty when there is no person. */
export const formatAddressBookPersonName = (
  contact: Pick<AddressBookContactInput, 'firstName' | 'lastName' | 'credential'>
): string => {
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
  return name && contact.credential ? `${name}, ${contact.credential}` : name;
};
