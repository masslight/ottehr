import Oystehr from '@oystehr/sdk';
import { Organization, ServiceRequest } from 'fhir/r4b';
import { REFERRAL_ORDER_TYPE_TAG, REFERRAL_ORDER_TYPE_TAG_TOKEN, withReferralDetails } from 'utils/lib/fhir/referral';
import { ReferralStatus } from 'utils/lib/types/api/referrals/referrals.types';
import {
  ADDRESS_BOOK_TAG_CODE,
  ADDRESS_BOOK_TAG_SYSTEM,
  AddressBookContactInput,
} from 'utils/lib/types/data/address-book';
import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, test, vi } from 'vitest';
import {
  assertContactNotReferralRecipient,
  buildAddressBookOrganization,
  getAddressBookOrganizationOrThrow,
  isAddressBookOrganization,
  mapAddressBookContact,
} from '../../src/ehr/address-book/helpers';

/** The shape `@oystehr/sdk` throws for a missing resource: the HTTP status on `code`. */
const notFoundError = Object.assign(new Error('Resource not found'), { code: 404 });
const oystehrWhoseGet = (get: () => Promise<Organization>): Oystehr =>
  ({ fhir: { get: vi.fn(get) } }) as unknown as Oystehr;

const fullInput: AddressBookContactInput = {
  firstName: 'Jane',
  lastName: 'Doe',
  credential: 'MD',
  title: 'Medical Director',
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
    expect(org.contact?.[0]?.purpose).toEqual({ text: 'Medical Director' });
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

  test('keeps a title given without a person', () => {
    const org = buildAddressBookOrganization({ organizationName: 'Acme Corp', title: 'HR Department' });

    expect(org.contact).toEqual([{ purpose: { text: 'HR Department' } }]);
    expect(org.alias).toBeUndefined();

    const contact = mapAddressBookContact({ ...org, id: 'org-4' });
    expect(contact.title).toBe('HR Department');
    expect(contact.organizationName).toBe('Acme Corp');
    expect(contact.lastName).toBeUndefined();
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

  describe('getAddressBookOrganizationOrThrow', () => {
    test('returns the contact organization', async () => {
      const org = { ...buildAddressBookOrganization({ organizationName: 'Acme' }), id: 'org-5' };

      await expect(
        getAddressBookOrganizationOrThrow(
          oystehrWhoseGet(async () => org),
          'org-5'
        )
      ).resolves.toBe(org);
    });

    test('turns a FHIR not-found into a structured not-found error rather than a 500', async () => {
      const oystehr = oystehrWhoseGet(() => Promise.reject(notFoundError));

      await expect(getAddressBookOrganizationOrThrow(oystehr, 'gone')).rejects.toMatchObject({
        code: APIErrorCode.FHIR_RESOURCE_NOT_FOUND,
        message: 'Contact gone not found',
      });
    });

    test('lets other FHIR failures propagate untouched', async () => {
      const failure = new Error('boom');

      await expect(
        getAddressBookOrganizationOrThrow(
          oystehrWhoseGet(() => Promise.reject(failure)),
          'x'
        )
      ).rejects.toBe(failure);
    });

    test('rejects an organization that is not an address book contact', async () => {
      const employer: Organization = { resourceType: 'Organization', id: 'org-6', name: 'Employer' };

      await expect(
        getAddressBookOrganizationOrThrow(
          oystehrWhoseGet(async () => employer),
          'org-6'
        )
      ).rejects.toMatchObject({ code: APIErrorCode.INVALID_INPUT });
    });
  });

  describe('assertContactNotReferralRecipient', () => {
    const referral = (id: string, status: ReferralStatus): ServiceRequest =>
      withReferralDetails(
        {
          resourceType: 'ServiceRequest',
          id,
          status: 'active',
          intent: 'order',
          meta: { tag: [{ ...REFERRAL_ORDER_TYPE_TAG }] },
          subject: { reference: 'Patient/patient-1' },
          performer: [{ reference: 'Organization/contact-1' }],
        },
        { status }
      );
    const oystehrWithReferrals = (
      referrals: ServiceRequest[]
    ): { oystehr: Oystehr; search: ReturnType<typeof vi.fn> } => {
      const search = vi.fn().mockResolvedValue({
        entry: referrals.map((resource) => ({ resource, search: { mode: 'match' } })),
        total: referrals.length,
        unbundle: () => referrals,
      });
      return { oystehr: { fhir: { search } } as unknown as Oystehr, search };
    };

    test('refuses, counting every referral that is not cancelled, so open and closed referrals keep their recipient', async () => {
      const { oystehr, search } = oystehrWithReferrals([
        referral('sr-1', 'sent'),
        referral('sr-2', 'closed'),
        referral('sr-3', 'cancelled'),
      ]);

      await expect(assertContactNotReferralRecipient(oystehr, 'contact-1')).rejects.toEqual({
        code: APIErrorCode.INVALID_INPUT,
        message: "This contact is the recipient of 2 referrals and can't be deleted.",
      });
      expect(search.mock.calls[0][0].params).toEqual(
        expect.arrayContaining([
          { name: 'performer', value: 'Organization/contact-1' },
          { name: '_tag', value: REFERRAL_ORDER_TYPE_TAG_TOKEN },
        ])
      );
    });

    test('names a single referral in the singular', async () => {
      const { oystehr } = oystehrWithReferrals([referral('sr-1', 'not-sent')]);

      await expect(assertContactNotReferralRecipient(oystehr, 'contact-1')).rejects.toMatchObject({
        message: "This contact is the recipient of 1 referral and can't be deleted.",
      });
    });

    test('allows deleting a contact whose referrals were all cancelled', async () => {
      const { oystehr } = oystehrWithReferrals([referral('sr-1', 'cancelled')]);

      await expect(assertContactNotReferralRecipient(oystehr, 'contact-1')).resolves.toBeUndefined();
    });

    test('allows deleting a contact no referral names', async () => {
      const { oystehr } = oystehrWithReferrals([]);

      await expect(assertContactNotReferralRecipient(oystehr, 'contact-1')).resolves.toBeUndefined();
    });
  });
});
