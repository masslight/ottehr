import Oystehr from '@oystehr/sdk';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';
import { NioInvoiceDraft } from '../../../src/billing/nio-invoice';
import { performEffect, PREVIEW_INVOICE_NUMBER } from '../../../src/billing/preview-billing-nio-invoice';
import { renderNioInvoicePdf } from '../../../src/shared/pdf/nio-invoice-pdf';

const { mockAssembleNioInvoice } = vi.hoisted(() => ({
  mockAssembleNioInvoice: vi.fn(),
}));

vi.mock('../../../src/shared/sentry', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));
vi.mock('../../../src/billing/nio-invoice', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  assembleNioInvoice: (...args: unknown[]) => mockAssembleNioInvoice(...args),
}));
vi.mock('../../../src/shared/pdf/nio-invoice-pdf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/pdf/nio-invoice-pdf')>();
  return {
    ...actual,
    renderNioInvoicePdf: vi.fn(actual.renderNioInvoicePdf),
  };
});

const draft: NioInvoiceDraft = {
  invoice: {
    status: 'issued',
    date: '2026-10-03T15:00:00.000Z',
    dueDate: '2026-10-10',
    recipient: {
      reference: 'Organization/nio-1',
    },
    claims: [
      {
        claimId: 'claim-1',
        amountCents: 18000,
      },
    ],
  },
  pdf: {
    issueDate: '2026-10-03',
    dueDate: '2026-10-10',
    issuer: {
      name: 'Main Clinic',
      address: {
        line: ['1 Clinic Way'],
      },
    },
    billTo: {
      name: 'Acme Health Services',
    },
    lines: [
      {
        claimId: 'claim-1',
        patientName: 'Pruitt, Jordan',
        serviceDate: '2026-09-14',
        service: 'Office Visit',
        amountCents: 18000,
      },
    ],
  },
};

describe('preview-billing-nio-invoice', () => {
  it('renders the assembled invoice as a PDF without taking a number or saving anything', async () => {
    mockAssembleNioInvoice.mockResolvedValue(draft);
    const create = vi.fn();
    const oystehr = {
      fhir: {
        create,
      },
    } as unknown as Oystehr;

    const { pdfBase64 } = await performEffect({
      oystehr,
      claimIds: ['claim-1'],
    });

    expect(mockAssembleNioInvoice).toHaveBeenCalledWith({
      oystehr,
      claimIds: ['claim-1'],
    });
    expect(renderNioInvoicePdf).toHaveBeenCalledWith({
      ...draft.pdf,
      invoiceNumber: PREVIEW_INVOICE_NUMBER,
    });
    expect(create).not.toHaveBeenCalled();
    const document = await PDFDocument.load(Buffer.from(pdfBase64, 'base64'));
    expect(document.getPageCount()).toBe(1);
  });
});
