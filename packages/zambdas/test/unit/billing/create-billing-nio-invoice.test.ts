import Oystehr from '@oystehr/sdk';
import { DocumentReference, Invoice } from 'fhir/r4b';
import {
  BILLING_INVOICE_IDEMPOTENCY_KEY_SYSTEM,
  buildBillingInvoice,
  INVOICE_NUMBER_IDENTIFIER_SYSTEM,
} from 'utils/lib/fhir/billing-invoice';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../../src/billing/create-billing-nio-invoice';
import { NioInvoiceDraft } from '../../../src/billing/nio-invoice';
import { renderNioInvoicePdf } from '../../../src/shared/pdf/nio-invoice-pdf';

const {
  mockAssembleNioInvoice,
  mockIssueInvoiceNumber,
  mockCreateInvoiceUnlessClaimsHaveOne,
  mockFetchActiveClaimInvoices,
  mockUploadObjectToZ3,
} = vi.hoisted(() => ({
  mockAssembleNioInvoice: vi.fn(),
  mockIssueInvoiceNumber: vi.fn(),
  mockCreateInvoiceUnlessClaimsHaveOne: vi.fn(),
  mockFetchActiveClaimInvoices: vi.fn(),
  mockUploadObjectToZ3: vi.fn(),
}));

vi.mock('../../../src/shared/sentry', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));
vi.mock('../../../src/billing/nio-invoice', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  assembleNioInvoice: (...args: unknown[]) => mockAssembleNioInvoice(...args),
}));
vi.mock('../../../src/billing/invoice-number', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  issueInvoiceNumber: (...args: unknown[]) => mockIssueInvoiceNumber(...args),
}));
vi.mock('../../../src/billing/invoices', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createInvoiceUnlessClaimsHaveOne: (...args: unknown[]) => mockCreateInvoiceUnlessClaimsHaveOne(...args),
  fetchActiveClaimInvoices: (...args: unknown[]) => mockFetchActiveClaimInvoices(...args),
}));
vi.mock('utils/lib/helpers/presigned-file-url/helpers', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  uploadObjectToZ3: (...args: unknown[]) => mockUploadObjectToZ3(...args),
}));
vi.mock('../../../src/shared/pdf/nio-invoice-pdf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/pdf/nio-invoice-pdf')>();
  return {
    ...actual,
    renderNioInvoicePdf: vi.fn(actual.renderNioInvoicePdf),
  };
});

const PROJECT_API = 'https://project-api.test';
const PROJECT_ID = 'project-1';
const secrets = {
  PROJECT_API,
  PROJECT_ID,
};
const CLAIM_IDS = ['claim-1', 'claim-2'];
const KEY = 'key-1';

const draft: NioInvoiceDraft = {
  nioId: 'nio-1',
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
      {
        claimId: 'claim-2',
        amountCents: 9500,
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
      {
        claimId: 'claim-2',
        patientName: 'Pruitt, Jordan',
        serviceDate: '2026-09-15',
        service: 'Office Visit',
        amountCents: 9500,
      },
    ],
  },
};

const savedInvoice = ({
  id = 'invoice-1',
  number = 'INV-00042',
  key = KEY,
  input = draft.invoice,
}: {
  id?: string;
  number?: string;
  key?: string;
  input?: NioInvoiceDraft['invoice'];
} = {}): Invoice => ({
  ...buildBillingInvoice(input),
  id,
  meta: {
    versionId: '1',
  },
  identifier: [
    {
      system: INVOICE_NUMBER_IDENTIFIER_SYSTEM,
      value: number,
    },
    {
      system: BILLING_INVOICE_IDEMPOTENCY_KEY_SYSTEM,
      value: key,
    },
  ],
});

const invoicePdf = (invoiceId: string): DocumentReference => ({
  resourceType: 'DocumentReference',
  id: 'doc-1',
  status: 'current',
  content: [
    {
      attachment: {
        url: `${PROJECT_API}/z3/${PROJECT_ID}-billing-app/invoice-attachments/${invoiceId}/abc-INV-00042.pdf`,
      },
    },
  ],
  context: {
    related: [
      {
        reference: `Invoice/${invoiceId}`,
      },
    ],
  },
});

const setup = ({
  invoicesByKey = [],
  pdfs = [],
}: {
  invoicesByKey?: Invoice[];
  pdfs?: DocumentReference[];
} = {}): {
  oystehr: Oystehr;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
} => {
  const create = vi.fn(async (resource: DocumentReference) => ({
    ...resource,
    id: 'doc-new',
  }));
  const update = vi.fn(async (resource: Invoice) => resource);
  const oystehr = {
    fhir: {
      search: vi.fn(async ({ resourceType }: { resourceType: string }) => ({
        unbundle: () => (resourceType === 'Invoice' ? invoicesByKey : pdfs),
      })),
      create,
      update,
    },
    z3: {
      getPresignedUrl: vi.fn(async ({ action }: { action: string }) => ({
        signedUrl: `https://z3.test/${action}`,
      })),
    },
  } as unknown as Oystehr;
  return {
    oystehr,
    create,
    update,
  };
};

const run = (oystehr: Oystehr): ReturnType<typeof performEffect> =>
  performEffect({
    oystehr,
    claimIds: CLAIM_IDS,
    idempotencyKey: KEY,
    secrets,
  });

describe('create-billing-nio-invoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssembleNioInvoice.mockResolvedValue(draft);
    mockIssueInvoiceNumber.mockResolvedValue('INV-00042');
    mockCreateInvoiceUnlessClaimsHaveOne.mockImplementation(async (_oystehr: Oystehr, invoice: Invoice) => ({
      ...invoice,
      id: 'invoice-1',
      meta: {
        ...invoice.meta,
        versionId: '1',
      },
    }));
    mockFetchActiveClaimInvoices.mockImplementation(async () => [savedInvoice()]);
    mockUploadObjectToZ3.mockResolvedValue(undefined);
  });

  it('saves a numbered invoice, uploads its PDF and returns a download link', async () => {
    const { oystehr, create } = setup();

    const response = await run(oystehr);

    const [, invoice] = mockCreateInvoiceUnlessClaimsHaveOne.mock.calls[0] as [Oystehr, Invoice];
    expect(invoice.identifier).toEqual([
      {
        system: INVOICE_NUMBER_IDENTIFIER_SYSTEM,
        value: 'INV-00042',
      },
      {
        system: BILLING_INVOICE_IDEMPOTENCY_KEY_SYSTEM,
        value: KEY,
      },
    ]);
    expect(renderNioInvoicePdf).toHaveBeenCalledWith({
      ...draft.pdf,
      invoiceNumber: 'INV-00042',
    });
    expect(mockUploadObjectToZ3).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      'https://z3.test/upload',
      'application/pdf'
    );
    const [documentReference] = create.mock.calls[0] as [DocumentReference];
    expect(documentReference.context?.related).toEqual([
      {
        reference: 'Invoice/invoice-1',
      },
    ]);
    expect(documentReference.content[0].attachment.url).toMatch(
      new RegExp(`^${PROJECT_API}/z3/.+/invoice-attachments/invoice-1/.+-INV-00042\\.pdf$`)
    );
    expect(response).toEqual({
      invoiceId: 'invoice-1',
      invoiceNumber: 'INV-00042',
      pdfUrl: 'https://z3.test/download',
    });
  });

  it('returns the earlier attempt’s invoice and PDF when retried after both were saved', async () => {
    const { oystehr, create } = setup({
      invoicesByKey: [savedInvoice()],
      pdfs: [invoicePdf('invoice-1')],
    });

    const response = await run(oystehr);

    expect(mockAssembleNioInvoice).not.toHaveBeenCalled();
    expect(mockCreateInvoiceUnlessClaimsHaveOne).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(response).toEqual({
      invoiceId: 'invoice-1',
      invoiceNumber: 'INV-00042',
      pdfUrl: 'https://z3.test/download',
    });
  });

  it('finishes the PDF from the saved invoice when retried after only the invoice was saved', async () => {
    const saved = savedInvoice({
      number: 'INV-00007',
      input: {
        ...draft.invoice,
        date: '2026-10-01T15:00:00.000Z',
        dueDate: '2026-10-08',
        claims: [
          {
            claimId: 'claim-1',
            amountCents: 20000,
          },
          {
            claimId: 'claim-2',
            amountCents: 9500,
          },
        ],
      },
    });
    const { oystehr, create } = setup({
      invoicesByKey: [saved],
    });

    const response = await run(oystehr);

    expect(mockAssembleNioInvoice).toHaveBeenCalledWith({
      oystehr,
      claimIds: CLAIM_IDS,
      resumedInvoiceId: 'invoice-1',
    });
    expect(mockCreateInvoiceUnlessClaimsHaveOne).not.toHaveBeenCalled();
    expect(mockIssueInvoiceNumber).not.toHaveBeenCalled();
    expect(renderNioInvoicePdf).toHaveBeenCalledWith({
      ...draft.pdf,
      invoiceNumber: 'INV-00007',
      issueDate: '2026-10-01',
      dueDate: '2026-10-08',
      lines: [
        {
          ...draft.pdf.lines[0],
          amountCents: 20000,
        },
        draft.pdf.lines[1],
      ],
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(response.invoiceNumber).toBe('INV-00007');
  });

  it('refuses to finish the PDF when the claims moved to another payer after the invoice was saved', async () => {
    mockAssembleNioInvoice.mockResolvedValue({
      ...draft,
      nioId: 'nio-2',
    });
    const { oystehr, create } = setup({
      invoicesByKey: [savedInvoice()],
    });

    await expect(run(oystehr)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(renderNioInvoicePdf).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses an idempotency key that a patient invoice already used for the same claims', async () => {
    const { oystehr } = setup({
      invoicesByKey: [
        savedInvoice({
          input: {
            ...draft.invoice,
            recipient: {
              reference: 'Patient/patient-1',
            },
          },
        }),
      ],
      pdfs: [invoicePdf('invoice-1')],
    });

    await expect(run(oystehr)).rejects.toMatchObject({
      message: 'This idempotency key was already used for a patient invoice',
    });
    expect(mockAssembleNioInvoice).not.toHaveBeenCalled();
  });

  it('refuses an idempotency key that already invoiced other claims', async () => {
    const { oystehr } = setup({
      invoicesByKey: [
        savedInvoice({
          input: {
            ...draft.invoice,
            claims: [draft.invoice.claims[0]],
          },
        }),
      ],
    });

    await expect(run(oystehr)).rejects.toMatchObject({
      message: 'This idempotency key was already used to invoice other claims',
    });
    expect(mockAssembleNioInvoice).not.toHaveBeenCalled();
  });

  it('refuses when another request’s invoice already holds the claims', async () => {
    mockCreateInvoiceUnlessClaimsHaveOne.mockResolvedValue(
      savedInvoice({
        id: 'invoice-other',
        key: 'key-other',
      })
    );
    const { oystehr, create } = setup();

    await expect(run(oystehr)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses when a concurrent request with the same key saved an invoice for other claims', async () => {
    mockCreateInvoiceUnlessClaimsHaveOne.mockResolvedValue(
      savedInvoice({
        input: {
          ...draft.invoice,
          claims: [draft.invoice.claims[0]],
        },
      })
    );
    const { oystehr, create } = setup();

    await expect(run(oystehr)).rejects.toMatchObject({
      message: 'This idempotency key was already used to invoice other claims',
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses with a conflict when several invoices already hold the claims', async () => {
    mockCreateInvoiceUnlessClaimsHaveOne.mockRejectedValue(
      new Oystehr.OystehrSdkError({
        code: 412,
        message: 'multiple matches',
      })
    );
    const { oystehr } = setup();

    await expect(run(oystehr)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('withdraws its invoice when an overlapping request saved a lower numbered one', async () => {
    mockFetchActiveClaimInvoices.mockResolvedValue([
      savedInvoice(),
      savedInvoice({
        id: 'invoice-rival',
        number: 'INV-00041',
        key: 'key-rival',
      }),
    ]);
    const { oystehr, create, update } = setup();

    await expect(run(oystehr)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'invoice-1',
        status: 'entered-in-error',
      }),
      {
        optimisticLockingVersionId: '1',
      }
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('withdraws its invoice when an overlapping unnumbered draft holds the claims', async () => {
    mockFetchActiveClaimInvoices.mockResolvedValue([
      savedInvoice(),
      {
        ...buildBillingInvoice({
          ...draft.invoice,
          status: 'draft',
        }),
        id: 'invoice-draft',
      },
    ]);
    const { oystehr, update } = setup();

    await expect(run(oystehr)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'invoice-1',
        status: 'entered-in-error',
      }),
      {
        optimisticLockingVersionId: '1',
      }
    );
  });

  it('keeps its invoice when an overlapping request saved a higher numbered one', async () => {
    mockFetchActiveClaimInvoices.mockResolvedValue([
      savedInvoice(),
      savedInvoice({
        id: 'invoice-rival',
        number: 'INV-100000',
        key: 'key-rival',
      }),
    ]);
    const { oystehr, update } = setup();

    const response = await run(oystehr);

    expect(update).not.toHaveBeenCalled();
    expect(response.invoiceId).toBe('invoice-1');
  });
});
