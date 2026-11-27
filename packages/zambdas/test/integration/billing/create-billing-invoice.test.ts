import { randomUUID } from 'node:crypto';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Claim, FhirResource, Invoice, Location, Organization, Patient, Provenance } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import {
  BILLING_INVOICE_IDEMPOTENCY_KEY_SYSTEM,
  getBillingInvoiceClaims,
  getBillingInvoiceDueDate,
  getHostedInvoiceUrl,
  getInvoiceNumber,
  getStripeInvoiceLink,
  INVOICE_CLAIM_TAG_SYSTEM,
} from 'utils/lib/fhir/billing-invoice';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import {
  PREPARE_BILLING_INVOICE_ZAMBDA_KEY,
  PrepareBillingInvoiceResponse,
  SEND_BILLING_INVOICE_SMS_ZAMBDA_KEY,
} from 'utils/lib/types/api/invoicing.types';
import { CreateBillingInvoiceResponse } from 'utils/lib/types/data/billing/billing.types';
import { AR_STAGE, claimStatusValuesToTags, getClaimStatusValues } from 'utils/lib/types/data/billing/claim-status';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import { index } from '../../../src/billing/create-billing-invoice/index';
import { INVOICE_NUMBER_COUNTER_KEY, setInvoiceNumberCounterKey } from '../../../src/billing/invoice-number';
import { produceBillingInvoiceIssuedOutreach } from '../../../src/billing/invoice-outreach';
import { SOURCE_IDENTIFIER_SYSTEM } from '../../../src/billing/shared';
import { STRIPE_METADATA_KEYS } from '../../../src/shared/stripeIntegration';
import {
  addProcessIdMetaTagToResource,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler, loadZambdaSecrets } from '../../helpers/invoke-zambda-handler';

vi.hoisted(() => vi.resetModules());

const stripe = vi.hoisted(() => ({
  invoices: { create: vi.fn(), finalizeInvoice: vi.fn(), sendInvoice: vi.fn(), retrieve: vi.fn(), del: vi.fn() },
  invoiceItems: { create: vi.fn() },
}));

vi.mock('../../../src/shared/stripeIntegration', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/stripeIntegration')>();
  return { ...actual, getStripeClient: vi.fn(() => stripe) };
});

vi.mock('../../../src/billing/invoice-outreach', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/billing/invoice-outreach')>();
  return { ...actual, produceBillingInvoiceIssuedOutreach: vi.fn(async () => ({ created: [], skipped: [] })) };
});

type ZambdaClient = Oystehr['zambda'];

describe('create-billing-invoice', () => {
  let oystehr: Oystehr;
  let token: string;
  let callerProfile: string;
  let cleanup: () => Promise<void>;
  let processId: string;

  const seededDeletes: BatchInputDeleteRequest[] = [];
  const suffix = randomUUID().replace(/-/g, '').slice(0, 16);
  const stripeAccount = `acct_${suffix}`;
  const stripeInvoiceId = `in_${suffix}`;
  const hostedInvoiceUrl = `https://invoice.stripe.com/i/${suffix}`;
  const timezone = 'America/Chicago';
  let encounterId: string;
  let clinicalPatientId: string;
  let locationId: string | undefined;
  let billingPatientId: string;
  let providerId: string;
  let claimId: string;
  let executeSpy: ReturnType<typeof vi.spyOn>;
  const nestedCalls: Record<string, unknown>[] = [];

  const seed = async <T extends FhirResource>(client: Oystehr, resource: T): Promise<string> => {
    const created = await client.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    seededDeletes.unshift({ method: 'DELETE', url: `${created.resourceType}/${created.id}` });
    return created.id!;
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/create-billing-invoice.test.ts',
      M2MClientMockType.provider
    );
    oystehr = setup.oystehr;
    token = setup.testUserM2MToken;
    callerProfile = setup.testUserM2MProfile;
    cleanup = setup.cleanup;
    processId = setup.processId;
    setInvoiceNumberCounterKey(`${INVOICE_NUMBER_COUNTER_KEY}-${inject('INTEGRATION_TEST_RUN_ID')}`);

    const visit = await insertInPersonAppointmentBase(oystehr, processId);
    encounterId = visit.encounter.id!;
    clinicalPatientId = visit.patient.id!;
    locationId = visit.appointment.participant
      .find((participant) => participant.actor?.reference?.startsWith('Location/'))
      ?.actor?.reference?.split('/')[1];
    if (locationId) seededDeletes.push({ method: 'DELETE', url: `Location/${locationId}` });

    billingPatientId = await seed<Patient>(setup.oystehrBilling, {
      resourceType: 'Patient',
      active: true,
      name: [{ family: 'Snow', given: ['Jon'] }],
      birthDate: '2002-07-07',
      extension: [{ url: SOURCE_IDENTIFIER_SYSTEM, valueReference: { reference: `Patient/${clinicalPatientId}` } }],
    });
    providerId = await seed<Organization>(setup.oystehrBilling, {
      resourceType: 'Organization',
      active: true,
      name: 'Integration Medical Group',
      address: [{ line: ['2 Provider Way'], city: 'Austin', state: 'TX', postalCode: '78701' }],
    });
    const facilityId = await seed<Location>(setup.oystehrBilling, {
      resourceType: 'Location',
      name: 'Integration Clinic',
      address: { line: ['1 Clinic Way'], city: 'Austin', state: 'TX', postalCode: '78701' },
      managingOrganization: { reference: `Organization/${providerId}` },
      extension: [{ url: SOURCE_IDENTIFIER_SYSTEM, valueReference: { reference: `Location/${locationId}` } }],
    });
    claimId = await seed<Claim>(setup.oystehrBilling, {
      resourceType: 'Claim',
      status: 'active',
      use: 'claim',
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
      created: '2026-03-01',
      priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
      insurance: [{ sequence: 1, focal: true, coverage: { display: 'Self-pay' } }],
      patient: { reference: `Patient/${billingPatientId}` },
      provider: { reference: `Organization/${providerId}` },
      facility: { reference: `Location/${facilityId}` },
      identifier: [{ system: ottehrIdentifierSystem('claim-encounter-id'), value: encounterId }],
      total: { value: 125, currency: 'USD' },
      item: [{ sequence: 1, productOrService: { text: 'Office visit' }, servicedDate: '2026-03-01' }],
      meta: { tag: claimStatusValuesToTags({ arStage: AR_STAGE.patient, patientArStatus: 'ready-to-invoice' }) },
    });

    const prepared: PrepareBillingInvoiceResponse = {
      patientId: clinicalPatientId,
      stripeCustomerId: `cus_${suffix}`,
      stripeAccount,
      timezone,
      placeholders: {
        patientFullName: 'Jon Snow',
        clinic: 'Integration Clinic',
        location: 'Integration Test Location',
        visitDate: '03/01/2026',
      },
    };
    const zambdaPrototype = Object.getPrototypeOf(setup.oystehrBilling.zambda) as ZambdaClient;
    const realExecute = zambdaPrototype.execute;
    executeSpy = vi.spyOn(zambdaPrototype, 'execute').mockImplementation(async function (
      this: ZambdaClient,
      ...args: Parameters<ZambdaClient['execute']>
    ) {
      const [params] = args;
      if (params.id === PREPARE_BILLING_INVOICE_ZAMBDA_KEY || params.id === SEND_BILLING_INVOICE_SMS_ZAMBDA_KEY) {
        nestedCalls.push(params as Record<string, unknown>);
        return {
          status: 200,
          output: params.id === PREPARE_BILLING_INVOICE_ZAMBDA_KEY ? prepared : {},
        } as Awaited<ReturnType<ZambdaClient['execute']>>;
      }
      return realExecute.apply(this, args);
    });

    stripe.invoices.create.mockResolvedValue({ id: stripeInvoiceId, status: 'draft', lines: { data: [] } });
    stripe.invoiceItems.create.mockResolvedValue({ id: `ii_${suffix}` });
    stripe.invoices.finalizeInvoice.mockResolvedValue({
      id: stripeInvoiceId,
      status: 'open',
      hosted_invoice_url: hostedInvoiceUrl,
    });
    stripe.invoices.sendInvoice.mockResolvedValue({
      id: stripeInvoiceId,
      status: 'open',
      hosted_invoice_url: hostedInvoiceUrl,
    });
  }, 120_000);

  afterAll(async () => {
    executeSpy?.mockRestore();
    try {
      const invoices = (
        await oystehr.fhir.search<Invoice>({
          resourceType: 'Invoice',
          params: [{ name: '_tag', value: `${INVOICE_CLAIM_TAG_SYSTEM}|${claimId}` }],
        })
      ).unbundle();
      const invoiceReferences = invoices.map((invoice) => `Invoice/${invoice.id}`);
      const history = (
        await oystehr.fhir.search<Provenance>({
          resourceType: 'Provenance',
          params: [{ name: 'target', value: [`Claim/${claimId}`, ...invoiceReferences].join(',') }],
        })
      ).unbundle();
      const created = [...history, ...invoices];
      if (created.length > 0) {
        await oystehr.fhir.batch({
          requests: created.map(
            (resource): BatchInputDeleteRequest => ({
              method: 'DELETE',
              url: `${resource.resourceType}/${resource.id}`,
            })
          ),
        });
      }
      await oystehr.fhir.batch({
        requests: seededDeletes,
      });
    } catch (error) {
      console.error('Failed to clean up fixtures; the run-tag sweep will retry:', error);
    }
    await cleanup();
  }, 120_000);

  it('issues the claim invoice through Stripe, texts the patient the link and marks the claim invoiced', async () => {
    const idempotencyKey = randomUUID();
    const { statusCode, output } = await invokeZambdaHandler<CreateBillingInvoiceResponse>(
      index,
      {
        claimId,
        amountCents: 12500,
        dueDate: '2026-12-31',
        smsMessage: 'Hi {{patient-full-name}}, pay your balance here: {{invoice-link}}',
        memo: 'Visit at {{location}}',
        idempotencyKey,
      },
      { token, secrets: { ...loadZambdaSecrets(), INVOICING_IN_BILLING_APP: 'true' } }
    );

    expect(statusCode).toBe(200);
    expect(output).toEqual({ invoiceId: expect.any(String), stripeInvoiceId, smsSent: true });

    const invoice = await oystehr.fhir.get<Invoice>({ resourceType: 'Invoice', id: output.invoiceId });
    expect(invoice.status).toBe('issued');
    expect(getInvoiceNumber(invoice)).toMatch(/^INV-\d{5,}$/);
    expect(getBillingInvoiceClaims(invoice)).toEqual([{ claimId, amountCents: 12500 }]);
    expect(getBillingInvoiceDueDate(invoice)).toBe('2026-12-31');
    expect(invoice.recipient?.reference).toBe(`Patient/${billingPatientId}`);
    expect(invoice.issuer?.reference).toBe(`Organization/${providerId}`);
    expect(getStripeInvoiceLink(invoice)).toEqual({ stripeInvoiceId, stripeAccount });
    expect(getHostedInvoiceUrl(invoice)).toBe(hostedInvoiceUrl);
    expect(invoice.identifier).toContainEqual({
      system: BILLING_INVOICE_IDEMPOTENCY_KEY_SYSTEM,
      value: idempotencyKey,
    });

    expect(stripe.invoices.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: `cus_${suffix}`,
        collection_method: 'send_invoice',
        description: 'Visit at Integration Test Location',
        due_date: DateTime.fromISO('2026-12-31', { zone: timezone }).toUnixInteger(),
        metadata: expect.objectContaining({
          [STRIPE_METADATA_KEYS.invoiceId]: output.invoiceId,
          [STRIPE_METADATA_KEYS.encounterId]: encounterId,
          [STRIPE_METADATA_KEYS.patientId]: clinicalPatientId,
        }),
      }),
      { stripeAccount, idempotencyKey: `billing-invoice-${output.invoiceId}` }
    );
    expect(stripe.invoiceItems.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: `cus_${suffix}`, amount: 12500, invoice: stripeInvoiceId }),
      { stripeAccount, idempotencyKey: `billing-invoice-item-${output.invoiceId}` }
    );
    expect(stripe.invoices.sendInvoice).toHaveBeenCalledWith(stripeInvoiceId, undefined, {
      stripeAccount,
      idempotencyKey: `billing-invoice-send-${output.invoiceId}`,
    });
    expect(nestedCalls).toEqual([
      { id: PREPARE_BILLING_INVOICE_ZAMBDA_KEY, encounterId },
      { id: SEND_BILLING_INVOICE_SMS_ZAMBDA_KEY, encounterId, message: expect.stringContaining(hostedInvoiceUrl) },
    ]);
    expect(nestedCalls[1].message).toContain('Jon Snow');
    expect(produceBillingInvoiceIssuedOutreach).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: output.invoiceId, status: 'issued' })
    );

    const claim = await oystehr.fhir.get<Claim>({ resourceType: 'Claim', id: claimId });
    expect(getClaimStatusValues(claim).patientArStatus).toBe('invoiced');
    const history = (
      await oystehr.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `Claim/${claimId}` }],
      })
    ).unbundle();
    expect(history.map((entry) => entry.agent[0].who?.reference)).toContain(callerProfile);
  }, 120_000);
});
