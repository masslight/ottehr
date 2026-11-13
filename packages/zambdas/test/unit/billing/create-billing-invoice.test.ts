import Oystehr from '@oystehr/sdk';
import { Claim, Invoice, Location, Organization, ProvenanceAgent } from 'fhir/r4b';
import Stripe from 'stripe';
import {
  buildBillingInvoice,
  getHostedInvoiceUrl,
  getInvoiceNumber,
  INVOICE_CLAIM_TAG_SYSTEM,
  INVOICE_FACILITY_TAG_SYSTEM,
  INVOICE_NUMBER_IDENTIFIER_SYSTEM,
  withStripeInvoiceLink,
} from 'utils/lib/fhir/billing-invoice';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import {
  PREPARE_BILLING_INVOICE_ZAMBDA_KEY,
  PrepareBillingInvoiceResponse,
  SEND_BILLING_INVOICE_SMS_ZAMBDA_KEY,
} from 'utils/lib/types/api/invoicing.types';
import { AR_STAGE, CLAIM_STATUS_TAG_SYSTEMS } from 'utils/lib/types/data/billing/claim-status';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../../src/billing/create-billing-invoice';
import { SOURCE_IDENTIFIER_SYSTEM } from '../../../src/billing/shared';

const {
  mockApplyClaimStatusField,
  mockGetOrCreateInvoicingConfig,
  mockIssueInvoiceNumber,
  mockProduceOutreach,
  mockSendErrors,
} = vi.hoisted(() => ({
  mockApplyClaimStatusField: vi.fn(),
  mockGetOrCreateInvoicingConfig: vi.fn(),
  mockIssueInvoiceNumber: vi.fn(),
  mockProduceOutreach: vi.fn(),
  mockSendErrors: vi.fn(),
}));

vi.mock('../../../src/billing/invoice-number', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  issueInvoiceNumber: (...args: unknown[]) => mockIssueInvoiceNumber(...args),
}));

vi.mock('../../../src/shared/sentry', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));
vi.mock('../../../src/billing/provenance', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  applyClaimStatusField: (...args: unknown[]) => mockApplyClaimStatusField(...args),
}));
vi.mock('../../../src/rcm/invoice-config/helpers', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getOrCreateInvoicingConfig: (...args: unknown[]) => mockGetOrCreateInvoicingConfig(...args),
}));
vi.mock('../../../src/shared/errors', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  sendErrors: (...args: unknown[]) => mockSendErrors(...args),
}));
vi.mock('../../../src/billing/invoice-outreach', () => ({
  produceBillingInvoiceIssuedOutreach: (...args: unknown[]) => mockProduceOutreach(...args),
}));

const CLAIM_ID = '11111111-1111-4111-8111-111111111111';
const ENCOUNTER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const agent: ProvenanceAgent = { who: { reference: 'Practitioner/biller' } };
const facility: Location = {
  resourceType: 'Location',
  id: 'facility-1',
  name: 'Main Clinic',
  address: { line: ['1 Clinic Way'] },
  managingOrganization: { reference: 'Organization/facility-org' },
};
const billingProvider: Organization = {
  resourceType: 'Organization',
  id: 'provider-1',
  name: 'Medical Group',
  address: [{ line: ['2 Provider Way'] }],
};
const visit: PrepareBillingInvoiceResponse = {
  patientId: 'pat-1',
  stripeCustomerId: 'cus_1',
  stripeAccount: 'acct_1',
  timezone: 'America/New_York',
  placeholders: { patientFullName: 'Katie Test', visitDate: '07/01/2026' },
};

type Params = Parameters<typeof performEffect>[2];
const params: Params = {
  claimId: CLAIM_ID,
  amountCents: 5000,
  dueDate: '2099-12-31',
  smsMessage: 'Pay here {{invoice-link}}',
  memo: 'Visit on {{visit-date}}',
  idempotencyKey: 'key-1',
  secrets: { BILLING_INTEGRATION: 'ottehr', INVOICING_IN_BILLING_APP: 'true', ENVIRONMENT: 'local' },
};

const makeClaim = (patientArStatus = 'ready-to-invoice'): Claim =>
  ({
    resourceType: 'Claim',
    id: CLAIM_ID,
    patient: { reference: 'Patient/billing-pat-1' },
    facility: { reference: 'Location/facility-copy-1' },
    provider: { reference: 'Organization/provider-1' },
    identifier: [{ system: ottehrIdentifierSystem('claim-encounter-id'), value: ENCOUNTER_ID }],
    meta: {
      tag: [
        { system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.patient },
        { system: CLAIM_STATUS_TAG_SYSTEMS.patientArStatus, code: patientArStatus },
      ],
    },
  }) as Claim;

// The claim's copy of service facility facility-1.
const facilityCopy: Location = {
  ...facility,
  id: 'facility-copy-1',
  extension: [{ url: SOURCE_IDENTIFIER_SYSTEM, valueReference: { reference: 'Location/facility-1' } }],
};

// An invoice an earlier request left for the claim, linked to Stripe invoice in_old.
const existingInvoice = (status: Invoice['status'], key: string): Invoice =>
  withStripeInvoiceLink(
    {
      ...buildBillingInvoice({
        status,
        date: '2026-10-01T00:00:00.000Z',
        dueDate: '2099-12-31',
        issuer: { reference: 'Organization/original-issuer' },
        recipient: { reference: 'Patient/billing-pat-1' },
        claims: [{ claimId: CLAIM_ID, amountCents: 5000 }],
      }),
      id: 'inv-old',
      meta: { tag: [{ system: INVOICE_CLAIM_TAG_SYSTEM, code: CLAIM_ID }], versionId: '1' },
      identifier: [
        { system: ottehrIdentifierSystem('billing-invoice-idempotency-key'), value: key },
        { system: INVOICE_NUMBER_IDENTIFIER_SYSTEM, value: 'INV-00007' },
      ],
    },
    { stripeInvoiceId: 'in_old', stripeAccount: 'acct_1' }
  );

// Conditional create returns the claim's open invoice, and updates must name the current version.
const makeOystehr = (
  claim: Claim,
  existing: Invoice[] = []
): { oystehr: Oystehr; invoices: Invoice[]; execute: ReturnType<typeof vi.fn> } => {
  const invoices = [...existing];
  const create = vi.fn(async (invoice: Invoice) => {
    const open = invoices.find((stored) => ['draft', 'issued', 'balanced'].includes(stored.status));
    if (open) return open;
    const created = { ...invoice, id: `inv-${invoices.length + 1}`, meta: { ...invoice.meta, versionId: '1' } };
    invoices.push(created);
    return created;
  });
  const update = vi.fn(async (invoice: Invoice, options?: { optimisticLockingVersionId?: string }) => {
    const position = invoices.findIndex((stored) => stored.id === invoice.id);
    if (invoices[position].meta?.versionId !== options?.optimisticLockingVersionId) throw new Error('version conflict');
    invoices[position] = {
      ...invoice,
      meta: { ...invoice.meta, versionId: String(Number(invoice.meta?.versionId) + 1) },
    };
    return invoices[position];
  });
  const execute = vi.fn(async ({ id }: { id: string }) => ({
    output: id === PREPARE_BILLING_INVOICE_ZAMBDA_KEY ? visit : { message: 'ok' },
  }));
  const search = vi.fn(async ({ resourceType }: { resourceType: string }) => ({
    unbundle: () => (resourceType === 'Location' ? [facilityCopy] : [claim, facilityCopy, billingProvider]),
  }));
  return {
    oystehr: { fhir: { search, create, update }, zambda: { execute } } as unknown as Oystehr,
    invoices,
    execute,
  };
};

type StripeInvoiceStub = Pick<Stripe.Invoice, 'id' | 'status'> & { lines: { data: unknown[] } };
const makeStripe = (
  existing?: StripeInvoiceStub
): {
  stripe: Stripe;
  invoices: Record<string, ReturnType<typeof vi.fn>>;
  invoiceItems: { create: ReturnType<typeof vi.fn> };
} => {
  const stored = new Map(existing ? [[existing.id, existing]] : []);
  const invoices = {
    create: vi.fn(async () => {
      stored.set('in_new', { id: 'in_new', status: 'draft', lines: { data: [] } });
      return stored.get('in_new');
    }),
    retrieve: vi.fn(async (id: string) => stored.get(id)),
    finalizeInvoice: vi.fn(async (id: string) => {
      stored.set(id, { ...stored.get(id)!, status: 'open' });
      return stored.get(id);
    }),
    sendInvoice: vi.fn(async (id: string) => ({ ...stored.get(id), hosted_invoice_url: `https://pay.test/${id}` })),
  };
  const invoiceItems = { create: vi.fn(async () => ({ id: 'ii_1' })) };
  return { stripe: { invoices, invoiceItems } as unknown as Stripe, invoices, invoiceItems };
};

describe('create-billing-invoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrCreateInvoicingConfig.mockResolvedValue({ questionnaireResponse: {} });
    mockIssueInvoiceNumber.mockResolvedValue('INV-00042');
  });

  it('creates, sends and links an invoice, then moves a ready claim to Invoiced', async () => {
    const claim = makeClaim();
    const { oystehr, invoices, execute } = makeOystehr(claim);
    const { stripe, invoices: stripeInvoices, invoiceItems } = makeStripe();

    const result = await performEffect(oystehr, stripe, params, agent);

    expect(result).toEqual({ invoiceId: 'inv-1', stripeInvoiceId: 'in_new', smsSent: true });
    expect(invoices[0].status).toBe('issued');
    expect(invoices[0].meta?.tag).toContainEqual({ system: INVOICE_FACILITY_TAG_SYSTEM, code: 'facility-1' });
    expect(getHostedInvoiceUrl(invoices[0])).toBe('https://pay.test/in_new');
    expect(invoices[0].issuer).toEqual({ reference: 'Organization/facility-org' });
    expect(getInvoiceNumber(invoices[0])).toBe('INV-00042');
    expect(mockIssueInvoiceNumber).toHaveBeenCalledWith(oystehr);
    expect(oystehr.fhir.search).toHaveBeenCalledWith({
      resourceType: 'Claim',
      params: [
        { name: '_id', value: CLAIM_ID },
        { name: '_include', value: 'Claim:provider' },
        { name: '_include', value: 'Claim:facility' },
      ],
    });
    expect(stripeInvoices.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_1',
        description: 'Visit on Wednesday, July 1, 2026',
        metadata: { oystehr_invoice_id: 'inv-1', oystehr_encounter_id: ENCOUNTER_ID, oystehr_patient_id: 'pat-1' },
      }),
      { stripeAccount: 'acct_1', idempotencyKey: 'billing-invoice-inv-1' }
    );
    expect(invoiceItems.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5000, invoice: 'in_new' }),
      expect.anything()
    );
    expect(stripeInvoices.sendInvoice).toHaveBeenCalledWith('in_new', undefined, {
      stripeAccount: 'acct_1',
      idempotencyKey: 'billing-invoice-send-inv-1',
    });
    expect(execute).toHaveBeenCalledWith({
      id: SEND_BILLING_INVOICE_SMS_ZAMBDA_KEY,
      encounterId: ENCOUNTER_ID,
      message: 'Pay here https://pay.test/in_new',
    });
    expect(mockApplyClaimStatusField).toHaveBeenCalledWith(oystehr, claim, 'patientArStatus', 'invoiced', agent);
    expect(mockProduceOutreach).toHaveBeenCalledWith(oystehr, invoices[0]);
  });

  it('reports the invoice as sent when scheduling outreach fails', async () => {
    const outreachError = new Error('FHIR unavailable');
    mockProduceOutreach.mockRejectedValueOnce(outreachError);
    const { oystehr, invoices } = makeOystehr(makeClaim());

    const result = await performEffect(oystehr, makeStripe().stripe, params, agent);

    expect(result).toEqual({ invoiceId: 'inv-1', stripeInvoiceId: 'in_new', smsSent: true });
    expect(invoices[0].status).toBe('issued');
    expect(mockApplyClaimStatusField).toHaveBeenCalled();
    expect(mockSendErrors).toHaveBeenCalledWith(outreachError, 'local', { invoiceId: 'inv-1' });
  });

  it('schedules missed outreach when a sent invoice is retried, without sending it again', async () => {
    const { oystehr, invoices, execute } = makeOystehr(makeClaim('invoiced'), [existingInvoice('issued', 'key-1')]);
    const { stripe, invoices: stripeInvoices } = makeStripe();

    await performEffect(oystehr, stripe, params, agent);

    expect(mockProduceOutreach).toHaveBeenCalledWith(oystehr, invoices[0]);
    expect(invoices[0].date).toBe('2026-10-01T00:00:00.000Z');
    expect(stripeInvoices.sendInvoice).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalledWith(expect.objectContaining({ id: SEND_BILLING_INVOICE_SMS_ZAMBDA_KEY }));
  });

  it('counts outreach from when the invoice is sent, not from when its draft was created', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T07:00:00.000Z'));
    try {
      const { oystehr, invoices } = makeOystehr(makeClaim(), [existingInvoice('draft', 'key-1')]);
      const { stripe } = makeStripe({ id: 'in_old', status: 'draft', lines: { data: [{}] } });

      await performEffect(oystehr, stripe, params, agent);

      expect(invoices[0].status).toBe('issued');
      expect(invoices[0].date).toBe('2026-10-01T07:00:00.000Z');
      expect(mockProduceOutreach).toHaveBeenCalledWith(oystehr, invoices[0]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('schedules no outreach for an invoice Stripe reports as already paid', async () => {
    const { oystehr, invoices } = makeOystehr(makeClaim(), [existingInvoice('draft', 'key-1')]);
    const { stripe } = makeStripe({ id: 'in_old', status: 'paid', lines: { data: [{}] } });

    await performEffect(oystehr, stripe, params, agent);

    expect(invoices[0].status).toBe('balanced');
    expect(mockProduceOutreach).not.toHaveBeenCalled();
  });

  it('resumes its own draft without creating another Stripe invoice or item', async () => {
    const { oystehr, invoices } = makeOystehr(makeClaim(), [existingInvoice('draft', 'key-1')]);
    const {
      stripe,
      invoices: stripeInvoices,
      invoiceItems,
    } = makeStripe({
      id: 'in_old',
      status: 'draft',
      lines: { data: [{}] },
    });

    await performEffect(oystehr, stripe, params, agent);

    expect(stripeInvoices.create).not.toHaveBeenCalled();
    expect(invoiceItems.create).not.toHaveBeenCalled();
    expect(invoices[0].status).toBe('issued');
    expect(invoices[0].issuer).toEqual({ reference: 'Organization/original-issuer' });
    expect(getInvoiceNumber(invoices[0])).toBe('INV-00007');
    expect(mockIssueInvoiceNumber).not.toHaveBeenCalled();
  });

  it('uses the billing provider when selected in invoicing configuration', async () => {
    mockGetOrCreateInvoicingConfig.mockResolvedValue({
      questionnaireResponse: {
        item: [
          {
            linkId: 'invoicing',
            item: [{ linkId: 'invoicing.invoiceIssuerSource', answer: [{ valueString: 'billing-provider' }] }],
          },
        ],
      },
    });
    const { oystehr, invoices } = makeOystehr(makeClaim());

    await performEffect(oystehr, makeStripe().stripe, params, agent);

    expect(invoices[0].issuer).toEqual({ reference: 'Organization/provider-1' });
  });

  it('rejects a missing issuer before preparing or sending the invoice', async () => {
    const { oystehr, invoices, execute } = makeOystehr({ ...makeClaim(), facility: undefined });
    const { stripe, invoices: stripeInvoices } = makeStripe();

    await expect(performEffect(oystehr, stripe, params, agent)).rejects.toMatchObject({
      message: 'The claim has no service facility to send the invoice from',
    });

    expect(invoices).toHaveLength(0);
    expect(execute).not.toHaveBeenCalled();
    expect(stripeInvoices.create).not.toHaveBeenCalled();
  });

  it('keeps the saved invoice number when Stripe creation fails and is retried', async () => {
    const { oystehr, invoices } = makeOystehr(makeClaim());
    const { stripe, invoices: stripeInvoices } = makeStripe();
    stripeInvoices.create.mockRejectedValueOnce(new Error('Stripe unavailable'));

    await expect(performEffect(oystehr, stripe, params, agent)).rejects.toThrow('Stripe unavailable');
    expect(getInvoiceNumber(invoices[0])).toBe('INV-00042');

    await performEffect(oystehr, stripe, params, agent);

    expect(invoices).toHaveLength(1);
    expect(invoices[0].status).toBe('issued');
    expect(getInvoiceNumber(invoices[0])).toBe('INV-00042');
    expect(mockIssueInvoiceNumber).toHaveBeenCalledTimes(1);
  });

  it('rejects a claim another request already invoiced', async () => {
    const { oystehr } = makeOystehr(makeClaim('invoiced'), [existingInvoice('issued', 'key-other')]);

    await expect(performEffect(oystehr, makeStripe().stripe, params, agent)).rejects.toMatchObject({
      statusCode: 409,
      message: 'This claim already has an invoice.',
    });
    expect(mockIssueInvoiceNumber).not.toHaveBeenCalled();
  });
});
