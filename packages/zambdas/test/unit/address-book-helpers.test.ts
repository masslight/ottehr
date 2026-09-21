import { Organization } from 'fhir/r4b';
import {
  ADDRESS_BOOK_TAG_CODE,
  ADDRESS_BOOK_TAG_SYSTEM,
  AddressBookContactInput,
} from 'utils/lib/types/data/address-book';
import { describe, expect, test } from 'vitest';
import {
  buildAddressBookOrganization,
  isAddressBookOrganization,
  mapAddressBookContact,
} from '../../src/ehr/address-book/helpers';

const fullInput: AddressBookContactInput = {
  firstName: 'Jane',
  lastName: 'Doe',
  credential: 'MD',
  organizationName: 'Springfield Cardiology',
  address: { line1: '1 Main St', line2: 'Suite 2', city: 'Springfield', state: 'IL', zip: '62701' },
  phone: '(212) 555-1234',
  fax: '2125554321',
  email: 'jane@example.com',
  tags: ['cardiology', 'referral'],
};

describe('address-book helpers', () => {
  test('round-trips a person at an organization', () => {
    const org = buildAddressBookOrganization(fullInput);

    expect(org.name).toBe('Springfield Cardiology');
    expect(org.alias).toEqual(['Jane Doe, MD']);
    expect(org.contact?.[0]?.name).toEqual({ given: ['Jane'], family: 'Doe', suffix: ['MD'] });
    expect(org.address?.[0]?.line).toEqual(['1 Main St', 'Suite 2']);
    expect(org.telecom).toEqual([
      { system: 'phone', value: '+12125551234' },
      { system: 'fax', value: '+12125554321' },
      { system: 'email', value: 'jane@example.com' },
    ]);
    expect(isAddressBookOrganization(org)).toBe(true);

    expect(mapAddressBookContact({ ...org, id: 'org-1' })).toEqual({
      ...fullInput,
      id: 'org-1',
      phone: '+12125551234',
      fax: '+12125554321',
    });
  });

  test('org-only contact has no alias or contact and maps back without a person', () => {
    const org = buildAddressBookOrganization({ organizationName: 'Acme Imaging' });

    expect(org.name).toBe('Acme Imaging');
    expect(org.alias).toBeUndefined();
    expect(org.contact).toBeUndefined();
    expect(org.address).toBeUndefined();
    expect(org.telecom).toBeUndefined();

    const contact = mapAddressBookContact({ ...org, id: 'org-2' });
    expect(contact.organizationName).toBe('Acme Imaging');
    expect(contact.lastName).toBeUndefined();
    expect(contact.tags).toEqual([]);
  });

  test('person-only contact uses the person display as the name and maps back without an organization', () => {
    const org = buildAddressBookOrganization({ firstName: 'John', lastName: 'Smith' });

    expect(org.name).toBe('John Smith');
    expect(org.alias).toBeUndefined();

    const contact = mapAddressBookContact({ ...org, id: 'org-3' });
    expect(contact.organizationName).toBeUndefined();
    expect(contact.firstName).toBe('John');
    expect(contact.lastName).toBe('Smith');
  });

  test('keeps meta tags from other systems when rebuilding an existing contact', () => {
    const existing: Organization = {
      resourceType: 'Organization',
      id: 'org-4',
      meta: {
        versionId: '3',
        tag: [
          { system: 'https://example.com/other', code: 'keep-me' },
          { system: ADDRESS_BOOK_TAG_SYSTEM, code: ADDRESS_BOOK_TAG_CODE },
          { system: 'https://fhir.ottehr.com/CodeSystem/address-book-tag', code: 'old-tag' },
        ],
      },
      name: 'Old Name',
    };

    const org = buildAddressBookOrganization({ organizationName: 'New Name', tags: ['new-tag'] }, existing);

    expect(org.id).toBe('org-4');
    expect(org.meta?.tag).toEqual([
      { system: 'https://example.com/other', code: 'keep-me' },
      { system: ADDRESS_BOOK_TAG_SYSTEM, code: ADDRESS_BOOK_TAG_CODE },
      { system: 'https://fhir.ottehr.com/CodeSystem/address-book-tag', code: 'new-tag' },
    ]);
    expect(mapAddressBookContact(org).tags).toEqual(['new-tag']);
  });

  test('isAddressBookOrganization rejects organizations without the marker tag', () => {
    expect(isAddressBookOrganization({ resourceType: 'Organization', name: 'Employer' })).toBe(false);
  });
});
