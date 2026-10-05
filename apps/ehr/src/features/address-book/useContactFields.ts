import { useFormContext } from 'react-hook-form';
import { formatPhoneNumberDisplay } from 'utils/lib/helpers/helpers';
import {
  AddressBookContact,
  AddressBookContactInput,
  formatAddressBookPersonName,
} from 'utils/lib/types/data/address-book';

type AddressPart = keyof NonNullable<AddressBookContact['address']>;
const ADDRESS_PARTS: readonly string[] = ['line1', 'line2', 'city', 'state', 'zip'] satisfies AddressPart[];

export type ContactPart =
  | 'organizationName'
  | 'firstName'
  | 'lastName'
  | 'name'
  | 'credential'
  | AddressPart
  | 'fullAddress'
  | 'phone'
  | 'fax'
  | 'email';

export type ContactFields = Partial<Record<ContactPart, string>>;

const formatAddress = ({ line1, line2, city, state, zip }: NonNullable<AddressBookContact['address']>): string =>
  [line1, line2, city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');

const readPart = (contact: AddressBookContact, part: ContactPart): string => {
  switch (part) {
    case 'name':
      return formatAddressBookPersonName({ firstName: contact.firstName, lastName: contact.lastName });
    case 'fullAddress':
      return contact.address ? formatAddress(contact.address) : '';
    case 'phone':
    case 'fax':
      return formatPhoneNumberDisplay(contact[part]);
    case 'line1':
    case 'line2':
    case 'city':
    case 'state':
    case 'zip':
      return contact.address?.[part] ?? '';
    default:
      return contact[part] ?? '';
  }
};

const STORED_AS: Partial<Record<ContactPart, string>> = { name: 'lastName', fullAddress: 'line1' };

export const useContactFields = (
  fields: ContactFields
): {
  onSelect: (contact: AddressBookContact) => void;
  toContact: () => Partial<AddressBookContactInput>;
} => {
  const { getValues, setValue, getFieldState, trigger } = useFormContext();
  const entries = Object.entries(fields) as [ContactPart, string][];

  const onSelect = (contact: AddressBookContact): void => {
    entries.forEach(([part, name]) => setValue(name, readPart(contact, part), { shouldDirty: true }));
    const withErrors = entries.map(([, name]) => name).filter((name) => getFieldState(name).error);

    if (withErrors.length) void trigger(withErrors);
  };

  const toContact = (): Partial<AddressBookContactInput> => {
    const contact: Record<string, string> = {};
    const address: Record<string, string> = {};

    entries.forEach(([part, name]) => {
      const key = STORED_AS[part] ?? part;
      (ADDRESS_PARTS.includes(key) ? address : contact)[key] = getValues(name) ?? '';
    });

    return Object.keys(address).length ? { ...contact, address } : contact;
  };

  return { onSelect, toContact };
};
