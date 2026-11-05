import { PDFDocument } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';
import {
  formatInvoiceAddressLines,
  NioInvoicePdfData,
  NioInvoicePdfLine,
  renderNioInvoicePdf,
} from '../../../src/shared/pdf/nio-invoice-pdf';

const { drawnText } = vi.hoisted(() => ({ drawnText: [] as string[] }));

vi.mock('../../../src/shared/pdf/pdf-utils', async (importActual) => {
  const actual = await importActual<typeof import('../../../src/shared/pdf/pdf-utils')>();
  return {
    ...actual,
    createPdfClient: async (...args: Parameters<typeof actual.createPdfClient>) => {
      const client = await actual.createPdfClient(...args);
      return {
        ...client,
        drawStartXPosSpecifiedText: (...call: Parameters<typeof client.drawStartXPosSpecifiedText>) => {
          drawnText.push(call[0]);
          return client.drawStartXPosSpecifiedText(...call);
        },
      };
    },
  };
});

const line = (overrides: Partial<NioInvoicePdfLine> = {}): NioInvoicePdfLine => ({
  claimId: 'claim-1',
  patientName: 'Jordan Pruitt',
  serviceDate: '2026-09-14',
  service: 'Office Visit',
  amountCents: 18000,
  ...overrides,
});

const data = (overrides: Partial<NioInvoicePdfData> = {}): NioInvoicePdfData => ({
  invoiceNumber: 'INV-00042',
  issueDate: '2026-10-03',
  dueDate: '2026-11-02',
  issuer: {
    name: 'Sunrise Pediatrics',
    address: {
      line: ['2500 Medical Plaza Drive', 'Suite 400'],
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
    },
  },
  billTo: {
    name: 'Acme Health Services',
    address: {
      line: ['4820 Commerce Parkway'],
      city: 'Austin',
      state: 'TX',
      postalCode: '78744',
    },
  },
  lines: [
    line(),
    line({
      claimId: 'claim-2',
      patientName: 'Maya Collins',
      serviceDate: '2026-09-18',
      service: 'Sports Physical',
      amountCents: 9550,
    }),
  ],
  ...overrides,
});

const render = async (input: NioInvoicePdfData): Promise<{ document: PDFDocument; text: string[] }> => {
  drawnText.length = 0;
  const bytes = await renderNioInvoicePdf(input);
  return {
    document: await PDFDocument.load(bytes),
    text: drawnText.map((text) => text.trim()),
  };
};

describe('formatInvoiceAddressLines', () => {
  it('puts the street on one line and the city, state and ZIP on the next', () => {
    expect(formatInvoiceAddressLines(data().issuer.address)).toEqual([
      '2500 Medical Plaza Drive, Suite 400',
      'Austin, TX 78701',
    ]);
  });

  it('drops the parts an address is missing', () => {
    expect(
      formatInvoiceAddressLines({
        city: 'Austin',
        postalCode: '78701',
      })
    ).toEqual(['Austin, 78701']);
    expect(formatInvoiceAddressLines(undefined)).toEqual([]);
  });
});

describe('renderNioInvoicePdf', () => {
  it('prints the issuer, recipient, invoice identity, every claim and the total on one page', async () => {
    const { document, text } = await render(data());

    expect(document.getPageCount()).toBe(1);
    expect(text).toEqual(
      expect.arrayContaining([
        'Sunrise Pediatrics',
        '2500 Medical Plaza Drive, Suite 400',
        'Austin, TX 78701',
        'INVOICE',
        'Invoice #: INV-00042',
        'Issue date: 10/03/2026',
        'Due date: 11/02/2026',
        'BILL TO',
        'Acme Health Services',
        '4820 Commerce Parkway',
        'Austin, TX 78744',
        '09/14/2026',
        'Jordan Pruitt',
        'Office Visit',
        'claim-1',
        '$180.00',
        'claim-2',
        '$95.50',
        'Claims (2)',
        'Total due',
      ])
    );
    expect(text.filter((value) => value === '$275.50')).toHaveLength(2);
  });

  it('renders a recipient with no address on file', async () => {
    const { text } = await render(data({ billTo: { name: 'Acme Health Services' } }));
    expect(text).toContain('Acme Health Services');
  });

  it('repeats the column header on every page of a long invoice', async () => {
    const { document, text } = await render(
      data({
        lines: Array.from({ length: 60 }, (_, index) => line({ claimId: `claim-${index}` })),
      })
    );

    expect(document.getPageCount()).toBeGreaterThan(1);
    expect(text.filter((value) => value === 'Amount Due')).toHaveLength(document.getPageCount());
    expect(text).toContain('claim-59');
  });

  it('refuses to render an invoice with no claims', async () => {
    await expect(renderNioInvoicePdf(data({ lines: [] }))).rejects.toThrow('at least one claim line');
  });
});
