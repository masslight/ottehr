import { Claim, Coverage, Organization, Patient, Practitioner } from 'fhir/r4b';
import { PDFDocument } from 'pdf-lib';
import { ClaimAcknowledgmentEvent } from 'utils/lib/types/data/billing/claim-history';
import { describe, expect, it, vi } from 'vitest';
import {
  composeTimelyFilingReportData,
  ComposeTimelyFilingReportInput,
  renderTimelyFilingReportPdf,
  TimelyFilingReportData,
} from '../../../src/shared/pdf/timely-filing-report-pdf';

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

const NOW = '2026-08-06T14:23:00Z';

const claim: Claim = {
  resourceType: 'Claim',
  id: 'claim-1',
  status: 'active',
  use: 'claim',
  type: {
    coding: [
      {
        code: 'professional',
      },
    ],
  },
  patient: {
    reference: 'Patient/patient-1',
  },
  created: '2026-08-05T12:00:00Z',
  provider: {
    reference: 'Organization/provider-1',
  },
  priority: {
    coding: [
      {
        code: 'normal',
      },
    ],
  },
  insurance: [
    {
      sequence: 1,
      focal: true,
      coverage: {
        reference: 'Coverage/coverage-1',
      },
    },
  ],
  identifier: [
    {
      system: 'https://identifiers.fhir.oystehr.com/rcm-claim-patient-control-number',
      value: 'Q78291-A',
    },
  ],
  item: [
    {
      sequence: 1,
      productOrService: {},
      servicedDate: '2026-08-05',
    },
    {
      sequence: 2,
      productOrService: {},
      servicedDate: '2026-08-07',
    },
  ],
  total: {
    value: 627,
  },
};

const patient: Patient = {
  resourceType: 'Patient',
  id: 'patient-1',
  name: [
    {
      given: ['Jordan', 'A.'],
      family: 'Sample',
    },
  ],
};

const billingProvider: Organization = {
  resourceType: 'Organization',
  id: 'provider-1',
  name: 'SUNRISE PEDIATRICS GROUP',
  identifier: [
    {
      system: 'http://hl7.org/fhir/sid/us-npi',
      value: '1234567890',
    },
    {
      type: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            code: 'NE',
          },
        ],
      },
      value: '123456789',
    },
  ],
};

const renderingProvider: Practitioner = {
  resourceType: 'Practitioner',
  id: 'rendering-1',
  identifier: [
    {
      system: 'http://hl7.org/fhir/sid/us-npi',
      value: '1987654321',
    },
  ],
};

const coverage: Coverage = {
  resourceType: 'Coverage',
  id: 'coverage-1',
  status: 'active',
  beneficiary: {
    reference: 'Patient/patient-1',
  },
  payor: [
    {
      reference: 'Organization/payer-1',
    },
  ],
  subscriberId: 'U1234567801',
};

const payer: Organization = {
  resourceType: 'Organization',
  id: 'payer-1',
  name: 'CIGNA',
  identifier: [
    {
      system: 'https://identifiers.fhir.oystehr.com/rcm-payer-id',
      value: '62308',
    },
  ],
};

const acknowledgment = (overrides: Partial<ClaimAcknowledgmentEvent> = {}): ClaimAcknowledgmentEvent => ({
  source: 'claimmd',
  entityName: 'CIGNA',
  entityKind: 'payer',
  message: 'Code 19 - Entity acknowledges receipt of claim/encounter.',
  responseId: 'id:9001',
  eventTime: '2026-08-05T15:02:00Z',
  ...overrides,
});

const compose = (overrides: Partial<ComposeTimelyFilingReportInput> = {}): TimelyFilingReportData =>
  composeTimelyFilingReportData({
    claim,
    patient,
    billingProvider,
    renderingProvider,
    coverage,
    payer,
    acknowledgments: [],
    now: NOW,
    ...overrides,
  });

const fieldValue = (data: TimelyFilingReportData, label: string): string | undefined =>
  data.fields.find((field) => field.label === label)?.value;

describe('composeTimelyFilingReportData header', () => {
  it('fills the claim identity a payer needs to look the claim up', () => {
    const data = compose();
    expect(data.payerName).toBe('CIGNA');
    expect(data.reportGeneratedAt).toBe('08/06/2026 10:23 AM ET');
    expect(fieldValue(data, 'Billing Provider Tax ID')).toBe('12-3456789');
    expect(fieldValue(data, 'Billing Provider NPI')).toBe('1234567890');
    expect(fieldValue(data, 'Billing Provider Name')).toBe('SUNRISE PEDIATRICS GROUP');
    expect(fieldValue(data, 'Rendering Provider NPI')).toBe('1987654321');
    expect(fieldValue(data, 'Patient Name')).toBe('Jordan A. Sample');
    expect(fieldValue(data, 'Insured ID')).toBe('U1234567801');
    expect(fieldValue(data, 'Patient Control Number')).toBe('Q78291-A');
    expect(fieldValue(data, 'Clearinghouse Payer ID')).toBe('62308');
    expect(fieldValue(data, 'Claim Total Amount')).toBe('$627.00');
  });

  it('spans the service dates from the earliest line to the latest', () => {
    expect(fieldValue(compose(), 'Service Dates')).toBe('08/05/2026 - 08/07/2026');
  });

  it("prefers the payer's own control number over one from an ERA", () => {
    const data = compose({
      acknowledgments: [acknowledgment({ payerClaimControlNumber: '762839104822' })],
      eraPayerClaimControlNumber: '999999999',
    });
    expect(fieldValue(data, 'Payer Claim Control ID')).toBe('762839104822');
  });

  it('falls back to the ERA control number, then to N/A', () => {
    expect(fieldValue(compose({ eraPayerClaimControlNumber: '999999999' }), 'Payer Claim Control ID')).toBe(
      '999999999'
    );
    expect(fieldValue(compose(), 'Payer Claim Control ID')).toBe('N/A');
  });

  it('ignores a control number reported by the clearinghouse rather than the payer', () => {
    const data = compose({
      acknowledgments: [
        acknowledgment({
          entityKind: 'clearinghouse',
          entityName: 'CLAIM.MD',
          payerClaimControlNumber: 'nope',
        }),
      ],
    });
    expect(fieldValue(data, 'Payer Claim Control ID')).toBe('N/A');
  });

  it('takes the batch number from the transmit, else from an acknowledgment', () => {
    expect(
      fieldValue(
        compose({
          transmit: {
            transmittedAt: '2026-08-05T11:53:00Z',
            batchId: 'from-transmit',
          },
        }),
        'Clearinghouse Batch Number'
      )
    ).toBe('from-transmit');
    expect(
      fieldValue(compose({ acknowledgments: [acknowledgment({ batchId: 'from-ack' })] }), 'Clearinghouse Batch Number')
    ).toBe('from-ack');
  });

  it('marks every field it cannot source rather than leaving it blank', () => {
    const data = composeTimelyFilingReportData({
      claim: {
        ...claim,
        identifier: undefined,
        item: undefined,
        total: undefined,
      },
      acknowledgments: [],
      now: NOW,
    });
    expect(data.payerName).toBe('N/A');
    expect(data.fields.every((field) => field.value.length > 0)).toBe(true);
    expect(fieldValue(data, 'Service Dates')).toBe('N/A');
    expect(fieldValue(data, 'Claim Total Amount')).toBe('N/A');
    expect(fieldValue(data, 'Billing Provider Tax ID')).toBe('N/A');
  });
});

describe('composeTimelyFilingReportData history', () => {
  it('opens with the transmit, then lists acknowledgments in the order given', () => {
    const data = compose({
      transmit: {
        transmittedAt: '2026-08-05T11:53:00Z',
        batchId: '20260805123456789',
        clearinghouseClaimId: '48213765',
      },
      acknowledgments: [
        acknowledgment({
          entityName: 'CLAIM.MD',
          entityKind: 'clearinghouse',
          clearinghouseClaimId: 'CMD-2026-9938217',
          eventTime: '2026-08-05T13:14:00Z',
        }),
        acknowledgment({
          eventTime: '2026-08-05T15:02:00Z',
        }),
        acknowledgment({
          message: "Code 21 - Forwarded to entity's internal adjudication system.",
          payerClaimControlNumber: '762839104822',
          eventTime: '2026-08-06T12:47:00Z',
        }),
      ],
    });

    expect(data.history).toEqual([
      {
        dateTime: '08/05/26 07:53 AM',
        entity: 'claim.md',
        event: 'Transmit #48213765 to CIGNA — Batch ID: 20260805123456789',
      },
      {
        dateTime: '08/05/26 09:14 AM',
        entity: 'CLAIM.MD',
        event: 'Code 19 - Entity acknowledges receipt of claim/encounter. ID: CMD-2026-9938217',
      },
      {
        dateTime: '08/05/26 11:02 AM',
        entity: 'CIGNA',
        event: 'Code 19 - Entity acknowledges receipt of claim/encounter.',
      },
      {
        dateTime: '08/06/26 08:47 AM',
        entity: 'CIGNA',
        event: "Code 21 - Forwarded to entity's internal adjudication system. Claim ID: 762839104822",
      },
    ]);
  });

  it('renders timestamps in eastern time on both sides of the daylight saving change', () => {
    const winter = compose({
      acknowledgments: [
        acknowledgment({
          eventTime: '2026-01-15T14:14:00Z',
        }),
      ],
    });
    const summer = compose({
      acknowledgments: [
        acknowledgment({
          eventTime: '2026-08-05T13:14:00Z',
        }),
      ],
    });
    expect(winter.history[0].dateTime).toBe('01/15/26 09:14 AM');
    expect(summer.history[0].dateTime).toBe('08/05/26 09:14 AM');
  });

  it('omits the transmit row when the claim has no recorded transmission', () => {
    expect(compose({ acknowledgments: [acknowledgment()] }).history).toHaveLength(1);
    expect(compose().history).toEqual([]);
  });
});

describe('renderTimelyFilingReportPdf', () => {
  it('renders a claim with no acknowledgments rather than failing', async () => {
    const bytes = await renderTimelyFilingReportPdf(compose());
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(1);
  });

  it('paginates a long trail, keeping every row whole', async () => {
    const data = compose({
      acknowledgments: Array.from({ length: 45 }, (_, index) =>
        acknowledgment({
          responseId: `id:${index}`,
          message:
            "Code 21 - Forwarded to entity's internal adjudication system with a message long enough to wrap " +
            'onto a second line so the row height has to grow.',
        })
      ),
    });

    const document = await PDFDocument.load(await renderTimelyFilingReportPdf(data));
    expect(document.getPageCount()).toBeGreaterThan(1);
  });

  // Without the header, a continuation page is three unlabelled columns in a document a payer reads.
  it('repeats the column header on every page of a paginated trail', async () => {
    drawnText.length = 0;
    const data = compose({
      acknowledgments: Array.from({ length: 45 }, (_, index) =>
        acknowledgment({
          responseId: `id:${index}`,
          message:
            "Code 21 - Forwarded to entity's internal adjudication system with a message long enough to wrap " +
            'onto a second line so the row height has to grow.',
        })
      ),
    });

    const document = await PDFDocument.load(await renderTimelyFilingReportPdf(data));
    const headerDraws = drawnText.filter((text) => text.trim() === 'ENTITY').length;
    expect(document.getPageCount()).toBeGreaterThan(1);
    expect(headerDraws).toBe(document.getPageCount());
  });
});
