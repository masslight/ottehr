import Oystehr from '@oystehr/sdk';
import { Account, Appointment, Claim, Encounter, Location, Patient, RelatedPerson } from 'fhir/r4b';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { AR_STAGE, CLAIM_STATUS_TAG_SYSTEMS } from 'utils/lib/types/data/billing/claim-status';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { index, performEffect } from '../../../src/billing/get-billing-invoice-recipient';
import type { ZambdaInput } from '../../../src/shared/types/common';

const { mockFlags, mockGetInvoiceVisitResources } = vi.hoisted(() => ({
  mockFlags: { ottehrBillingInvoicingEnabled: true, invoicingInBillingApp: true },
  mockGetInvoiceVisitResources: vi.fn(),
}));

vi.mock('utils/lib/ottehr-config/feature-flags', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  FEATURE_FLAGS_CONFIG: mockFlags,
}));

vi.mock('../../../src/shared/sentry', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock('../../../src/shared/invoice-visit', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getInvoiceVisitResources: (...args: unknown[]) => mockGetInvoiceVisitResources(...args),
}));

const CLAIM_ID = '11111111-1111-4111-8111-111111111111';
const ENCOUNTER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const makeClaim = (patientArStatus = 'ready-to-invoice'): Claim =>
  ({
    resourceType: 'Claim',
    id: CLAIM_ID,
    identifier: [{ system: ottehrIdentifierSystem('claim-encounter-id'), value: ENCOUNTER_ID }],
    meta: {
      tag: [
        { system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.patient },
        { system: CLAIM_STATUS_TAG_SYSTEMS.patientArStatus, code: patientArStatus },
      ],
    },
  }) as Claim;

const patient: Patient = {
  resourceType: 'Patient',
  id: 'pat-1',
  name: [{ given: ['Katie'], family: 'Test' }],
  birthDate: '2010-05-04',
  gender: 'female',
};

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

const account = (guarantor: string, contained?: RelatedPerson[]): Account => ({
  resourceType: 'Account',
  status: 'active',
  contained,
  guarantor: [{ party: { reference: guarantor } }],
});

const visit = (guarantorAccount: Account): Record<string, unknown> => ({
  patient,
  account: guarantorAccount,
  encounter: { resourceType: 'Encounter', id: ENCOUNTER_ID } as Encounter,
  appointment: { resourceType: 'Appointment', start: '2026-07-01T14:00:00.000Z' } as Appointment,
  location: { resourceType: 'Location', id: 'loc-1', name: 'Downtown Clinic' } as Location,
});

const portalUser: RelatedPerson = {
  resourceType: 'RelatedPerson',
  id: 'user-rp',
  patient: { reference: 'Patient/pat-1' },
  telecom: [{ system: 'phone', value: '+12025550199' }],
};

const makeClients = (claim: Claim): { oystehr: Oystehr; clinicalOystehr: Oystehr } => ({
  oystehr: { fhir: { search: vi.fn(async () => ({ unbundle: () => [claim] })) } } as unknown as Oystehr,
  clinicalOystehr: {
    fhir: {
      search: vi.fn(async () => ({ unbundle: () => [portalUser] })),
      get: vi.fn(async () => ({ ...parent, id: 'rp-stored' })),
    },
  } as unknown as Oystehr,
});

describe('get-billing-invoice-recipient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFlags.invoicingInBillingApp = true;
  });

  it('rejects when invoicing does not run in the billing app', async () => {
    mockFlags.invoicingInBillingApp = false;
    const handler = index as unknown as (input: ZambdaInput) => Promise<unknown>;

    await expect(
      handler({
        headers: null,
        body: JSON.stringify({ claimId: CLAIM_ID }),
        secrets: { BILLING_INTEGRATION: 'ottehr' },
      })
    ).rejects.toMatchObject({ message: 'Invoicing is not enabled in the billing app' });
  });

  it('returns the patient, the contained responsible party and the visit', async () => {
    mockGetInvoiceVisitResources.mockResolvedValue(visit(account('#rp', [parent])));
    const { oystehr, clinicalOystehr } = makeClients(makeClaim());

    const result = await performEffect(oystehr, clinicalOystehr, CLAIM_ID);

    expect(mockGetInvoiceVisitResources).toHaveBeenCalledWith(clinicalOystehr, ENCOUNTER_ID);
    expect(result).toEqual({
      patient: { fullName: 'Katie Test', dob: '05/04/2010', gender: 'Female', phoneNumber: '+12025550199' },
      responsibleParty: { fullName: 'Jane Test', email: 'jane@example.com', phoneNumber: '+12025550101' },
      location: 'Downtown Clinic',
      visitDate: '07/01/2026',
    });
  });

  it('shows the patient as the responsible party when they are their own guarantor', async () => {
    mockGetInvoiceVisitResources.mockResolvedValue(visit(account('Patient/pat-1')));
    const { oystehr, clinicalOystehr } = makeClients(makeClaim());

    const result = await performEffect(oystehr, clinicalOystehr, CLAIM_ID);

    expect(result.responsibleParty).toEqual({ fullName: 'Katie Test', email: undefined, phoneNumber: undefined });
  });

  it('reads a responsible party stored as its own RelatedPerson', async () => {
    mockGetInvoiceVisitResources.mockResolvedValue(visit(account('RelatedPerson/rp-stored')));
    const { oystehr, clinicalOystehr } = makeClients(makeClaim());

    const result = await performEffect(oystehr, clinicalOystehr, CLAIM_ID);

    expect(clinicalOystehr.fhir.get).toHaveBeenCalledWith({ resourceType: 'RelatedPerson', id: 'rp-stored' });
    expect(result.responsibleParty).toEqual({
      fullName: 'Jane Test',
      email: 'jane@example.com',
      phoneNumber: '+12025550101',
    });
  });

  it('rejects a claim that cannot be invoiced before reading clinical data', async () => {
    const { oystehr, clinicalOystehr } = makeClients(makeClaim('not-invoiced'));

    await expect(performEffect(oystehr, clinicalOystehr, CLAIM_ID)).rejects.toMatchObject({
      message: 'Only Patient AR claims that are ready to invoice, invoiced or finalized can be invoiced',
    });
    expect(mockGetInvoiceVisitResources).not.toHaveBeenCalled();
  });
});
