import Oystehr from '@oystehr/sdk';
import { Claim, Invoice, Location, Organization, Patient, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { claimNonInsurancePayerExtension } from 'utils/lib/fhir/billing';
import { buildBillingInvoice } from 'utils/lib/fhir/billing-invoice';
import { CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM } from 'utils/lib/helpers/rcm/constants';
import { parseInvoiceConfigFromQR } from 'utils/lib/helpers/rcm/invoice-config';
import { AR_STAGE, ClaimStatusValues, claimStatusValuesToTags } from 'utils/lib/types/data/billing/claim-status';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClaimLookups } from '../../../src/billing/claim-search';
import { assembleNioInvoice } from '../../../src/billing/nio-invoice';
import { SOURCE_IDENTIFIER_SYSTEM } from '../../../src/billing/shared';

const { mockReadInvoicingConfig, mockBuildClaimLookups, mockFetchActiveClaimInvoices } = vi.hoisted(() => ({
  mockReadInvoicingConfig: vi.fn(),
  mockBuildClaimLookups: vi.fn(),
  mockFetchActiveClaimInvoices: vi.fn(),
}));

vi.mock('../../../src/rcm/invoice-config/helpers', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  readInvoicingConfig: (...args: unknown[]) => mockReadInvoicingConfig(...args),
}));
vi.mock('../../../src/billing/claim-search', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  buildClaimLookups: (...args: unknown[]) => mockBuildClaimLookups(...args),
}));
vi.mock('../../../src/billing/invoices', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchActiveClaimInvoices: (...args: unknown[]) => mockFetchActiveClaimInvoices(...args),
}));

const NOW = DateTime.fromISO('2026-10-03T15:00:00Z', { zone: 'utc' });

const nio: Organization = {
  resourceType: 'Organization',
  id: 'nio-1',
  name: 'Acme Health Services',
  address: [
    {
      line: ['4820 Commerce Parkway'],
      city: 'Austin',
      state: 'TX',
      postalCode: '78744',
    },
  ],
};

const billingProvider: Organization = {
  resourceType: 'Organization',
  id: 'provider-1',
  name: 'Medical Group',
  address: [
    {
      line: ['2 Provider Way'],
    },
  ],
};

const facilityCopy = (id: string, sourceId: string, line = '1 Clinic Way'): Location => ({
  resourceType: 'Location',
  id,
  name: 'Main Clinic',
  address: {
    line: [line],
  },
  extension: [
    {
      url: SOURCE_IDENTIFIER_SYSTEM,
      valueReference: {
        reference: `Location/${sourceId}`,
      },
    },
  ],
});

const patient = (id: string, family: string): Patient => ({
  resourceType: 'Patient',
  id,
  name: [
    {
      given: ['Jordan'],
      family,
    },
  ],
});

const READY: Partial<ClaimStatusValues> = {
  arStage: AR_STAGE.nonInsurancePayer,
  nonInsuranceArStatus: 'ready-to-invoice',
};

const makeClaim = ({
  id,
  billed = 180,
  statuses = READY,
  nioId = 'nio-1',
  facilityId = 'facility-copy-1',
  patientId = 'pat-1',
}: {
  id: string;
  billed?: number;
  statuses?: Partial<ClaimStatusValues>;
  nioId?: string;
  facilityId?: string;
  patientId?: string;
}): Claim =>
  ({
    resourceType: 'Claim',
    id,
    status: 'active',
    type: {
      coding: [
        {
          code: 'professional',
        },
      ],
    },
    patient: {
      reference: `Patient/${patientId}`,
    },
    facility: {
      reference: `Location/${facilityId}`,
    },
    provider: {
      reference: 'Organization/provider-1',
    },
    total: {
      value: billed,
    },
    item: [
      {
        sequence: 1,
        productOrService: {},
        servicedDate: '2026-09-14',
      },
    ],
    extension: [
      claimNonInsurancePayerExtension({
        reference: `Organization/${nioId}`,
      }),
    ],
    meta: {
      tag: [
        ...claimStatusValuesToTags(statuses),
        {
          system: CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM,
          code: 'office-visit',
        },
      ],
    },
  }) as Claim;

const lookupsFor = (resources: Resource[], patientPaid: Record<string, number> = {}): ClaimLookups => ({
  patients: resources.filter((r): r is Patient => r.resourceType === 'Patient'),
  payersByRef: new Map(),
  locations: resources.filter((r): r is Location => r.resourceType === 'Location'),
  providers: [billingProvider],
  coverages: [],
  claimResponsesByClaimId: new Map(),
  patientPaidByClaimId: new Map(Object.entries(patientPaid)),
  writeOffs: new Map(),
});

const setup = ({
  claims,
  extra = [],
  patientPaid,
}: {
  claims: Claim[];
  extra?: Resource[];
  patientPaid?: Record<string, number>;
}): Oystehr => {
  const resources: Resource[] = [
    ...claims,
    billingProvider,
    facilityCopy('facility-copy-1', 'facility-1'),
    patient('pat-1', 'Pruitt'),
    patient('pat-2', 'Collins'),
    ...extra,
  ];
  mockBuildClaimLookups.mockResolvedValue(lookupsFor(resources, patientPaid));
  const search = vi.fn(async ({ resourceType }: { resourceType: string }) => ({
    unbundle: () => (resourceType === 'Organization' ? [nio] : resources),
  }));
  return {
    fhir: {
      search,
    },
  } as unknown as Oystehr;
};

const assemble = (oystehr: Oystehr, claimIds: string[]): ReturnType<typeof assembleNioInvoice> =>
  assembleNioInvoice({
    oystehr,
    claimIds,
    now: NOW,
  });

describe('assembleNioInvoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadInvoicingConfig.mockResolvedValue(parseInvoiceConfigFromQR(undefined));
    mockFetchActiveClaimInvoices.mockResolvedValue([]);
  });

  it("bills the NIO each claim's balance, sent from the shared issuer", async () => {
    const oystehr = setup({
      claims: [
        makeClaim({
          id: 'claim-1',
        }),
        makeClaim({
          id: 'claim-2',
          billed: 95.5,
          patientId: 'pat-2',
        }),
      ],
      patientPaid: {
        'claim-1': 30,
      },
    });

    const { invoice, pdf } = await assemble(oystehr, ['claim-1', 'claim-2']);

    expect(invoice).toEqual({
      status: 'issued',
      date: '2026-10-03T15:00:00.000Z',
      dueDate: '2026-10-10',
      issuer: {
        reference: 'Organization/provider-1',
      },
      recipient: {
        reference: 'Organization/nio-1',
        display: 'Acme Health Services',
      },
      claims: [
        {
          claimId: 'claim-1',
          amountCents: 15000,
        },
        {
          claimId: 'claim-2',
          amountCents: 9550,
        },
      ],
      facilityId: 'facility-1',
    });
    expect(pdf).toEqual({
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
        address: nio.address![0],
      },
      lines: [
        {
          claimId: 'claim-1',
          patientName: 'Pruitt, Jordan',
          serviceDate: '2026-09-14',
          service: 'Office Visit',
          amountCents: 15000,
        },
        {
          claimId: 'claim-2',
          patientName: 'Collins, Jordan',
          serviceDate: '2026-09-14',
          service: 'Office Visit',
          amountCents: 9550,
        },
      ],
    });
    expect(mockFetchActiveClaimInvoices).toHaveBeenCalledWith(oystehr, ['claim-1', 'claim-2']);
  });

  it('rejects claims that do not exist', async () => {
    const oystehr = setup({
      claims: [
        makeClaim({
          id: 'claim-1',
        }),
      ],
    });

    await expect(assemble(oystehr, ['claim-1', 'claim-9'])).rejects.toMatchObject({
      message: 'Claims not found: claim-9',
    });
  });

  it('rejects claims that are not ready to invoice to a non-insurance payer', async () => {
    const oystehr = setup({
      claims: [
        makeClaim({
          id: 'claim-1',
        }),
        makeClaim({
          id: 'claim-2',
          statuses: {
            arStage: AR_STAGE.patient,
            patientArStatus: 'ready-to-invoice',
          },
        }),
      ],
    });

    await expect(assemble(oystehr, ['claim-1', 'claim-2'])).rejects.toMatchObject({
      message: 'Claims claim-2 must be in Non-Insurance Payer AR with a status of Ready to invoice',
    });
  });

  it('rejects claims billed to different non-insurance payers', async () => {
    const oystehr = setup({
      claims: [
        makeClaim({
          id: 'claim-1',
        }),
        makeClaim({
          id: 'claim-2',
          nioId: 'nio-2',
        }),
      ],
    });

    await expect(assemble(oystehr, ['claim-1', 'claim-2'])).rejects.toMatchObject({
      message: 'All claims must have the same non-insurance payer',
    });
  });

  it('rejects claims sent from different service facilities', async () => {
    const oystehr = setup({
      claims: [
        makeClaim({
          id: 'claim-1',
        }),
        makeClaim({
          id: 'claim-2',
          facilityId: 'facility-copy-2',
        }),
      ],
      extra: [facilityCopy('facility-copy-2', 'facility-2', '9 Other Road')],
    });

    await expect(assemble(oystehr, ['claim-1', 'claim-2'])).rejects.toMatchObject({
      message: 'All claims must have the same service facility',
    });
  });

  it('groups by billing provider when configured, leaving the facility filter unset', async () => {
    mockReadInvoicingConfig.mockResolvedValue({
      ...parseInvoiceConfigFromQR(undefined),
      invoiceIssuerSource: 'billing-provider',
    });
    const oystehr = setup({
      claims: [
        makeClaim({
          id: 'claim-1',
        }),
        makeClaim({
          id: 'claim-2',
          facilityId: 'facility-copy-2',
        }),
      ],
      extra: [facilityCopy('facility-copy-2', 'facility-2', '9 Other Road')],
    });

    const { invoice, pdf } = await assemble(oystehr, ['claim-1', 'claim-2']);

    expect(invoice.facilityId).toBeUndefined();
    expect(pdf.issuer.name).toBe('Medical Group');
  });

  it('rejects claims with nothing left to pay', async () => {
    const oystehr = setup({
      claims: [
        makeClaim({
          id: 'claim-1',
        }),
      ],
      patientPaid: {
        'claim-1': 180,
      },
    });

    await expect(assemble(oystehr, ['claim-1'])).rejects.toMatchObject({
      message: 'Claims claim-1 have no balance to invoice',
    });
  });

  it('rejects claims already on an active invoice with a conflict', async () => {
    const existing: Invoice = buildBillingInvoice({
      status: 'issued',
      date: '2026-10-01T00:00:00.000Z',
      dueDate: '2026-10-08',
      recipient: {
        reference: 'Organization/nio-1',
      },
      claims: [
        {
          claimId: 'claim-2',
          amountCents: 18000,
        },
      ],
    });
    mockFetchActiveClaimInvoices.mockResolvedValue([existing]);
    const oystehr = setup({
      claims: [
        makeClaim({
          id: 'claim-1',
        }),
        makeClaim({
          id: 'claim-2',
        }),
      ],
    });

    await expect(assemble(oystehr, ['claim-1', 'claim-2'])).rejects.toMatchObject({
      statusCode: 409,
      message: 'Claims claim-2 are already on an invoice',
    });
  });

  it('ignores the invoice a resumed create already saved for the claims', async () => {
    const resumed: Invoice = {
      ...buildBillingInvoice({
        status: 'issued',
        date: '2026-10-01T15:00:00.000Z',
        dueDate: '2026-10-08',
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
      id: 'invoice-1',
    };
    mockFetchActiveClaimInvoices.mockResolvedValue([resumed]);
    const oystehr = setup({
      claims: [
        makeClaim({
          id: 'claim-1',
        }),
      ],
    });

    const draft = await assembleNioInvoice({
      oystehr,
      claimIds: ['claim-1'],
      resumedInvoiceId: 'invoice-1',
      now: NOW,
    });

    expect(draft.invoice.claims).toEqual([
      {
        claimId: 'claim-1',
        amountCents: 18000,
      },
    ]);
  });

  it('reports a claim on a paid invoice as already invoiced, not as having no balance', async () => {
    const paid: Invoice = buildBillingInvoice({
      status: 'balanced',
      date: '2026-10-01T00:00:00.000Z',
      dueDate: '2026-10-08',
      recipient: {
        reference: 'Organization/nio-1',
      },
      claims: [
        {
          claimId: 'claim-1',
          amountCents: 18000,
        },
      ],
    });
    mockFetchActiveClaimInvoices.mockResolvedValue([paid]);
    const oystehr = setup({
      claims: [
        makeClaim({
          id: 'claim-1',
        }),
      ],
      patientPaid: {
        'claim-1': 180,
      },
    });

    await expect(assemble(oystehr, ['claim-1'])).rejects.toMatchObject({
      statusCode: 409,
      message: 'Claims claim-1 are already on an invoice',
    });
  });
});
