import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { FhirResource, Invoice, Organization } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { buildBillingInvoice } from 'utils/lib/fhir/billing-invoice';
import { PresignBillingInvoicePaymentAttachmentResponse } from 'utils/lib/types/data/billing/billing.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INVOICE_ATTACHMENT_PATH_PREFIX } from '../../../src/billing/attachments';
import { BILLING_APP_BUCKET, createBillingClient } from '../../../src/billing/shared';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';
import { loadZambdaSecrets } from '../../helpers/invoke-zambda-handler';

describe('presign-billing-invoice-payment-attachment', () => {
  let oystehr: Oystehr;
  let oystehrBilling: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;

  const secrets = loadZambdaSecrets();
  const bucketName = BILLING_APP_BUCKET(secrets.PROJECT_ID);
  const seededDeletes: BatchInputDeleteRequest[] = [];
  const uploadedPaths: string[] = [];
  let invoiceId: string;

  const seed = async <T extends FhirResource>(resource: T): Promise<string> => {
    const created = await oystehrBilling.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    seededDeletes.unshift({ method: 'DELETE', url: `${created.resourceType}/${created.id}` });
    return created.id!;
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/presign-billing-invoice-payment-attachment.test.ts',
      M2MClientMockType.provider
    );
    oystehr = setup.oystehrTestUserM2M;
    oystehrBilling = createBillingClient(setup.token, secrets);
    cleanup = setup.cleanup;
    processId = setup.processId;

    const nioId = await seed<Organization>({ resourceType: 'Organization', active: true, name: 'Integration NIO' });
    invoiceId = await seed<Invoice>(
      buildBillingInvoice({
        status: 'issued',
        date: '2026-09-20T12:00:00Z',
        dueDate: '2026-10-20',
        recipient: { reference: `Organization/${nioId}` },
        claims: [{ claimId: '7f4e9a52-3c1d-4b8e-9f2a-6d5c4b3a2e1f', amountCents: 4200 }],
      })
    );
  }, 120_000);

  afterAll(async () => {
    for (const path of uploadedPaths) {
      try {
        await oystehrBilling.z3.deleteObject({ bucketName, 'objectPath+': path });
      } catch (error) {
        console.error(`Failed to delete uploaded attachment ${path}:`, error);
      }
    }
    try {
      if (seededDeletes.length > 0) await oystehrBilling.fhir.batch({ requests: seededDeletes });
    } catch (error) {
      console.error('Failed to clean up seeded fixtures; the run-tag sweep will retry:', error);
    }
    await cleanup();
  }, 120_000);

  it("returns an upload link into the invoice's attachment folder that accepts the file", async () => {
    const response = (
      await oystehr.zambda.execute({
        id: 'presign-billing-invoice-payment-attachment',
        invoiceId,
        fileName: 'remittance advice.pdf',
      })
    ).output as unknown as PresignBillingInvoicePaymentAttachmentResponse;

    expect(response.path.startsWith(`${INVOICE_ATTACHMENT_PATH_PREFIX}/${invoiceId}/`)).toBe(true);
    expect(response.path).toMatch(/remittance.advice\.pdf$/);

    const content = `%PDF-1.4 remittance for ${invoiceId}`;
    const upload = await fetch(response.uploadUrl, {
      method: 'PUT',
      body: content,
      headers: { 'Content-Type': 'application/pdf' },
    });
    expect(upload.ok).toBe(true);
    uploadedPaths.push(response.path);

    const { signedUrl } = await oystehrBilling.z3.getPresignedUrl({
      bucketName,
      'objectPath+': response.path,
      action: 'download',
    });
    expect(await (await fetch(signedUrl)).text()).toBe(content);
  }, 120_000);
});
