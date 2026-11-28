import Oystehr from '@oystehr/sdk';
import { ChargeItemDefinition, Claim, Invoice, Location, Organization, Patient, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { claimNonInsurancePayerExtension } from 'utils/lib/fhir/billing';
import { buildBillingInvoice } from 'utils/lib/fhir/billing-invoice';
import {
  CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM,
  CPT_CODE_SYSTEM,
  FRIENDLY_PATIENT_ID_SYSTEM_BASE,
} from 'utils/lib/fhir/constants';
import {
  CODE_SYSTEM_OYSTEHR_RCM_CMS1500_PROCEDURE_MODIFIER,
  CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM,
  EXTENSION_URL_CPT_MODIFIER,
} from 'utils/lib/helpers/rcm/constants';
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
  identifier: [{ system: FRIENDLY_PATIENT_ID_SYSTEM_BASE, value: `PT-${id}` }],
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
        productOrService: {
          coding: [{ code: '99213', display: 'Office visit, established' }],
        },
        net: { value: billed },
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
  nioPaidByClaimId: new Map(),
});

const setup = ({
  claims,
  extra = [],
  patientPaid,
  chargeMasters = [],
  patients = [patient('pat-1', 'Pruitt'), patient('pat-2', 'Collins')],
}: {
  claims: Claim[];
  extra?: Resource[];
  patientPaid?: Record<string, number>;
  chargeMasters?: ChargeItemDefinition[];
  patients?: Patient[];
}): Oystehr => {
  const resources: Resource[] = [
    ...claims,
    billingProvider,
    facilityCopy('facility-copy-1', 'facility-1'),
    ...patients,
    ...extra,
  ];
  mockBuildClaimLookups.mockResolvedValue(lookupsFor(resources, patientPaid));
  const search = vi.fn(async ({ resourceType }: { resourceType: string }) => ({
    unbundle: () => {
      if (resourceType === 'Organization') return [nio];
      if (resourceType === 'ChargeItemDefinition') return chargeMasters;
      return resources;
    },
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
    nameClaims: true,
    now: NOW,
  });

const nioChargeMaster = (
  entries: { code: string; display: string; amount: number; modifier?: string }[]
): ChargeItemDefinition => ({
  resourceType: 'ChargeItemDefinition',
  id: 'cm-nio',
  status: 'active',
  url: 'cm-nio',
  date: '2026-01-01',
  meta: { tag: [{ system: CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM, code: 'non-insurance' }] },
  propertyGroup: entries.map(({ code, display, amount, modifier }) => ({
    priceComponent: [
      {
        type: 'base',
        code: { coding: [{ system: CPT_CODE_SYSTEM, code, display }] },
        amount: { value: amount, currency: 'USD' },
        ...(modifier ? { extension: [{ url: EXTENSION_URL_CPT_MODIFIER, valueCode: modifier }] } : {}),
      },
    ],
  })),
});

type ClaimItem = NonNullable<Claim['item']>[number];

const lineWithModifier = (code: string, modifier: string | undefined, net: number, display?: string): ClaimItem => ({
  sequence: 1,
  productOrService: { coding: [{ code, display }] },
  ...(modifier
    ? { modifier: [{ coding: [{ system: CODE_SYSTEM_OYSTEHR_RCM_CMS1500_PROCEDURE_MODIFIER, code: modifier }] }] }
    : {}),
  net: { value: net },
  servicedDate: '2026-09-14',
});

describe('assembleNioInvoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadInvoicingConfig.mockResolvedValue(parseInvoiceConfigFromQR(undefined));
    mockFetchActiveClaimInvoices.mockResolvedValue([]);
  });

  it('takes service-line descriptions and prices from the non-insurance charge master', async () => {
    const claim = makeClaim({ id: 'claim-1' });
    const oystehr = setup({
      claims: [claim],
      chargeMasters: [nioChargeMaster([{ code: '99213', display: 'Established visit (CM)', amount: 150 }])],
    });

    const { pdf } = await assemble(oystehr, ['claim-1']);

    expect(pdf.lines[0].serviceLines).toEqual([
      { description: 'Established visit (CM)', unitPriceCents: 15000, quantity: 1, totalCents: 15000 },
    ]);
    // The claim's own total still drives the amounts billed.
    expect(pdf.lines[0].billedCents).toBe(15000);
  });

  it('multiplies the charge master price by quantity and divides the claim total for unpriced lines', async () => {
    const claim = {
      ...makeClaim({ id: 'claim-1' }),
      item: [
        { ...lineWithModifier('99213', undefined, 300), quantity: { value: 2 } },
        { ...lineWithModifier('87880', undefined, 90, 'Strep test'), quantity: { value: 3 } },
      ],
    } as Claim;
    const oystehr = setup({
      claims: [claim],
      chargeMasters: [nioChargeMaster([{ code: '99213', display: 'Established visit (CM)', amount: 150 }])],
    });

    const { pdf } = await assemble(oystehr, ['claim-1']);

    expect(pdf.lines[0].serviceLines).toEqual([
      { description: 'Established visit (CM)', unitPriceCents: 15000, quantity: 2, totalCents: 30000 },
      { description: 'Strep test', unitPriceCents: 3000, quantity: 3, totalCents: 9000 },
    ]);
    expect(pdf.lines[0].billedCents).toBe(39000);
  });

  it('prices modifier-specific entries, retries without modifiers, and falls back to the claim line', async () => {
    const claim = {
      ...makeClaim({ id: 'claim-1' }),
      item: [
        lineWithModifier('99213', '25', 180, 'Office visit, established'),
        lineWithModifier('99213', '59', 180, 'Office visit, established'),
        lineWithModifier('87880', undefined, 35, 'Strep test'),
      ],
    } as Claim;
    const oystehr = setup({
      claims: [claim],
      chargeMasters: [
        nioChargeMaster([
          { code: '99213', display: 'Established visit (CM)', amount: 150 },
          { code: '99213', display: 'Established visit with procedure (CM)', amount: 120, modifier: '25' },
        ]),
      ],
    });

    const { pdf } = await assemble(oystehr, ['claim-1']);

    expect(pdf.lines[0].serviceLines).toEqual([
      { description: 'Established visit with procedure (CM)', unitPriceCents: 12000, quantity: 1, totalCents: 12000 },
      { description: 'Established visit (CM)', unitPriceCents: 15000, quantity: 1, totalCents: 15000 },
      { description: 'Strep test', unitPriceCents: 3500, quantity: 1, totalCents: 3500 },
    ]);
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

    const { nioId, invoice, pdf } = await assemble(oystehr, ['claim-1', 'claim-2']);

    expect(nioId).toBe('nio-1');
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
          patientFriendlyId: 'PT-pat-1',
          serviceDate: '2026-09-14',
          facilityName: 'Main Clinic',
          serviceLines: [
            { description: 'Office visit, established', unitPriceCents: 18000, quantity: 1, totalCents: 18000 },
          ],
          billedCents: 18000,
          amountCents: 15000,
        },
        {
          claimId: 'claim-2',
          patientName: 'Collins, Jordan',
          patientFriendlyId: 'PT-pat-2',
          serviceDate: '2026-09-14',
          facilityName: 'Main Clinic',
          serviceLines: [
            { description: 'Office visit, established', unitPriceCents: 9550, quantity: 1, totalCents: 9550 },
          ],
          billedCents: 9550,
          amountCents: 9550,
        },
      ],
    });
    expect(mockFetchActiveClaimInvoices).toHaveBeenCalledWith(oystehr, ['claim-1', 'claim-2']);
  });

  it('falls back to the patient FHIR id when the patient has no friendly ID', async () => {
    const oystehr = setup({
      claims: [makeClaim({ id: 'claim-1' })],
      patients: [
        {
          resourceType: 'Patient',
          id: 'pat-1',
          name: [{ given: ['Jordan'], family: 'Pruitt' }],
        },
      ],
    });

    const { pdf } = await assemble(oystehr, ['claim-1']);

    expect(pdf.lines[0].patientFriendlyId).toBe('pat-1');
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
      message: 'Pruitt, Jordan (2026-09-14) must be in Non-Insurance Payer AR with a status of Ready to invoice',
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

  it('rejects claims from distinct service facilities that share a name and address', async () => {
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
      extra: [facilityCopy('facility-copy-2', 'facility-2')],
    });

    await expect(assemble(oystehr, ['claim-1', 'claim-2'])).rejects.toMatchObject({
      message: 'All claims must have the same service facility',
    });
  });

  it('groups claims at one service facility across its working copies', async () => {
    const oystehr = setup({
      claims: [
        makeClaim({
          id: 'claim-1',
        }),
        makeClaim({
          id: 'claim-2',
          facilityId: 'facility-copy-1b',
        }),
      ],
      extra: [facilityCopy('facility-copy-1b', 'facility-1')],
    });

    const { invoice } = await assemble(oystehr, ['claim-1', 'claim-2']);

    expect(invoice.facilityId).toBe('facility-1');
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
        makeClaim({
          id: 'claim-2',
          patientId: 'pat-2',
        }),
      ],
      patientPaid: {
        'claim-1': 180,
        'claim-2': 180,
      },
    });

    await expect(assemble(oystehr, ['claim-1', 'claim-2'])).rejects.toMatchObject({
      message: 'Pruitt, Jordan (2026-09-14); Collins, Jordan (2026-09-14) have no balance to invoice',
    });
  });

  it('counts claims without naming patients unless asked to', async () => {
    const oystehr = setup({
      claims: [
        makeClaim({
          id: 'claim-1',
        }),
        makeClaim({
          id: 'claim-2',
          patientId: 'pat-2',
        }),
      ],
      patientPaid: {
        'claim-1': 180,
        'claim-2': 180,
      },
    });

    await expect(
      assembleNioInvoice({
        oystehr,
        claimIds: ['claim-1', 'claim-2'],
        now: NOW,
      })
    ).rejects.toMatchObject({
      message: '2 claims have no balance to invoice',
    });
  });

  it('names a single claim with nothing left to pay in the singular', async () => {
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
      message: 'Pruitt, Jordan (2026-09-14) has no balance to invoice',
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
          claimId: 'claim-1',
          amountCents: 18000,
        },
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
          patientId: 'pat-2',
        }),
      ],
    });

    await expect(assemble(oystehr, ['claim-1', 'claim-2'])).rejects.toMatchObject({
      statusCode: 409,
      message: 'Pruitt, Jordan (2026-09-14); Collins, Jordan (2026-09-14) are already on an invoice',
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
      message: 'Pruitt, Jordan (2026-09-14) is already on an invoice',
    });
  });
});
