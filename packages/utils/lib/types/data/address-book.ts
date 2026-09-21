import { z } from 'zod';
import { isPhoneNumberValid } from '../../helpers/helpers';

/** Marker tag that makes an Organization an address-book contact. */
export const ADDRESS_BOOK_TAG_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/address-book';
export const ADDRESS_BOOK_TAG_CODE = 'address-book';
/** One coding per free-text tag the user put on the contact. */
export const ADDRESS_BOOK_USER_TAG_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/address-book-tag';

export const ADDRESS_BOOK_ORG_OR_LAST_NAME_MESSAGE = 'Either an organization name or a last name is required';
export const ADDRESS_BOOK_CREDENTIAL_NEEDS_LAST_NAME_MESSAGE = 'A credential needs a last name';
export const ADDRESS_BOOK_LINE2_NEEDS_LINE1_MESSAGE = 'Address line 2 requires address line 1';
export const ADDRESS_BOOK_TAG_MESSAGE =
  'Tags may only contain letters, numbers, spaces, hyphens, underscores, periods and apostrophes';

/** Tags the app itself filters on (pickers pass them as `tag`); always suggested, and also free-typable. */
export const ADDRESS_BOOK_KNOWN_TAGS = [
  { tag: 'pcp', label: 'Primary care physician' },
  { tag: 'specialist', label: 'Specialist' },
  { tag: 'imaging', label: 'Imaging' },
  { tag: 'lab', label: 'Lab' },
  { tag: 'employer', label: 'Employer' },
  { tag: 'attorney', label: 'Attorney' },
  { tag: 'school', label: 'School' },
  { tag: 'pharmacy', label: 'Pharmacy' },
  { tag: 'hospital', label: 'Hospital' },
] as const;
export type AddressBookKnownTag = (typeof ADDRESS_BOOK_KNOWN_TAGS)[number]['tag'];

const optionalString = z.string().trim().optional();
// Tags go verbatim into a FHIR `_tag` search token, so keep the token separators out of them.
// Lowercased so "PCP" and "pcp" are one tag, both when stored and when a picker filters on it.
const tagString = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .regex(/^[\p{L}\p{N} .'_-]+$/u, ADDRESS_BOOK_TAG_MESSAGE);
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
    .refine((address) => !address.line2 || !!address.line1, {
      message: ADDRESS_BOOK_LINE2_NEEDS_LINE1_MESSAGE,
      path: ['line2'],
    })
    .optional(),
  phone: optionalPhone,
  fax: optionalPhone,
  email: z.string().trim().email().or(z.literal('')).optional(),
  tags: z
    .array(tagString)
    .transform((tags) => [...new Set(tags)])
    .optional(),
});

type ContactNameFields = { organizationName?: string; lastName?: string; credential?: string };

const hasOrganizationOrLastName = (contact: ContactNameFields): boolean =>
  !!contact.organizationName || !!contact.lastName;

// The credential is stored as the person's name suffix, so it is lost without a person.
const withContactRules = <T extends z.ZodType<ContactNameFields>>(schema: T): z.ZodEffects<z.ZodEffects<T>> =>
  schema
    .refine(hasOrganizationOrLastName, ADDRESS_BOOK_ORG_OR_LAST_NAME_MESSAGE)
    .refine((contact) => !contact.credential || !!contact.lastName, {
      message: ADDRESS_BOOK_CREDENTIAL_NEEDS_LAST_NAME_MESSAGE,
      path: ['credential'],
    });

export const AddressBookContactInputSchema = withContactRules(AddressBookContactFieldsSchema);
export type AddressBookContactInput = z.infer<typeof AddressBookContactInputSchema>;

// `contactId`, not `id`: the SDK's zambda.execute({ id, ...body }) reserves `id` for the zambda name.
export const UpdateAddressBookContactInputSchema = withContactRules(
  AddressBookContactFieldsSchema.extend({ contactId: z.string().uuid() })
);
export type UpdateAddressBookContactInput = z.infer<typeof UpdateAddressBookContactInputSchema>;

export const SearchAddressBookInputSchema = z.object({ tag: tagString.optional() });
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
