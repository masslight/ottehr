import { randomUUID } from 'node:crypto';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Claim, DocumentReference, FhirResource, Invoice, Organization, Patient, PaymentNotice } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import {
  buildBillingInvoice,
  INVOICE_NUMBER_IDENTIFIER_SYSTEM,
  NIO_INVOICE_PAYMENT_ID_SYSTEM,
  PAYMENT_REFERENCE_IDENTIFIER_SYSTEM,
} from 'utils/lib/fhir/billing-invoice';
import { BillingInvoiceDetail } from 'utils/lib/types/data/billing/billing.types';
import { AR_STAGE, claimStatusValuesToTags } from 'utils/lib/types/data/billing/claim-status';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildAttachmentDocumentReference,
  INVOICE_ATTACHMENT_PATH_PREFIX,
  newAttachmentLocation,
} from '../../../src/billing/attachments';
import { buildInvoicePaymentAttachment } from '../../../src/billing/invoices';
import { buildPaymentNotice } from '../../../src/billing/payments';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';
import { loadZambdaSecrets } from '../../helpers/invoke-zambda-handler';

describe('get-billing-invoice', () => {
  let oystehr: Oystehr;
  let oystehrBilling: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;

  const secrets = loadZambdaSecrets();
  const seededDeletes: BatchInputDeleteRequest[] = [];
  const nioName = `Integration NIO ${randomUUID().slice(0, 8)}`;
  const patientFamily = `Invoice${randomUUID().slice(0, 8)}`;
  const invoiceNumber = `INV-T${randomUUID().slice(0, 6)}`;
  const paymentId = randomUUID();
  let nioId: string;
  let patientId: string;
  let claimIds: string[];
  let invoiceId: string;

  const seed = async <T extends FhirResource>(resource: T): Promise<string> => {
    const created = await oystehrBilling.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    seededDeletes.unshift({ method: 'DELETE', url: `${created.resourceType}/${created.id}` });
    return created.id!;
  };

  const seedClaim = (billed: number, servicedDate: string): Promise<string> =>
    seed<Claim>({
      resourceType: 'Claim',
      status: 'active',
      use: 'claim',
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
      created: servicedDate,
      priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
      insurance: [{ sequence: 1, focal: true, coverage: { display: 'Self-pay' } }],
      patient: { reference: `Patient/${patientId}` },
      provider: { display: 'Integration Medical Group' },
      total: { value: billed, currency: 'USD' },
      item: [{ sequence: 1, productOrService: { text: 'Office visit' }, servicedDate }],
      meta: {
        tag: claimStatusValuesToTags({ arStage: AR_STAGE.nonInsurancePayer, nonInsuranceArStatus: 'invoiced' }),
      },
    });

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/get-billing-invoice.test.ts',
      M2MClientMockType.provider
    );
    oystehr = setup.oystehrTestUserM2M;
    oystehrBilling = setup.oystehrBilling;
    cleanup = setup.cleanup;
    processId = setup.processId;

    nioId = await seed<Organization>({ resourceType: 'Organization', active: true, name: nioName });
    patientId = await seed<Patient>({
      resourceType: 'Patient',
      active: true,
      name: [{ family: patientFamily, given: ['Jordan'] }],
      birthDate: '1990-01-01',
    });
    claimIds = [await seedClaim(180, '2026-01-05'), await seedClaim(95, '2026-01-12')];
    invoiceId = await seed<Invoice>({
      ...buildBillingInvoice({
        status: 'issued',
        date: '2026-01-15T12:00:00.000Z',
        dueDate: '2026-02-14',
        issuer: { display: 'Integration Medical Group' },
        recipient: { reference: `Organization/${nioId}` },
        claims: [
          { claimId: claimIds[0], amountCents: 18000 },
          { claimId: claimIds[1], amountCents: 9500 },
        ],
      }),
      identifier: [{ system: INVOICE_NUMBER_IDENTIFIER_SYSTEM, value: invoiceNumber }],
    });
    await seed<DocumentReference>(
      buildAttachmentDocumentReference({
        location: newAttachmentLocation(secrets.PROJECT_ID, INVOICE_ATTACHMENT_PATH_PREFIX, invoiceId, 'invoice.pdf'),
        projectApi: secrets.PROJECT_API,
        title: 'invoice.pdf',
        contentType: 'application/pdf',
        relatedReference: `Invoice/${invoiceId}`,
      })
    );
    const noticeId = await seed<PaymentNotice>(
      buildPaymentNotice({
        request: { reference: `Claim/${claimIds[0]}` },
        payee: { display: 'Integration Medical Group' },
        amountInCents: 10000,
        paymentMethod: 'ach',
        identifier: { system: NIO_INVOICE_PAYMENT_ID_SYSTEM, value: paymentId },
        paymentDate: '2026-02-01',
        createdISO: '2026-02-01T16:00:00.000Z',
        disposition: `Payment toward invoice ${invoiceNumber}`,
        reconciliation: { identifier: [{ system: PAYMENT_REFERENCE_IDENTIFIER_SYSTEM, value: 'ACH-88120' }] },
        invoiceId,
      })
    );
    await seed<DocumentReference>(
      buildInvoicePaymentAttachment({
        invoiceId,
        paymentId,
        paymentNoticeReference: `PaymentNotice/${noticeId}`,
        path: newAttachmentLocation(secrets.PROJECT_ID, INVOICE_ATTACHMENT_PATH_PREFIX, invoiceId, 'remit.pdf').path,
        fileName: 'remit.pdf',
        secrets,
      })
    );
  }, 120_000);

  afterAll(async () => {
    try {
      if (seededDeletes.length > 0) await oystehrBilling.fhir.batch({ requests: seededDeletes });
    } catch (error) {
      console.error('Failed to clean up seeded fixtures; the run-tag sweep will retry:', error);
    }
    await cleanup();
  }, 120_000);

  it('details the invoice with its recipient, claim lines, payments with attachments, balance and PDF link', async () => {
    const detail = (await oystehr.zambda.execute({ id: 'get-billing-invoice', invoiceId }))
      .output as unknown as BillingInvoiceDetail;

    expect(detail).toMatchObject({
      id: invoiceId,
      kind: 'nio',
      status: 'issued',
      number: invoiceNumber,
      issueDate: '2026-01-15T12:00:00.000Z',
      dueDate: '2026-02-14',
      amount: 275,
      balance: 175,
      pastDue: true,
      recipient: { id: nioId, name: nioName },
    });
    expect(detail.claims).toEqual([
      {
        claimId: claimIds[0],
        patientId,
        patientName: `${patientFamily}, Jordan`,
        serviceDate: '2026-01-05',
        arStage: AR_STAGE.nonInsurancePayer,
        status: 'invoiced',
        amount: 180,
      },
      {
        claimId: claimIds[1],
        patientId,
        patientName: `${patientFamily}, Jordan`,
        serviceDate: '2026-01-12',
        arStage: AR_STAGE.nonInsurancePayer,
        status: 'invoiced',
        amount: 95,
      },
    ]);
    expect(detail.payments).toEqual([
      {
        paymentId,
        paymentDate: '2026-02-01',
        amount: 100,
        method: 'ach',
        reference: 'ACH-88120',
        attachment: { fileName: 'remit.pdf', url: expect.stringMatching(/^https:\/\//) },
      },
    ]);
    expect(detail.payments[0].attachment?.url).toContain('remit.pdf');
    expect(detail.pdfUrl).toMatch(/^https:\/\//);
    expect(detail.pdfUrl).toContain('invoice.pdf');
  }, 120_000);
});
