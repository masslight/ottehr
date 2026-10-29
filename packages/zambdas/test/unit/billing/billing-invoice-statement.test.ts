import Oystehr from '@oystehr/sdk';
import { Claim, Invoice } from 'fhir/r4b';
import { buildBillingInvoice } from 'utils/lib/fhir/billing-invoice';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { describe, expect, it, vi } from 'vitest';
import { performEffect as createStatement } from '../../../src/billing/create-billing-invoice-statement';
import { performEffect as getStatement } from '../../../src/billing/get-billing-invoice-statement';

const { mockGetStatementDetails, mockResolveStatementAmountsSource, mockGetPresignedURL } = vi.hoisted(() => ({
  mockGetStatementDetails: vi.fn(async () => ({ patient: { firstName: 'Sam' }, service: [] })),
  mockResolveStatementAmountsSource: vi.fn(),
  mockGetPresignedURL: vi.fn(async () => 'https://signed.test/statement.pdf'),
}));

vi.mock('utils/lib/helpers/presigned-file-url/helpers', () => ({ getPresignedURL: mockGetPresignedURL }));
vi.mock('../../../src/shared/statements/get-statement-details', () => ({
  getStatementDetails: mockGetStatementDetails,
  resolveStatementAmountsSource: mockResolveStatementAmountsSource,
}));
vi.mock('../../../src/shared/statements/get-statement-template', () => ({
  getHTMLStatementTemplate: () => ({ template: '<p>{{patient.firstName}}</p>' }),
}));

const invoice: Invoice = {
  ...buildBillingInvoice({
    status: 'issued',
    date: '2026-10-29T15:00:00.000Z',
    dueDate: '2026-11-05',
    recipient: { reference: 'Patient/pat-1' },
    claims: [{ claimId: 'claim-1', amountCents: 350 }],
  }),
  id: 'inv-1',
};
const claim = {
  resourceType: 'Claim',
  id: 'claim-1',
  identifier: [{ system: ottehrIdentifierSystem('claim-encounter-id'), value: 'enc-1' }],
} as Claim;

const makeBillingClient = (): { oystehr: Oystehr; execute: ReturnType<typeof vi.fn> } => {
  const search = vi.fn(async ({ resourceType }: { resourceType: string }) => ({
    unbundle: () => [resourceType === 'Invoice' ? invoice : claim],
  }));
  const execute = vi.fn(async () => ({ output: {} }));
  return { oystehr: { fhir: { search }, zambda: { execute } } as unknown as Oystehr, execute };
};

describe('billing invoice statement', () => {
  it("previews the standard statement for the invoice's visit and links its current PDF", async () => {
    const pdf = {
      date: '2026-10-29T16:00:00.000Z',
      content: [{ attachment: { url: 'https://project-api.test/v1/z3/proj-statements/pat-1/statement.pdf' } }],
    };
    const clinicalOystehr = { fhir: { search: vi.fn(async () => ({ unbundle: () => [pdf] })) } } as unknown as Oystehr;

    const response = await getStatement(makeBillingClient().oystehr, clinicalOystehr, 'token', {
      invoiceId: 'inv-1',
      secrets: { PROJECT_API: 'https://project-api.test/v1', PROJECT_ID: 'proj' },
    });

    expect(response).toEqual({
      html: '<p>Sam</p>',
      generatedAt: '2026-10-29T16:00:00.000Z',
      pdfUrl: 'https://signed.test/statement.pdf',
    });
    expect(mockResolveStatementAmountsSource).toHaveBeenCalledWith(
      expect.objectContaining({ billingAppInvoice: true })
    );
    expect(mockGetStatementDetails).toHaveBeenCalledWith(
      expect.objectContaining({ encounterId: 'enc-1', statementType: 'standard' })
    );
    expect(mockGetPresignedURL).toHaveBeenCalledWith(pdf.content[0].attachment.url, 'token');
  });

  it('asks the EHR to generate the PDF for the visit', async () => {
    const { oystehr, execute } = makeBillingClient();

    await createStatement(oystehr, 'inv-1');

    expect(execute).toHaveBeenCalledWith({
      id: 'create-generate-statement-task',
      encounterId: 'enc-1',
      billingAppInvoice: true,
    });
  });
});
