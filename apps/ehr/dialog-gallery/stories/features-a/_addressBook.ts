import { AddressBookContact } from 'utils/lib/types/data/address-book';

export const contact: AddressBookContact = {
  id: '5f0c8a8e-3a53-4b7e-9d0a-6f1f5c2f7b11',
  organizationName: 'Riverside Family Medicine',
  firstName: 'Maria',
  lastName: 'Alvarez',
  credential: 'MD',
  title: 'Primary care physician',
  address: { line1: '120 Main Street', line2: 'Suite 4', city: 'Albany', state: 'NY', zip: '12207' },
  phone: '+15185550143',
  fax: '+15185550144',
  email: 'malvarez@riversidefm.example',
  tags: ['pcp'],
} as AddressBookContact;

export const addressBookMocks = [
  { url: 'search-address-book', response: { status: 200, output: { contacts: [contact] } } },
];
