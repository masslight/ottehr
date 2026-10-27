import Oystehr from '@oystehr/sdk';
import type { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Invoice, ProvenanceAgent, RelatedPerson } from 'fhir/r4b';
import Stripe from 'stripe';
import {
  buildBillingInvoice,
  getStripeInvoiceLink,
  INVOICE_CLAIM_TAG_SYSTEM,
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
import { index, performEffect } from '../../../src/billing/create-billing-invoice';
import { index as sendBillingInvoiceSms } from '../../../src/ehr/send-billing-invoice-sms';
import type { ZambdaInput } from '../../../src/shared/types/common';

const { mockFlags, mockApplyClaimStatusField, mockClinicalClient } = vi.hoisted(() => ({
  mockFlags: { ottehrBillingInvoicingEnabled: true, invoicingInBillingApp: true },
  mockApplyClaimStatusField: vi.fn(),
  mockClinicalClient: {
    fhir: { search: vi.fn() },
    transactionalSMS: { send: vi.fn() },
  },
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
const IDEMPOTENCY_KEY_SYSTEM = ottehrIdentifierSystem('billing-invoice-idempotency-key');
const agent: ProvenanceAgent = { who: { reference: 'Practitioner/biller' } };

const visit: PrepareBillingInvoiceResponse = {
  patientId: 'pat-1',
  stripeCustomerId: 'cus_1',
  stripeAccount: 'acct_1',
  timezone: 'America/New_York',
  placeholders: { patientFullName: 'Katie Test', visitDate: '07/01/2026' },
};

const params = (overrides: Partial<Parameters<typeof performEffect>[2]> = {}): Parameters<typeof performEffect>[2] => ({
  claimId: CLAIM_ID,
  amountCents: 5000,
  dueDate: '2099-12-31',
  smsMessage: 'Pay here {{invoice-link}}',
  memo: 'Visit on {{visit-date}}',
  idempotencyKey: 'key-1',
  secrets: { BILLING_INTEGRATION: 'ottehr', ENVIRONMENT: 'local' },
  ...overrides,
});

const makeClaim = (patientArStatus = 'ready-to-invoice', arStage: string = AR_STAGE.patient): Claim =>
  ({
    resourceType: 'Claim',
    id: CLAIM_ID,
    patient: { reference: 'Patient/billing-pat-1' },
    identifier: [{ system: ottehrIdentifierSystem('claim-encounter-id'), value: ENCOUNTER_ID }],
    meta: {
      versionId: '1',
      tag: [
        { system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: arStage },
        { system: CLAIM_STATUS_TAG_SYSTEMS.patientArStatus, code: patientArStatus },
      ],
    },
  }) as Claim;

const existingInvoice = (
  status: Invoice['status'],
  key: string,
  options: { amountCents?: number; stripeInvoiceId?: string } = {}
): Invoice => {
  let invoice: Invoice = {
    ...buildBillingInvoice({
      status,
      date: '2026-10-01T00:00:00.000Z',
      dueDate: '2099-12-31',
      recipient: { reference: 'Patient/billing-pat-1' },
      claims: [{ claimId: CLAIM_ID, amountCents: options.amountCents ?? 5000 }],
    }),
    id: 'inv-old',
    identifier: [{ system: IDEMPOTENCY_KEY_SYSTEM, value: key }],
  };
  invoice.meta = { ...invoice.meta, versionId: '1' };
  if (options.stripeInvoiceId) {
    invoice = withStripeInvoiceLink(invoice, { stripeInvoiceId: options.stripeInvoiceId, stripeAccount: 'acct_1' });
  }
  return invoice;
};

// Conditional create returns the claim's open invoice, and updates must name the current version.
const makeOystehr = (
  claim: Claim,
  existing: Invoice[] = []
): { oystehr: Oystehr; invoices: Invoice[]; execute: ReturnType<typeof vi.fn> } => {
  const invoices = [...existing];
  let nextId = 1;
  const create = vi.fn(async (invoice: Invoice, options?: { ifNoneExist?: { name: string; value: string }[] }) => {
    const claimTag = options?.ifNoneExist?.find((param) => param.value.startsWith(INVOICE_CLAIM_TAG_SYSTEM));
    const match = invoices.find(
      (stored) =>
        ['draft', 'issued', 'balanced'].includes(stored.status) &&
        stored.meta?.tag?.some((tag) => `${tag.system}|${tag.code}` === claimTag?.value)
    );
    if (match) return match;
    const created = { ...invoice, id: `inv-${nextId++}`, meta: { ...invoice.meta, versionId: '1' } };
    invoices.push(created);
    return created;
  });
  const update = vi.fn(async (invoice: Invoice, options?: { optimisticLockingVersionId?: string }) => {
    const position = invoices.findIndex((stored) => stored.id === invoice.id);
    if (invoices[position].meta?.versionId !== options?.optimisticLockingVersionId) {
      throw new Error('version conflict');
    }
    const updated = { ...invoice, meta: { ...invoice.meta, versionId: String(Number(invoice.meta?.versionId) + 1) } };
    invoices[position] = updated;
    return updated;
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
  existing: StripeInvoiceStub[] = []
): {
  stripe: Stripe;
  invoices: Record<string, ReturnType<typeof vi.fn>>;
  invoiceItems: Record<string, ReturnType<typeof vi.fn>>;
} => {
  const stored = new Map(existing.map((invoice) => [invoice.id, invoice]));
  const invoices = {
    create: vi.fn(async () => {
      const created: StripeInvoiceStub = { id: 'in_new', status: 'draft', lines: { data: [] } };
      stored.set(created.id, created);
      return created;
    }),
    retrieve: vi.fn(async (id: string) => stored.get(id)),
    del: vi.fn(async (id: string) => {
      stored.delete(id);
      return { id, deleted: true };
    }),
    finalizeInvoice: vi.fn(async (id: string) => {
      const finalized = { ...stored.get(id)!, status: 'open' as const };
      stored.set(id, finalized);
      return finalized;
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
    mockFlags.invoicingInBillingApp = true;
  });

  it('rejects when invoicing does not run in the billing app', async () => {
    mockFlags.invoicingInBillingApp = false;
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
    expect(invoices[0].meta?.tag).toContainEqual({ system: INVOICE_CLAIM_TAG_SYSTEM, code: CLAIM_ID });
    expect(invoices[0].identifier).toContainEqual({ system: IDEMPOTENCY_KEY_SYSTEM, value: 'key-1' });
    expect(getStripeInvoiceLink(invoices[0])).toEqual({ stripeInvoiceId: 'in_new', stripeAccount: 'acct_1' });
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
      expect.objectContaining({ stripeAccount: 'acct_1' })
    );
    expect(stripeInvoices.sendInvoice).toHaveBeenCalledWith('in_new', undefined, { stripeAccount: 'acct_1' });
    expect(execute).toHaveBeenCalledWith({
      id: SEND_BILLING_INVOICE_SMS_ZAMBDA_KEY,
      encounterId: ENCOUNTER_ID,
      message: 'Pay here https://pay.test/in_new',
    });
    expect(mockApplyClaimStatusField).toHaveBeenCalledWith(oystehr, claim, 'patientArStatus', 'invoiced', agent);
  });

  it.each(['invoiced', 'finalized'])('leaves a %s claim status as it is', async (status) => {
    const { oystehr } = makeOystehr(makeClaim(status));

    await performEffect(oystehr, makeStripe().stripe, params(), agent);

    expect(mockApplyClaimStatusField).not.toHaveBeenCalled();
  });

  it('still fails creation when Stripe cannot send the invoice email', async () => {
    const { oystehr, invoices, execute } = makeOystehr(makeClaim());
    const { stripe, invoices: stripeInvoices } = makeStripe();
    const emailError = { type: 'StripeAPIError', message: 'Invoice email request failed' };
    stripeInvoices.sendInvoice.mockRejectedValueOnce(emailError);

    await expect(performEffect(oystehr, stripe, params(), agent)).rejects.toBe(emailError);

    expect(invoices[0].status).toBe('draft');
    expect(smsCalls(execute)).toHaveLength(0);
    expect(mockApplyClaimStatusField).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'no portal recipients', recipientCount: 0, acceptedCount: 0, smsSent: false },
    { name: 'all SMS requests fail', recipientCount: 2, acceptedCount: 0, smsSent: false },
    { name: 'one SMS request succeeds', recipientCount: 2, acceptedCount: 1, smsSent: true },
    { name: 'all SMS requests succeed', recipientCount: 2, acceptedCount: 2, smsSent: true },
  ])(
    'issues the invoice with $name and preserves the result on retry',
    async ({ recipientCount, acceptedCount, smsSent }) => {
      const claim = makeClaim();
      const { oystehr, invoices, execute } = makeOystehr(claim);
      const { stripe, invoices: stripeInvoices } = makeStripe();
      const recipients: RelatedPerson[] = Array.from({ length: recipientCount }, (_, i) => ({
        resourceType: 'RelatedPerson',
        id: `rp-${i}`,
        patient: { reference: 'Patient/pat-1' },
      }));
      mockClinicalClient.fhir.search.mockImplementation(({ resourceType }) =>
        Promise.resolve({
          unbundle: () => (resourceType === 'Encounter' ? [{ resourceType: 'Patient', id: 'pat-1' }] : recipients),
        })
      );
      mockClinicalClient.transactionalSMS.send.mockReset();
      for (let i = 0; i < acceptedCount; i++) {
        mockClinicalClient.transactionalSMS.send.mockResolvedValueOnce({ resourceId: `comm-${i}` });
      }
      mockClinicalClient.transactionalSMS.send.mockRejectedValue({ code: 503, message: 'SMS service unavailable' });
      const smsHandler = sendBillingInvoiceSms as unknown as (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
      execute.mockImplementation(async (request) => {
        if (request.id === PREPARE_BILLING_INVOICE_ZAMBDA_KEY) return { output: visit };
        const response = await smsHandler({
          headers: null,
          body: JSON.stringify(request),
          secrets: params().secrets,
        });
        return { output: JSON.parse(response.body) };
      });

      const result = await performEffect(oystehr, stripe, params(), agent);

      expect(result).toEqual({ invoiceId: 'inv-1', stripeInvoiceId: 'in_new', smsSent });
      expect(invoices[0].status).toBe('issued');
      expect(mockApplyClaimStatusField).toHaveBeenCalledWith(oystehr, claim, 'patientArStatus', 'invoiced', agent);

      const retry = await performEffect(oystehr, stripe, params(), agent);

      expect(retry).toEqual(result);
      expect(invoices).toHaveLength(1);
      expect(stripeInvoices.create).toHaveBeenCalledTimes(1);
      expect(stripeInvoices.sendInvoice).toHaveBeenCalledTimes(1);
      expect(smsCalls(execute)).toHaveLength(1);
      expect(mockClinicalClient.transactionalSMS.send).toHaveBeenCalledTimes(recipientCount);
    }
  );

  it.each([
    ['not ready to invoice', makeClaim('not-invoiced')],
    ['outside Patient AR', makeClaim('ready-to-invoice', AR_STAGE.insurancePayer)],
  ])('rejects a claim %s', async (_case, claim) => {
    const { oystehr, invoices, execute } = makeOystehr(claim);

    await expect(performEffect(oystehr, makeStripe().stripe, params(), agent)).rejects.toMatchObject({
      message: 'Only Patient AR claims that are ready to invoice, invoiced or finalized can be invoiced',
    });
    expect(invoices).toHaveLength(0);
    expect(execute).not.toHaveBeenCalled();
  });

  it('returns the invoice a retried request already sent', async () => {
    const { oystehr, execute } = makeOystehr(makeClaim('invoiced'), [
      existingInvoice('issued', 'key-1', { stripeInvoiceId: 'in_old' }),
    ]);
    const { stripe, invoices: stripeInvoices } = makeStripe();

    const result = await performEffect(oystehr, stripe, params(), agent);

    expect(result).toEqual({ invoiceId: 'inv-old', stripeInvoiceId: 'in_old', smsSent: false });
    expect(stripeInvoices.create).not.toHaveBeenCalled();
    expect(stripeInvoices.sendInvoice).not.toHaveBeenCalled();
    expect(smsCalls(execute)).toHaveLength(0);
  });

  it('rejects when another request already invoiced the claim', async () => {
    const { oystehr } = makeOystehr(makeClaim('invoiced'), [
      existingInvoice('issued', 'key-other', { stripeInvoiceId: 'in_old' }),
    ]);

    await expect(performEffect(oystehr, makeStripe().stripe, params(), agent)).rejects.toMatchObject({
      statusCode: 409,
      message: 'This claim already has an invoice.',
    });
  });

  it('rejects a retry whose amount differs from the invoice it started', async () => {
    const { oystehr } = makeOystehr(makeClaim(), [existingInvoice('draft', 'key-1', { amountCents: 4000 })]);

    await expect(performEffect(oystehr, makeStripe().stripe, params(), agent)).rejects.toMatchObject({
      statusCode: 409,
      message: 'This claim already has an invoice for $40.00 due 12/31/2099. Retry with that amount and due date.',
    });
  });

  it('resumes its own draft from the step where it stopped', async () => {
    const { oystehr, invoices } = makeOystehr(makeClaim(), [
      existingInvoice('draft', 'key-1', { stripeInvoiceId: 'in_old' }),
    ]);
    const {
      stripe,
      invoices: stripeInvoices,
      invoiceItems,
    } = makeStripe([{ id: 'in_old', status: 'draft', lines: { data: [{}] } }]);

    await performEffect(oystehr, stripe, params(), agent);

    expect(stripeInvoices.create).not.toHaveBeenCalled();
    expect(invoiceItems.create).not.toHaveBeenCalled();
    expect(stripeInvoices.finalizeInvoice).toHaveBeenCalledWith('in_old', undefined, { stripeAccount: 'acct_1' });
    expect(invoices[0].status).toBe('issued');
  });

  it('replaces a draft another request left before Stripe finalized it', async () => {
    const { oystehr, invoices } = makeOystehr(makeClaim(), [
      existingInvoice('draft', 'key-other', { stripeInvoiceId: 'in_old' }),
    ]);
    const { stripe, invoices: stripeInvoices } = makeStripe([{ id: 'in_old', status: 'draft', lines: { data: [] } }]);

    const result = await performEffect(oystehr, stripe, params(), agent);

    expect(stripeInvoices.del).toHaveBeenCalledWith('in_old', undefined, { stripeAccount: 'acct_1' });
    expect(invoices[0].status).toBe('entered-in-error');
    expect(result).toEqual({ invoiceId: 'inv-1', stripeInvoiceId: 'in_new', smsSent: true });
    expect(invoices[1].status).toBe('issued');
  });

  it('finishes a draft another request left after Stripe finalized it', async () => {
    const { oystehr, invoices, execute } = makeOystehr(makeClaim(), [
      existingInvoice('draft', 'key-other', { stripeInvoiceId: 'in_old' }),
    ]);
    const { stripe, invoices: stripeInvoices } = makeStripe([{ id: 'in_old', status: 'open', lines: { data: [{}] } }]);

    const result = await performEffect(oystehr, stripe, params(), agent);

    expect(result).toEqual({ invoiceId: 'inv-old', stripeInvoiceId: 'in_old', smsSent: true });
    expect(stripeInvoices.del).not.toHaveBeenCalled();
    expect(stripeInvoices.create).not.toHaveBeenCalled();
    expect(stripeInvoices.sendInvoice).toHaveBeenCalledWith('in_old', undefined, { stripeAccount: 'acct_1' });
    expect(smsCalls(execute)).toHaveLength(1);
    expect(invoices).toHaveLength(1);
    expect(invoices[0].status).toBe('issued');
  });

  it('does not finish a finalized invoice from another request with a different amount', async () => {
    const { oystehr, invoices, execute } = makeOystehr(makeClaim(), [
      existingInvoice('draft', 'key-other', { stripeInvoiceId: 'in_old', amountCents: 10000 }),
    ]);
    const { stripe, invoices: stripeInvoices } = makeStripe([{ id: 'in_old', status: 'open', lines: { data: [{}] } }]);

    await expect(performEffect(oystehr, stripe, params({ amountCents: 20000 }), agent)).rejects.toMatchObject({
      statusCode: 409,
      message: 'This claim already has an invoice for $100.00 due 12/31/2099. Retry with that amount and due date.',
    });
    expect(stripeInvoices.sendInvoice).not.toHaveBeenCalled();
    expect(smsCalls(execute)).toHaveLength(0);
    expect(invoices[0].status).toBe('draft');
    expect(mockApplyClaimStatusField).not.toHaveBeenCalled();
  });
});
