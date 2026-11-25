import Oystehr from '@oystehr/sdk';
import { Claim, DocumentReference, Invoice, Organization, Patient, PaymentNotice } from 'fhir/r4b';
import {
  buildBillingInvoice,
  INVOICE_NUMBER_IDENTIFIER_SYSTEM,
  invoicePaymentExtension,
  invoicePaymentTag,
  NIO_INVOICE_PAYMENT_ID_SYSTEM,
  PAYMENT_REFERENCE_IDENTIFIER_SYSTEM,
} from 'utils/lib/fhir/billing-invoice';
import { PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { AR_STAGE, CLAIM_STATUS_TAG_SYSTEMS } from 'utils/lib/types/data/billing/claim-status';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../../src/billing/get-billing-invoice';
import { buildInvoicePaymentAttachment } from '../../../src/billing/invoices';

vi.mock('../../../src/shared/sentry', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));

const PROJECT_API = 'https://project-api.test';
const PROJECT_ID = 'project-1';
const secrets = {
  PROJECT_API,
  PROJECT_ID,
};
const INVOICE_ID = 'invoice-1';
const TODAY = '2026-10-20';

const nio: Organization = {
  resourceType: 'Organization',
  id: 'nio-1',
  name: 'Acme Health Services',
};

const patient: Patient = {
  resourceType: 'Patient',
  id: 'pat-1',
  name: [
    {
      given: ['Jordan'],
      family: 'Pruitt',
    },
  ],
};

const claim: Claim = {
  resourceType: 'Claim',
  id: 'claim-1',
  status: 'active',
  use: 'claim',
  created: '2026-09-14',
  type: {},
  priority: {},
  provider: {},
  insurance: [],
  patient: {
    reference: 'Patient/pat-1',
  },
  billablePeriod: {
    start: '2026-09-14T10:00:00-04:00',
  },
  meta: {
    tag: [
      {
        system: CLAIM_STATUS_TAG_SYSTEMS.arStage,
        code: AR_STAGE.nonInsurancePayer,
      },
      {
        system: CLAIM_STATUS_TAG_SYSTEMS.nonInsuranceArStatus,
        code: 'invoiced',
      },
    ],
  },
};

const nioInvoice = ({ dueDate = '2026-10-10' }: { dueDate?: string } = {}): Invoice => ({
  ...buildBillingInvoice({
    status: 'issued',
    date: '2026-10-03T15:00:00.000Z',
    dueDate,
    recipient: {
      reference: 'Organization/nio-1',
    },
    claims: [
      {
        claimId: 'claim-1',
        amountCents: 18000,
      },
    ],
  }),
  id: INVOICE_ID,
  identifier: [
    {
      system: INVOICE_NUMBER_IDENTIFIER_SYSTEM,
      value: 'INV-00042',
    },
  ],
});

const payment = (status: PaymentNotice['status']): PaymentNotice => ({
  resourceType: 'PaymentNotice',
  id: `notice-${status}`,
  status,
  created: '2026-10-15',
  paymentDate: '2026-10-15',
  payment: {},
  recipient: {},
  amount: {
    value: 50,
    currency: 'USD',
  },
  meta: {
    tag: [invoicePaymentTag(INVOICE_ID)],
  },
  extension: [
    invoicePaymentExtension(INVOICE_ID),
    {
      url: PAYMENT_METHOD_EXTENSION_URL,
      valueString: 'check',
    },
  ],
  contained: [
    {
      resourceType: 'PaymentReconciliation',
      status: 'active',
      created: '2026-10-15',
      paymentDate: '2026-10-15',
      paymentAmount: {
        value: 50,
        currency: 'USD',
      },
      identifier: [
        {
          system: PAYMENT_REFERENCE_IDENTIFIER_SYSTEM,
          value: '88123',
        },
      ],
    },
  ],
});

const invoicePdf: DocumentReference = {
  resourceType: 'DocumentReference',
  id: 'doc-1',
  status: 'current',
  content: [
    {
      attachment: {
        url: `${PROJECT_API}/z3/${PROJECT_ID}-billing-app/invoice-attachments/${INVOICE_ID}/abc-INV-00042.pdf`,
      },
    },
  ],
  context: {
    related: [
      {
        reference: `Invoice/${INVOICE_ID}`,
      },
    ],
  },
};

const setup = ({
  invoices = [nioInvoice()],
  organizations = [nio],
  claims = [claim],
  notices = [],
  pdfs = [invoicePdf],
  paymentAttachments = [],
}: {
  invoices?: Invoice[];
  organizations?: Organization[];
  claims?: Claim[];
  notices?: PaymentNotice[];
  pdfs?: DocumentReference[];
  paymentAttachments?: DocumentReference[];
} = {}): { oystehr: Oystehr; search: ReturnType<typeof vi.fn> } => {
  const resultsByType: Record<string, unknown[]> = {
    Invoice: [...invoices, ...organizations],
    Claim: [...claims, patient],
    PaymentNotice: notices,
  };
  const search = vi.fn(
    async ({ resourceType, params }: { resourceType: string; params: { name: string; value: string }[] }) => ({
      unbundle: () => {
        if (resourceType !== 'DocumentReference') return resultsByType[resourceType];
        return params.some((param) => param.name === 'identifier') ? paymentAttachments : pdfs;
      },
    })
  );
  const oystehr = {
    fhir: {
      search,
    },
    z3: {
      getPresignedUrl: vi.fn(async ({ action, 'objectPath+': path }: { action: string; 'objectPath+': string }) => ({
        signedUrl: `https://z3.test/${action}/${path}`,
      })),
    },
  } as unknown as Oystehr;
  return {
    oystehr,
    search,
  };
};

describe('get-billing-invoice', () => {
  it('returns an NIO invoice with its recipient, claim lines, payments, balance and PDF link', async () => {
    const { oystehr } = setup({
      notices: [payment('active'), payment('cancelled')],
    });

    const result = await performEffect({
      oystehr,
      invoiceId: INVOICE_ID,
      secrets,
      today: TODAY,
    });

    expect(result).toEqual({
      id: INVOICE_ID,
      status: 'issued',
      issueDate: '2026-10-03T15:00:00.000Z',
      dueDate: '2026-10-10',
      amount: 180,
      hostedInvoiceUrl: undefined,
      kind: 'nio',
      number: 'INV-00042',
      balance: 130,
      pastDue: true,
      recipient: {
        id: 'nio-1',
        name: 'Acme Health Services',
      },
      claims: [
        {
          claimId: 'claim-1',
          patientId: 'pat-1',
          patientName: 'Pruitt, Jordan',
          serviceDate: '2026-09-14',
          arStage: AR_STAGE.nonInsurancePayer,
          status: 'invoiced',
          amount: 180,
        },
      ],
      payments: [
        {
          paymentId: 'notice-active',
          paymentDate: '2026-10-15',
          amount: 50,
          method: 'check',
          reference: '88123',
        },
      ],
      pdfUrl: `https://z3.test/download/invoice-attachments/${INVOICE_ID}/abc-INV-00042.pdf`,
    });
  });

  it('is not past due before the due date', async () => {
    const { oystehr } = setup({
      invoices: [
        nioInvoice({
          dueDate: TODAY,
        }),
      ],
    });

    const result = await performEffect({
      oystehr,
      invoiceId: INVOICE_ID,
      secrets,
      today: TODAY,
    });

    expect(result.pastDue).toBe(false);
  });

  it('gives a void invoice its reason and no balance, since nothing is owed on it', async () => {
    const { oystehr } = setup({
      invoices: [
        {
          ...nioInvoice(),
          status: 'cancelled',
          cancelledReason: 'Billed the wrong payer',
        },
      ],
    });

    const result = await performEffect({
      oystehr,
      invoiceId: INVOICE_ID,
      secrets,
      today: TODAY,
    });

    expect(result).toMatchObject({
      status: 'cancelled',
      voidReason: 'Billed the wrong payer',
      pastDue: false,
    });
    expect(result.balance).toBeUndefined();
  });

  it('finds payments by the invoice payment tag', async () => {
    const { oystehr, search } = setup();

    await performEffect({
      oystehr,
      invoiceId: INVOICE_ID,
      secrets,
      today: TODAY,
    });

    expect(search).toHaveBeenCalledWith({
      resourceType: 'PaymentNotice',
      params: expect.arrayContaining([
        {
          name: '_tag',
          value: `https://fhir.ottehr.com/billing/invoice-payment-id|${INVOICE_ID}`,
        },
      ]),
    });
  });

  it("shows one payment once, summed over its claims' notices, with its attachment", async () => {
    const claimShare = (id: string, amount: number): PaymentNotice => ({
      ...payment('active'),
      id,
      amount: {
        value: amount,
        currency: 'USD',
      },
      identifier: [
        {
          system: NIO_INVOICE_PAYMENT_ID_SYSTEM,
          value: 'payment-1',
        },
      ],
    });
    const paymentAttachment = buildInvoicePaymentAttachment({
      invoiceId: INVOICE_ID,
      paymentId: 'payment-1',
      paymentNoticeReference: 'PaymentNotice/notice-1',
      path: `invoice-attachments/${INVOICE_ID}/abc-check.pdf`,
      fileName: 'check.pdf',
      secrets,
    });
    const { oystehr } = setup({
      notices: [claimShare('notice-1', 100.1), claimShare('notice-2', 79.9)],
      paymentAttachments: [paymentAttachment],
    });

    const result = await performEffect({
      oystehr,
      invoiceId: INVOICE_ID,
      secrets,
      today: TODAY,
    });

    expect(result.payments).toEqual([
      {
        paymentId: 'payment-1',
        paymentDate: '2026-10-15',
        amount: 180,
        method: 'check',
        reference: '88123',
        attachment: {
          fileName: 'check.pdf',
          url: `https://z3.test/download/invoice-attachments/${INVOICE_ID}/abc-check.pdf`,
        },
      },
    ]);
    expect(result.pdfUrl).toBe(`https://z3.test/download/invoice-attachments/${INVOICE_ID}/abc-INV-00042.pdf`);
  });

  it("picks the payment's own attachment when another invoice's payment shares its key", async () => {
    const { oystehr } = setup({
      paymentAttachments: [
        buildInvoicePaymentAttachment({
          invoiceId: 'other-invoice',
          paymentId: 'payment-1',
          paymentNoticeReference: 'PaymentNotice/other-notice',
          path: 'invoice-attachments/other-invoice/abc-wire.pdf',
          fileName: 'wire.pdf',
          secrets,
        }),
        buildInvoicePaymentAttachment({
          invoiceId: INVOICE_ID,
          paymentId: 'payment-1',
          paymentNoticeReference: 'PaymentNotice/notice-1',
          path: `invoice-attachments/${INVOICE_ID}/abc-check.pdf`,
          fileName: 'check.pdf',
          secrets,
        }),
      ],
      notices: [
        {
          ...payment('active'),
          id: 'notice-1',
          identifier: [
            {
              system: NIO_INVOICE_PAYMENT_ID_SYSTEM,
              value: 'payment-1',
            },
          ],
        },
      ],
    });

    const result = await performEffect({
      oystehr,
      invoiceId: INVOICE_ID,
      secrets,
      today: TODAY,
    });

    expect(result.payments[0].attachment).toEqual({
      fileName: 'check.pdf',
      url: `https://z3.test/download/invoice-attachments/${INVOICE_ID}/abc-check.pdf`,
    });
  });

  it("still shows the invoice and payment when a payment's attachment isn't related to its notices", async () => {
    const { oystehr } = setup({
      paymentAttachments: [
        buildInvoicePaymentAttachment({
          invoiceId: INVOICE_ID,
          paymentId: 'payment-1',
          paymentNoticeReference: 'PaymentNotice/other-notice',
          path: `invoice-attachments/${INVOICE_ID}/abc-check.pdf`,
          fileName: 'check.pdf',
          secrets,
        }),
      ],
      notices: [
        {
          ...payment('active'),
          id: 'notice-1',
          identifier: [
            {
              system: NIO_INVOICE_PAYMENT_ID_SYSTEM,
              value: 'payment-1',
            },
          ],
        },
      ],
    });

    const result = await performEffect({
      oystehr,
      invoiceId: INVOICE_ID,
      secrets,
      today: TODAY,
    });

    expect(result.payments).toHaveLength(1);
    expect(result.payments[0].attachment).toBeUndefined();
  });

  it('leaves the PDF link out when the invoice has no PDF', async () => {
    const { oystehr } = setup({
      pdfs: [],
    });

    const result = await performEffect({
      oystehr,
      invoiceId: INVOICE_ID,
      secrets,
      today: TODAY,
    });

    expect(result.pdfUrl).toBeUndefined();
  });

  it('refuses a patient invoice, whose Stripe payments it cannot see', async () => {
    const { oystehr } = setup({
      invoices: [
        {
          ...nioInvoice(),
          recipient: {
            reference: 'Patient/pat-1',
          },
        },
      ],
    });

    await expect(
      performEffect({
        oystehr,
        invoiceId: INVOICE_ID,
        secrets,
        today: TODAY,
      })
    ).rejects.toEqual(INVALID_INPUT_ERROR('Only non-insurance payer invoices have a details view'));
  });

  it('keeps the line of a claim that was not found, so the lines still add up to the amount', async () => {
    const { oystehr } = setup({
      claims: [],
    });

    const result = await performEffect({
      oystehr,
      invoiceId: INVOICE_ID,
      secrets,
      today: TODAY,
    });

    expect(result.claims).toEqual([
      {
        claimId: 'claim-1',
        patientId: '',
        patientName: '',
        serviceDate: '',
        arStage: '',
        status: '',
        amount: 180,
      },
    ]);
  });

  it("names the payer from the invoice when the payer's Organization isn't returned", async () => {
    const { oystehr } = setup({
      invoices: [
        {
          ...nioInvoice(),
          recipient: {
            reference: 'Organization/nio-1',
            display: 'Acme Health Services',
          },
        },
      ],
      organizations: [],
    });

    const result = await performEffect({
      oystehr,
      invoiceId: INVOICE_ID,
      secrets,
      today: TODAY,
    });

    expect(result.recipient).toEqual({
      id: 'nio-1',
      name: 'Acme Health Services',
    });
  });

  it('throws when the invoice does not exist', async () => {
    const { oystehr } = setup({
      invoices: [],
    });

    await expect(
      performEffect({
        oystehr,
        invoiceId: INVOICE_ID,
        secrets,
        today: TODAY,
      })
    ).rejects.toEqual(FHIR_RESOURCE_NOT_FOUND('Invoice'));
  });
});
