import { Claim, Invoice, Patient, Person } from 'fhir/r4b';
import { buildBillingInvoice, withHostedInvoiceUrl } from 'utils/lib/fhir/billing-invoice';
import { describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../../src/billing/search-billing-invoices';
import { OystehrMock } from '../../helpers/oystehr-mock';

const patient: Patient = {
  resourceType: 'Patient',
  id: 'pat-1',
  name: [{ given: ['Sam'], family: 'Patientlastname' }],
};

const claim = {
  resourceType: 'Claim',
  id: 'claim-1',
  item: [{ sequence: 1, servicedDate: '2026-09-20', productOrService: { text: '99213' } }],
} as Claim;

const sentInvoice = (id: string): Invoice => ({
  ...withHostedInvoiceUrl(
    buildBillingInvoice({
      status: 'issued',
      date: '2026-10-29T15:00:00.000Z',
      dueDate: '2026-11-05',
      recipient: { reference: 'Patient/pat-1' },
      subject: { reference: 'Patient/pat-1' },
      claims: [{ claimId: 'claim-1', amountCents: 350 }],
    }),
    `https://pay.test/${id}`
  ),
  id,
});

const makeOystehr = (
  invoices: Invoice[],
  patients: Patient[] = [],
  persons: Person[] = []
): { oystehr: OystehrMock; search: ReturnType<typeof vi.fn> } => {
  const search = vi.fn(
    async ({ resourceType, params }: { resourceType: string; params: { name: string; value: string }[] }) => {
      if (resourceType === 'Invoice') return { total: invoices.length, unbundle: () => [...invoices, patient] };
      if (resourceType === 'Claim') return { unbundle: () => [claim] };
      if (resourceType === 'Person') return { unbundle: () => persons };
      const id = params.find((param) => param.name === '_id')?.value;
      return { unbundle: () => patients.filter((patient) => patient.id === id) };
    }
  );
  return { oystehr: { fhir: { search } } as unknown as OystehrMock, search };
};

describe('search-billing-invoices', () => {
  it('lists sent invoices newest first with their patient, claim and Stripe page', async () => {
    const { oystehr, search } = makeOystehr([sentInvoice('inv-1')]);

    const result = await performEffect(oystehr, { secrets: {} });

    expect(result).toEqual({
      invoices: [
        {
          id: 'inv-1',
          status: 'issued',
          issueDate: '2026-10-29T15:00:00.000Z',
          dueDate: '2026-11-05',
          amount: 3.5,
          patientId: 'pat-1',
          patientName: 'Patientlastname, Sam',
          claimId: 'claim-1',
          serviceDate: '2026-09-20',
          hostedInvoiceUrl: 'https://pay.test/inv-1',
        },
      ],
      total: 1,
      offset: 0,
      pageSize: 25,
    });
    expect(search).toHaveBeenCalledWith({
      resourceType: 'Invoice',
      params: expect.arrayContaining([
        { name: 'status', value: 'issued,balanced,cancelled' },
        { name: '_include', value: 'Invoice:patient' },
        { name: '_sort', value: '-date' },
      ]),
    });
    expect(search).toHaveBeenCalledWith({
      resourceType: 'Claim',
      params: [
        { name: '_id', value: 'claim-1' },
        { name: '_count', value: '1' },
      ],
    });
  });

  it('filters by status, patient name, facility and issue date and asks for the requested page', async () => {
    const { oystehr, search } = makeOystehr([]);

    await performEffect(oystehr, {
      status: 'balanced',
      searchText: 'sam',
      facilityId: 'facility-1',
      issuedFrom: '2026-10-01',
      issuedTo: '2026-10-31',
      offset: 50,
      pageSize: 25,
      secrets: {},
    });

    expect(search).toHaveBeenCalledWith({
      resourceType: 'Invoice',
      params: expect.arrayContaining([
        { name: 'status', value: 'balanced' },
        { name: 'patient.name', value: 'sam' },
        { name: '_tag', value: 'https://fhir.ottehr.com/billing/invoice-facility-id|facility-1' },
        { name: 'date', value: 'ge2026-10-01' },
        { name: 'date', value: 'le2026-10-31' },
        { name: '_count', value: '25' },
        { name: '_offset', value: '50' },
      ]),
    });
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('finds the invoice for a claim ID instead of searching names', async () => {
    const { oystehr, search } = makeOystehr([]);

    await performEffect(oystehr, { searchText: '1BABF4BA-EA5D-480E-AD6C-3F3C3F5B30E3', secrets: {} });

    const [{ params }] = search.mock.calls.find(([input]) => input.resourceType === 'Invoice')!;
    expect(params).toContainEqual({
      name: '_tag',
      value: 'https://fhir.ottehr.com/billing/invoice-claim-id|1babf4ba-ea5d-480e-ad6c-3f3c3f5b30e3',
    });
    expect(params).not.toContainEqual(expect.objectContaining({ name: 'patient.name' }));
  });

  it('finds invoices across billing patient copies by Billing patient UUID', async () => {
    const mainPatientId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const mainPatient: Patient = {
      resourceType: 'Patient',
      id: mainPatientId,
    };
    const linkedPatient: Person = {
      resourceType: 'Person',
      link: [{ target: { reference: `Patient/${mainPatientId}` } }, { target: { reference: 'Patient/pat-1' } }],
    };
    const { oystehr, search } = makeOystehr([sentInvoice('inv-1')], [mainPatient], [linkedPatient]);

    const result = await performEffect(oystehr, { searchText: mainPatientId.toUpperCase(), secrets: {} });

    expect(result.invoices).toHaveLength(1);
    expect(search).toHaveBeenCalledWith({
      resourceType: 'Invoice',
      params: expect.arrayContaining([{ name: 'patient', value: `Patient/${mainPatientId},Patient/pat-1` }]),
    });
    const [{ params }] = search.mock.calls.find(([input]) => input.resourceType === 'Invoice')!;
    expect(params).not.toContainEqual(expect.objectContaining({ name: 'patient.name' }));
    expect(params).not.toContainEqual(expect.objectContaining({ name: '_tag' }));
  });
});
