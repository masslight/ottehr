import Oystehr from '@oystehr/sdk';
import { Claim, Invoice, Organization, Patient, Person } from 'fhir/r4b';
import {
  buildBillingInvoice,
  INVOICE_NUMBER_IDENTIFIER_SYSTEM,
  withHostedInvoiceUrl,
} from 'utils/lib/fhir/billing-invoice';
import { describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../../src/billing/search-billing-invoices';

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

const nio: Organization = {
  resourceType: 'Organization',
  id: 'nio-1',
  name: 'Acme Health Services',
};

const nioInvoice = (id: string): Invoice => ({
  ...buildBillingInvoice({
    status: 'issued',
    date: '2026-10-03T15:00:00.000Z',
    dueDate: '2026-10-10',
    recipient: {
      reference: 'Organization/nio-1',
    },
    claims: [
      {
        claimId: 'claim-1',
        amountCents: 18000,
      },
      {
        claimId: 'claim-2',
        amountCents: 14000,
      },
    ],
  }),
  id,
  identifier: [
    {
      system: INVOICE_NUMBER_IDENTIFIER_SYSTEM,
      value: 'INV-00042',
    },
  ],
});

const makeOystehr = (
  invoices: Invoice[],
  patients: Patient[] = [],
  persons: Person[] = [],
  organizations: Organization[] = []
): { oystehr: Oystehr; search: ReturnType<typeof vi.fn> } => {
  const search = vi.fn(
    async ({ resourceType, params }: { resourceType: string; params: { name: string; value: string }[] }) => {
      if (resourceType === 'Invoice') {
        return {
          total: invoices.length,
          unbundle: () => [...invoices, patient, ...organizations],
        };
      }
      if (resourceType === 'Claim') return { unbundle: () => [claim] };
      if (resourceType === 'Person') return { unbundle: () => persons };
      const id = params.find((param) => param.name === '_id')?.value;
      return { unbundle: () => patients.filter((patient) => patient.id === id) };
    }
  );
  return { oystehr: { fhir: { search } } as unknown as Oystehr, search };
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
          kind: 'patient',
          recipient: undefined,
          pastDue: false,
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

  it('lists NIO invoices with their payer and past-due flag', async () => {
    const { oystehr, search } = makeOystehr([nioInvoice('inv-nio')], [], [], [nio]);

    const result = await performEffect(oystehr, {
      secrets: {},
    });

    expect(result.invoices).toEqual([
      {
        id: 'inv-nio',
        status: 'issued',
        issueDate: '2026-10-03T15:00:00.000Z',
        dueDate: '2026-10-10',
        amount: 320,
        hostedInvoiceUrl: undefined,
        patientId: undefined,
        patientName: '',
        claimId: undefined,
        serviceDate: '',
        kind: 'nio',
        recipient: {
          id: 'nio-1',
          name: 'Acme Health Services',
        },
        pastDue: true,
      },
    ]);
    expect(search).not.toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'PaymentNotice',
      })
    );
    expect(search).not.toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'Claim',
      })
    );
  });

  it('lists both patient and NIO invoices when no kind is given', async () => {
    const { oystehr, search } = makeOystehr([]);

    await performEffect(oystehr, {
      secrets: {},
    });

    const [{ params }] = search.mock.calls.find(([input]) => input.resourceType === 'Invoice')!;
    expect(params).not.toContainEqual(
      expect.objectContaining({
        name: 'subject:missing',
      })
    );
    expect(params).toContainEqual({
      name: '_include',
      value: 'Invoice:recipient',
    });
  });

  it.each([
    ['nio', 'true'],
    ['patient', 'false'],
  ] as const)('filters %s invoices by whether they have a patient subject', async (kind, missing) => {
    const { oystehr, search } = makeOystehr([]);

    await performEffect(oystehr, {
      kind,
      secrets: {},
    });

    const [{ params }] = search.mock.calls.find(([input]) => input.resourceType === 'Invoice')!;
    expect(params).toContainEqual({
      name: 'subject:missing',
      value: missing,
    });
  });

  it.each([
    ['nio', 'Organization/rec-1'],
    ['patient', 'Patient/rec-1,RelatedPerson/rec-1'],
    [undefined, 'Organization/rec-1,Patient/rec-1,RelatedPerson/rec-1'],
  ] as const)('filters %s invoices by recipient as %s', async (kind, recipient) => {
    const { oystehr, search } = makeOystehr([]);

    await performEffect(oystehr, {
      kind,
      recipientId: 'rec-1',
      secrets: {},
    });

    const [{ params }] = search.mock.calls.find(([input]) => input.resourceType === 'Invoice')!;
    expect(params).toContainEqual({
      name: 'recipient',
      value: recipient,
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
