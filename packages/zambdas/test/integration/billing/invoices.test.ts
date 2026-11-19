import { randomUUID } from 'node:crypto';
import Oystehr from '@oystehr/sdk';
import { Invoice } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { buildBillingInvoice } from 'utils/lib/fhir/billing-invoice';
import { BILLING_INVOICE_LIMITS } from 'utils/lib/types/data/billing/billing.constants';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createInvoiceUnlessClaimsHaveOne } from '../../../src/billing/invoices';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('createInvoiceUnlessClaimsHaveOne', () => {
  let oystehr: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;
  const invoiceIds = new Set<string>();

  beforeAll(async () => {
    const setup = await setupIntegrationTest('integration/billing/invoices.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehrBilling;
    cleanup = setup.cleanup;
    processId = setup.processId;
  }, 120_000);

  afterAll(async () => {
    for (const id of invoiceIds) {
      try {
        await oystehr.fhir.delete({
          resourceType: 'Invoice',
          id,
        });
      } catch (error) {
        console.error(`Failed to clean up invoice ${id}:`, error);
      }
    }
    await cleanup();
  }, 120_000);

  it('returns the saved invoice on retry for the most claims an NIO invoice can hold', async () => {
    const invoice = addProcessIdMetaTagToResource(
      buildBillingInvoice({
        status: 'issued',
        date: '2026-11-05T12:00:00Z',
        dueDate: '2026-12-05',
        recipient: {
          reference: `Organization/${randomUUID()}`,
        },
        claims: Array.from(
          {
            length: BILLING_INVOICE_LIMITS.nioInvoiceClaimCount,
          },
          () => ({
            claimId: randomUUID(),
            amountCents: 100,
          })
        ),
      }),
      processId
    ) as Invoice;

    const first = await createInvoiceUnlessClaimsHaveOne(oystehr, invoice);
    invoiceIds.add(first.id!);
    const retry = await createInvoiceUnlessClaimsHaveOne(oystehr, invoice);
    invoiceIds.add(retry.id!);

    expect(first.id).toBeDefined();
    expect(retry.id).toBe(first.id);
  }, 120_000);
});
