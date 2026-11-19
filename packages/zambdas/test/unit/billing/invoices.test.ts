import Oystehr from '@oystehr/sdk';
import { Invoice } from 'fhir/r4b';
import {
  buildBillingInvoice,
  BuildBillingInvoiceInput,
  INVOICE_CLAIM_TAG_SYSTEM,
} from 'utils/lib/fhir/billing-invoice';
import { BILLING_RESOURCE_TAG } from 'utils/lib/fhir/constants';
import { describe, expect, it, vi } from 'vitest';
import { createInvoiceUnlessClaimsHaveOne } from '../../../src/billing/invoices';

const invoiceFor = (claims: BuildBillingInvoiceInput['claims']): Invoice =>
  buildBillingInvoice({
    status: 'issued',
    date: '2026-11-05T12:00:00Z',
    dueDate: '2026-12-05',
    recipient: {
      reference: 'Organization/nio-1',
    },
    claims,
  });

const makeOystehr = (): { oystehr: Oystehr; create: ReturnType<typeof vi.fn> } => {
  const create = vi.fn(async (invoice: Invoice) => ({
    ...invoice,
    id: 'inv-1',
  }));
  return {
    oystehr: {
      fhir: {
        create,
      },
    } as unknown as Oystehr,
    create,
  };
};

describe('createInvoiceUnlessClaimsHaveOne', () => {
  it('creates the invoice only if none of its claims is on an active billing invoice', async () => {
    const { oystehr, create } = makeOystehr();
    const invoice = invoiceFor([
      {
        claimId: 'claim-1',
        amountCents: 5000,
      },
      {
        claimId: 'claim-2',
        amountCents: 2500,
      },
    ]);

    const saved = await createInvoiceUnlessClaimsHaveOne(oystehr, invoice);

    expect(saved.id).toBe('inv-1');
    expect(create).toHaveBeenCalledWith(invoice, {
      ifNoneExist: [
        {
          name: '_tag',
          value: `${INVOICE_CLAIM_TAG_SYSTEM}|claim-1,${INVOICE_CLAIM_TAG_SYSTEM}|claim-2`,
        },
        {
          name: '_tag',
          value: `${BILLING_RESOURCE_TAG.system}|${BILLING_RESOURCE_TAG.code}`,
        },
        {
          name: 'status',
          value: 'draft,issued,balanced',
        },
      ],
    });
  });
});
