import Oystehr from '@oystehr/sdk';
import { Account, Appointment, Location, Patient, RelatedPerson } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../src/ehr/get-billing-invoice-visit';

const { mockGetInvoiceVisitResources } = vi.hoisted(() => ({ mockGetInvoiceVisitResources: vi.fn() }));

vi.mock('../../src/shared/invoice-visit', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getInvoiceVisitResources: (...args: unknown[]) => mockGetInvoiceVisitResources(...args),
}));

const parent: RelatedPerson = {
  resourceType: 'RelatedPerson',
  id: 'rp',
  patient: { reference: 'Patient/pat-1' },
  name: [{ given: ['Jane'], family: 'Test' }],
  telecom: [
    { system: 'email', value: 'jane@example.com' },
    { system: 'phone', value: '+12025550101' },
  ],
};

const recipientFor = (account: Account): Promise<unknown> => {
  mockGetInvoiceVisitResources.mockResolvedValue({
    patient: {
      resourceType: 'Patient',
      id: 'pat-1',
      name: [{ given: ['Katie'], family: 'Test' }],
      birthDate: '2010-05-04',
      gender: 'female',
    } as Patient,
    account,
    appointment: { resourceType: 'Appointment', start: '2026-07-01T14:00:00.000Z' } as Appointment,
    location: { resourceType: 'Location', name: 'Downtown Clinic' } as Location,
  });
  const portalUser = { resourceType: 'RelatedPerson', telecom: [{ system: 'phone', value: '+12025550199' }] };
  return performEffect(
    {
      fhir: {
        search: async () => ({ unbundle: () => [portalUser] }),
        get: async () => ({ ...parent, id: 'rp-stored' }),
      },
    } as unknown as Oystehr,
    'enc-1'
  );
};

const responsibleParty = { fullName: 'Jane Test', email: 'jane@example.com', phoneNumber: '+12025550101' };

describe('get-billing-invoice-visit', () => {
  it('returns the patient, the responsible party contained in the Account and the visit', async () => {
    const account: Account = {
      resourceType: 'Account',
      status: 'active',
      contained: [parent],
      guarantor: [{ party: { reference: '#rp' } }],
    };

    expect(await recipientFor(account)).toEqual({
      patient: { fullName: 'Katie Test', dob: '05/04/2010', gender: 'Female', phoneNumber: '+12025550199' },
      responsibleParty,
      location: 'Downtown Clinic',
      visitDate: '07/01/2026',
    });
  });

  it('reads a responsible party stored as its own RelatedPerson', async () => {
    const account: Account = {
      resourceType: 'Account',
      status: 'active',
      guarantor: [{ party: { reference: 'RelatedPerson/rp-stored' } }],
    };

    expect(await recipientFor(account)).toMatchObject({ responsibleParty });
  });
});
