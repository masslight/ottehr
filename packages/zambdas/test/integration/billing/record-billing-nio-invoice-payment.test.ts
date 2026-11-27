import { randomUUID } from 'node:crypto';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import {
  Claim,
  DocumentReference,
  FhirResource,
  Invoice,
  Organization,
  Patient,
  PaymentNotice,
  Provenance,
} from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import {
  buildBillingInvoice,
  INVOICE_NUMBER_IDENTIFIER_SYSTEM,
  INVOICE_PAYMENT_TAG_SYSTEM,
  NIO_INVOICE_PAYMENT_ID_SYSTEM,
  PAYMENT_REFERENCE_IDENTIFIER_SYSTEM,
} from 'utils/lib/fhir/billing-invoice';
import { getContainedReconciliation } from 'utils/lib/fhir/payments';
import { RecordBillingNioInvoicePaymentResponse } from 'utils/lib/types/data/billing/billing.types';
import { AR_STAGE, claimStatusValuesToTags } from 'utils/lib/types/data/billing/claim-status';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INVOICE_ATTACHMENT_PATH_PREFIX } from '../../../src/billing/attachments';
import { toClaimPatientPayment } from '../../../src/billing/claim-amounts';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('record-billing-nio-invoice-payment', () => {
  let oystehr: Oystehr;
  let oystehrBilling: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;
  let callerProfile: string;

  const seededDeletes: BatchInputDeleteRequest[] = [];
  const createdReferences: string[] = [];
  let issuerId: string;
  let claimIds: string[];
  let invoiceId: string;

  const seed = async <T extends FhirResource>(resource: T): Promise<string> => {
    const created = await oystehrBilling.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    seededDeletes.unshift({ method: 'DELETE', url: `${created.resourceType}/${created.id}` });
    return created.id!;
  };

  const seedClaim = (patientId: string, billed: number): Promise<string> =>
    seed<Claim>({
      resourceType: 'Claim',
      status: 'active',
      use: 'claim',
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
      created: '2026-09-14',
      priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
      insurance: [{ sequence: 1, focal: true, coverage: { display: 'Self-pay' } }],
      patient: { reference: `Patient/${patientId}` },
      provider: { reference: `Organization/${issuerId}` },
      total: { value: billed, currency: 'USD' },
      meta: {
        tag: claimStatusValuesToTags({ arStage: AR_STAGE.nonInsurancePayer, nonInsuranceArStatus: 'invoiced' }),
      },
    });

  const deleteAll = async (references: string[]): Promise<void> => {
    const requests: BatchInputDeleteRequest[] = references.map((reference) => ({ method: 'DELETE', url: reference }));
    if (requests.length > 0) await oystehrBilling.fhir.batch({ requests });
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/record-billing-nio-invoice-payment.test.ts',
      M2MClientMockType.provider
    );
    oystehr = setup.oystehrTestUserM2M;
    oystehrBilling = setup.oystehrBilling;
    cleanup = setup.cleanup;
    processId = setup.processId;
    callerProfile = setup.testUserM2MProfile;

    const nioId = await seed<Organization>({ resourceType: 'Organization', active: true, name: 'Integration NIO' });
    issuerId = await seed<Organization>({
      resourceType: 'Organization',
      active: true,
      name: 'Integration Medical Group',
    });
    const patientId = await seed<Patient>({
      resourceType: 'Patient',
      active: true,
      name: [{ family: 'Pruitt', given: ['Jordan'] }],
      birthDate: '1990-01-01',
    });
    claimIds = [await seedClaim(patientId, 180), await seedClaim(patientId, 95)];
    invoiceId = await seed<Invoice>({
      ...buildBillingInvoice({
        status: 'issued',
        date: '2026-09-20T12:00:00Z',
        dueDate: '2026-10-20',
        issuer: { reference: `Organization/${issuerId}` },
        recipient: { reference: `Organization/${nioId}`, display: 'Integration NIO' },
        claims: [
          { claimId: claimIds[0], amountCents: 18000 },
          { claimId: claimIds[1], amountCents: 9500 },
        ],
      }),
      identifier: [{ system: INVOICE_NUMBER_IDENTIFIER_SYSTEM, value: `INV-T${randomUUID().slice(0, 6)}` }],
    });
  }, 120_000);

  afterAll(async () => {
    try {
      const provenances = (
        await oystehrBilling.fhir.search<Provenance>({
          resourceType: 'Provenance',
          params: [{ name: 'target', value: createdReferences.join(',') }],
        })
      ).unbundle();
      await deleteAll([
        ...provenances.map((provenance) => `Provenance/${provenance.id}`),
        ...createdReferences.filter((reference) => !reference.startsWith('Claim/')),
      ]);
    } catch (error) {
      console.error('Failed to clean up recorded payment:', error);
    }
    try {
      if (seededDeletes.length > 0) await oystehrBilling.fhir.batch({ requests: seededDeletes });
    } catch (error) {
      console.error('Failed to clean up seeded fixtures; the run-tag sweep will retry:', error);
    }
    await cleanup();
  }, 120_000);

  it('records the full balance as one notice per claim, balances the invoice and keeps the attachment', async () => {
    const paymentId = randomUUID();
    const attachmentPath = `${INVOICE_ATTACHMENT_PATH_PREFIX}/${invoiceId}/${randomUUID()}-check.pdf`;

    const response = (
      await oystehr.zambda.execute({
        id: 'record-billing-nio-invoice-payment',
        invoiceId,
        amountInCents: 27500,
        paymentMethod: 'check',
        paymentDate: '2026-10-01',
        reference: 'CHK-4471',
        attachment: { path: attachmentPath, fileName: 'check.pdf' },
        idempotencyKey: paymentId,
      })
    ).output as unknown as RecordBillingNioInvoicePaymentResponse;

    const notices = (
      await oystehrBilling.fhir.search<PaymentNotice>({
        resourceType: 'PaymentNotice',
        params: [{ name: '_tag', value: `${INVOICE_PAYMENT_TAG_SYSTEM}|${invoiceId}` }],
      })
    ).unbundle();
    const attachments = (
      await oystehrBilling.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [{ name: 'identifier', value: `${NIO_INVOICE_PAYMENT_ID_SYSTEM}|${paymentId}` }],
      })
    ).unbundle();
    createdReferences.push(
      ...notices.map((notice) => `PaymentNotice/${notice.id}`),
      ...attachments.map((documentReference) => `DocumentReference/${documentReference.id}`),
      ...claimIds.map((claimId) => `Claim/${claimId}`)
    );

    expect(response).toEqual({ paymentId });
    const invoice = await oystehrBilling.fhir.get<Invoice>({ resourceType: 'Invoice', id: invoiceId });
    expect(invoice.status).toBe('balanced');

    expect(
      notices
        .map((notice) => ({
          claim: notice.request?.reference,
          payee: notice.payee?.reference,
          paymentId: notice.identifier?.find(({ system }) => system === NIO_INVOICE_PAYMENT_ID_SYSTEM)?.value,
          reference: getContainedReconciliation(notice)?.identifier?.find(
            ({ system }) => system === PAYMENT_REFERENCE_IDENTIFIER_SYSTEM
          )?.value,
          ...toClaimPatientPayment(notice),
        }))
        .sort((a, b) => b.amount - a.amount)
    ).toEqual([
      expect.objectContaining({
        claim: `Claim/${claimIds[0]}`,
        payee: `Organization/${issuerId}`,
        paymentId,
        reference: 'CHK-4471',
        amount: 180,
        method: 'check',
        paymentDate: '2026-10-01',
        status: 'active',
      }),
      expect.objectContaining({
        claim: `Claim/${claimIds[1]}`,
        payee: `Organization/${issuerId}`,
        paymentId,
        reference: 'CHK-4471',
        amount: 95,
        method: 'check',
        paymentDate: '2026-10-01',
        status: 'active',
      }),
    ]);

    expect(attachments).toHaveLength(1);
    expect(attachments[0].content[0].attachment.title).toBe('check.pdf');
    expect(attachments[0].content[0].attachment.url).toContain(attachmentPath);
    expect(notices.map((notice) => `PaymentNotice/${notice.id}`)).toContain(
      attachments[0].context?.related?.[0]?.reference
    );

    const history = (
      await oystehrBilling.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: notices.map((notice) => `PaymentNotice/${notice.id}`).join(',') }],
      })
    ).unbundle();
    expect(history).toHaveLength(2);
    for (const entry of history) {
      expect(entry.agent[0].who?.reference).toBe(callerProfile);
    }
  }, 120_000);
});
