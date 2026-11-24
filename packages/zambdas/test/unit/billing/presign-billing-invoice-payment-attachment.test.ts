import Oystehr from '@oystehr/sdk';
import { Invoice } from 'fhir/r4b';
import { buildBillingInvoice } from 'utils/lib/fhir/billing-invoice';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../../src/billing/presign-billing-invoice-payment-attachment';

vi.mock('../../../src/shared/sentry', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));

const INVOICE_ID = 'invoice-1';

const invoice = (recipient: string): Invoice => ({
  ...buildBillingInvoice({
    status: 'issued',
    date: '2026-11-01T15:00:00.000Z',
    dueDate: '2026-11-30',
    recipient: {
      reference: recipient,
    },
    claims: [
      {
        claimId: 'claim-1',
        amountCents: 18000,
      },
    ],
  }),
  id: INVOICE_ID,
});

const setup = (found: Invoice): { oystehr: Oystehr; getPresignedUrl: ReturnType<typeof vi.fn> } => {
  const getPresignedUrl = vi.fn(async () => ({
    signedUrl: 'https://z3.test/upload',
  }));
  return {
    oystehr: {
      fhir: {
        search: vi.fn(async () => ({
          unbundle: () => [found],
        })),
      },
      z3: {
        getPresignedUrl,
      },
    } as unknown as Oystehr,
    getPresignedUrl,
  };
};

const params = {
  invoiceId: INVOICE_ID,
  fileName: 'check 88123.pdf',
  secrets: {
    PROJECT_ID: 'project-1',
  },
};

describe('presign-billing-invoice-payment-attachment', () => {
  it("presigns an upload into the invoice's folder", async () => {
    const { oystehr, getPresignedUrl } = setup(invoice('Organization/nio-1'));

    const result = await performEffect({
      oystehr,
      params,
    });

    expect(result).toEqual({
      uploadUrl: 'https://z3.test/upload',
      path: expect.stringMatching(new RegExp(`^invoice-attachments/${INVOICE_ID}/.+-check`)),
    });
    expect(getPresignedUrl).toHaveBeenCalledWith({
      bucketName: 'project-1-billing-app',
      'objectPath+': result.path,
      action: 'upload',
    });
  });

  it('refuses a patient invoice', async () => {
    const { oystehr } = setup(invoice('Patient/pat-1'));

    await expect(
      performEffect({
        oystehr,
        params,
      })
    ).rejects.toEqual(INVALID_INPUT_ERROR('Only non-insurance payer invoices take recorded payments'));
  });
});
