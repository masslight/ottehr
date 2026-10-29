import Oystehr from '@oystehr/sdk';
import type { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Invoice, ProvenanceAgent } from 'fhir/r4b';
import Stripe from 'stripe';
import { buildBillingInvoice, INVOICE_CLAIM_TAG_SYSTEM, withStripeInvoiceLink } from 'utils/lib/fhir/billing-invoice';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import {
  PREPARE_BILLING_INVOICE_ZAMBDA_KEY,
  PrepareBillingInvoiceResponse,
  SEND_BILLING_INVOICE_SMS_ZAMBDA_KEY,
} from 'utils/lib/types/api/invoicing.types';
import { AR_STAGE, CLAIM_STATUS_TAG_SYSTEMS } from 'utils/lib/types/data/billing/claim-status';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { index, performEffect } from '../../../src/billing/create-billing-invoice';
import { index as sendBillingInvoiceSms } from '../../../src/ehr/send-billing-invoice-sms';
import type { ZambdaInput } from '../../../src/shared/types/common';

const { mockFlags, mockApplyClaimStatusField, mockClinicalClient } = vi.hoisted(() => ({
  mockFlags: { ottehrBillingInvoicingEnabled: true },
  mockApplyClaimStatusField: vi.fn(),
  mockClinicalClient: { fhir: { search: vi.fn() }, transactionalSMS: { send: vi.fn() } },
}));

vi.mock('utils/lib/ottehr-config/feature-flags', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  FEATURE_FLAGS_CONFIG: mockFlags,
}));
vi.mock('../../../src/shared/sentry', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));
vi.mock('../../../src/billing/provenance', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  applyClaimStatusField: (...args: unknown[]) => mockApplyClaimStatusField(...args),
}));
vi.mock('../../../src/shared/auth', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
}));
vi.mock('../../../src/shared/helpers', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createClinicalOystehrClient: () => mockClinicalClient,
}));

const CLAIM_ID = '11111111-1111-4111-8111-111111111111';
const ENCOUNTER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const agent: ProvenanceAgent = { who: { reference: 'Practitioner/biller' } };
const visit: PrepareBillingInvoiceResponse = {
  patientId: 'pat-1',
  stripeCustomerId: 'cus_1',
  stripeAccount: 'acct_1',
  timezone: 'America/New_York',
  placeholders: { patientFullName: 'Katie Test', visitDate: '07/01/2026' },
};

type Params = Parameters<typeof performEffect>[2];
const params = (overrides: Partial<Params> = {}): Params => ({
  claimId: CLAIM_ID,
  amountCents: 5000,
  dueDate: '2099-12-31',
  smsMessage: 'Pay here {{invoice-link}}',
  memo: 'Visit on {{visit-date}}',
  idempotencyKey: 'key-1',
  secrets: { BILLING_INTEGRATION: 'ottehr', INVOICING_IN_BILLING_APP: 'true', ENVIRONMENT: 'local' },
  ...overrides,
});

const makeClaim = (patientArStatus = 'ready-to-invoice'): Claim =>
  ({
    resourceType: 'Claim',
    id: CLAIM_ID,
    patient: { reference: 'Patient/billing-pat-1' },
    identifier: [{ system: ottehrIdentifierSystem('claim-encounter-id'), value: ENCOUNTER_ID }],
    meta: {
      tag: [
        { system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.patient },
        { system: CLAIM_STATUS_TAG_SYSTEMS.patientArStatus, code: patientArStatus },
      ],
    },
  }) as Claim;

// An invoice an earlier request left for the claim, linked to Stripe invoice in_old.
const existingInvoice = (status: Invoice['status'], key: string, amountCents = 5000): Invoice =>
  withStripeInvoiceLink(
    {
      ...buildBillingInvoice({
        status,
        date: '2026-10-01T00:00:00.000Z',
        dueDate: '2099-12-31',
        recipient: { reference: 'Patient/billing-pat-1' },
        claims: [{ claimId: CLAIM_ID, amountCents }],
      }),
      id: 'inv-old',
      meta: { tag: [{ system: INVOICE_CLAIM_TAG_SYSTEM, code: CLAIM_ID }], versionId: '1' },
      identifier: [{ system: ottehrIdentifierSystem('billing-invoice-idempotency-key'), value: key }],
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
  const search = vi.fn(async () => ({ unbundle: () => [claim] }));
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
    del: vi.fn(async (id: string) => stored.delete(id)),
    finalizeInvoice: vi.fn(async (id: string) => {
      stored.set(id, { ...stored.get(id)!, status: 'open' });
      return stored.get(id);
    }),
    sendInvoice: vi.fn(async (id: string) => ({ ...stored.get(id), hosted_invoice_url: `https://pay.test/${id}` })),
  };
  const invoiceItems = { create: vi.fn(async () => ({ id: 'ii_1' })) };
  return { stripe: { invoices, invoiceItems } as unknown as Stripe, invoices, invoiceItems };
};

const smsCalls = (execute: ReturnType<typeof vi.fn>): unknown[] =>
  execute.mock.calls.filter(([request]) => request.id === SEND_BILLING_INVOICE_SMS_ZAMBDA_KEY);

describe('create-billing-invoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when invoicing does not run in the billing app', async () => {
    const { secrets: _secrets, ...body } = params();
    const handler = index as unknown as (input: ZambdaInput) => Promise<unknown>;

    await expect(
      handler({ headers: null, body: JSON.stringify(body), secrets: { BILLING_INTEGRATION: 'ottehr' } })
    ).rejects.toMatchObject({ message: 'Invoicing is not enabled in the billing app' });
  });

  it('creates, sends and links an invoice, then moves a ready claim to Invoiced', async () => {
    const claim = makeClaim();
    const { oystehr, invoices, execute } = makeOystehr(claim);
    const { stripe, invoices: stripeInvoices, invoiceItems } = makeStripe();

    const result = await performEffect(oystehr, stripe, params(), agent);

    expect(result).toEqual({ invoiceId: 'inv-1', stripeInvoiceId: 'in_new', smsSent: true });
    expect(invoices[0].status).toBe('issued');
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
    expect(smsCalls(execute)).toEqual([
      [
        {
          id: SEND_BILLING_INVOICE_SMS_ZAMBDA_KEY,
          encounterId: ENCOUNTER_ID,
          message: 'Pay here https://pay.test/in_new',
        },
      ],
    ]);
    expect(mockApplyClaimStatusField).toHaveBeenCalledWith(oystehr, claim, 'patientArStatus', 'invoiced', agent);
  });

  it.each(['invoiced', 'finalized'])('leaves a %s claim status as it is', async (status) => {
    const { oystehr } = makeOystehr(makeClaim(status));

    await performEffect(oystehr, makeStripe().stripe, params(), agent);

    expect(mockApplyClaimStatusField).not.toHaveBeenCalled();
  });

  it('rejects a claim that is not ready to invoice', async () => {
    const { oystehr, execute } = makeOystehr(makeClaim('not-invoiced'));

    await expect(performEffect(oystehr, makeStripe().stripe, params(), agent)).rejects.toMatchObject({
      message: 'Only Patient AR claims that are ready to invoice, invoiced or finalized can be invoiced',
    });
    expect(execute).not.toHaveBeenCalled();
  });

  // The SMS endpoint rejects a patient without portal users, which once failed the whole invoice.
  it('issues the invoice when the patient has no SMS recipient, and a retry sends nothing again', async () => {
    const { oystehr, invoices, execute } = makeOystehr(makeClaim());
    const { stripe, invoices: stripeInvoices } = makeStripe();
    mockClinicalClient.fhir.search.mockImplementation(async ({ resourceType }) => ({
      unbundle: () => (resourceType === 'Encounter' ? [{ resourceType: 'Patient', id: 'pat-1' }] : []),
    }));
    const smsHandler = sendBillingInvoiceSms as unknown as (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
    execute.mockImplementation(async (request) => {
      if (request.id === PREPARE_BILLING_INVOICE_ZAMBDA_KEY) return { output: visit };
      const response = await smsHandler({ headers: null, body: JSON.stringify(request), secrets: params().secrets });
      return { output: JSON.parse(response.body) };
    });

    expect(await performEffect(oystehr, stripe, params(), agent)).toMatchObject({ smsSent: false });
    expect(invoices[0].status).toBe('issued');

    expect(await performEffect(oystehr, stripe, params(), agent)).toEqual({
      invoiceId: 'inv-1',
      stripeInvoiceId: 'in_new',
      smsSent: undefined,
    });
    expect(stripeInvoices.sendInvoice).toHaveBeenCalledTimes(1);
    expect(smsCalls(execute)).toHaveLength(1);
  });

  it('rejects a claim another request already invoiced', async () => {
    const { oystehr } = makeOystehr(makeClaim('invoiced'), [existingInvoice('issued', 'key-other')]);

    await expect(performEffect(oystehr, makeStripe().stripe, params(), agent)).rejects.toMatchObject({
      statusCode: 409,
      message: 'This claim already has an invoice.',
    });
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

    await performEffect(oystehr, stripe, params(), agent);

    expect(stripeInvoices.create).not.toHaveBeenCalled();
    expect(invoiceItems.create).not.toHaveBeenCalled();
    expect(invoices[0].status).toBe('issued');
  });

  it('replaces a draft another request left before Stripe finalized it', async () => {
    const { oystehr, invoices } = makeOystehr(makeClaim(), [existingInvoice('draft', 'key-other')]);
    const { stripe, invoices: stripeInvoices } = makeStripe({ id: 'in_old', status: 'draft', lines: { data: [] } });

    expect(await performEffect(oystehr, stripe, params(), agent)).toMatchObject({ stripeInvoiceId: 'in_new' });
    expect(stripeInvoices.del).toHaveBeenCalledWith('in_old', undefined, { stripeAccount: 'acct_1' });
    expect(invoices.map((invoice) => invoice.status)).toEqual(['entered-in-error', 'issued']);
  });

  it('does not finish a finalized invoice from another request with a different amount', async () => {
    const { oystehr, execute } = makeOystehr(makeClaim(), [existingInvoice('draft', 'key-other', 10000)]);
    const { stripe, invoices: stripeInvoices } = makeStripe({ id: 'in_old', status: 'open', lines: { data: [{}] } });

    await expect(performEffect(oystehr, stripe, params({ amountCents: 20000 }), agent)).rejects.toMatchObject({
      statusCode: 409,
      message: 'This claim already has an invoice for $100.00 due 12/31/2099. Retry with that amount and due date.',
    });
    expect(stripeInvoices.sendInvoice).not.toHaveBeenCalled();
    expect(smsCalls(execute)).toHaveLength(0);
  });

  it('marks the invoice balanced without sending when the patient paid before the retry', async () => {
    const { oystehr, invoices, execute } = makeOystehr(makeClaim(), [existingInvoice('draft', 'key-1')]);
    const { stripe, invoices: stripeInvoices } = makeStripe({ id: 'in_old', status: 'paid', lines: { data: [{}] } });

    expect(await performEffect(oystehr, stripe, params(), agent)).toMatchObject({ smsSent: undefined });
    expect(invoices[0].status).toBe('balanced');
    expect(stripeInvoices.sendInvoice).not.toHaveBeenCalled();
    expect(smsCalls(execute)).toHaveLength(0);
  });
});
