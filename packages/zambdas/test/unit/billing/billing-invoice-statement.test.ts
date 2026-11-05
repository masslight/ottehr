import Oystehr from '@oystehr/sdk';
import { Claim, Invoice } from 'fhir/r4b';
import { buildBillingInvoice } from 'utils/lib/fhir/billing-invoice';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { describe, expect, it, vi } from 'vitest';
import { performEffect as createStatement } from '../../../src/billing/create-billing-invoice-statement';
import { performEffect as getStatement } from '../../../src/billing/get-billing-invoice-statement';

const { mockGetPresignedURL } = vi.hoisted(() => ({
  mockGetPresignedURL: vi.fn(async () => 'https://signed.test/statement.pdf'),
}));

vi.mock('utils/lib/helpers/presigned-file-url/helpers', () => ({ getPresignedURL: mockGetPresignedURL }));
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

// Zambda outputs by zambda id, as the clinical endpoints would answer.
const makeBillingClient = (
  outputs: Record<string, unknown> = {}
): { oystehr: Oystehr; execute: ReturnType<typeof vi.fn> } => {
  const search = vi.fn(async ({ resourceType }: { resourceType: string }) => ({
    unbundle: () => [resourceType === 'Invoice' ? invoice : claim],
  }));
  const execute = vi.fn(async ({ id }: { id: string }) => ({ output: outputs[id] ?? {} }));
  return { oystehr: { fhir: { search }, zambda: { execute } } as unknown as Oystehr, execute };
};

describe('billing invoice statement', () => {
  it("previews the standard statement for the invoice's visit and links its current PDF", async () => {
    const url = 'https://project-api.test/v1/z3/proj-statements/pat-1/statement.pdf';
    const { oystehr, execute } = makeBillingClient({
      'get-statement-details': { patient: { firstName: 'Sam' }, service: [] },
      'get-statement-status': { generated: { generated: true, lastGenerated: '2026-10-29T16:00:00.000Z', url } },
    });

    const response = await getStatement(oystehr, 'token', {
      invoiceId: 'inv-1',
      secrets: { PROJECT_API: 'https://project-api.test/v1', PROJECT_ID: 'proj' },
    });

    expect(response).toEqual({
      html: '<p>Sam</p>',
      generatedAt: '2026-10-29T16:00:00.000Z',
      pdfUrl: 'https://signed.test/statement.pdf',
    });
    expect(execute).toHaveBeenCalledWith({
      id: 'get-statement-details',
      encounterId: 'enc-1',
      statementType: 'standard',
      billingAppInvoice: true,
    });
    expect(execute).toHaveBeenCalledWith({ id: 'get-statement-status', encounterId: 'enc-1' });
    expect(mockGetPresignedURL).toHaveBeenCalledWith(url, 'token');
  });

  it('offers no download before the EHR has generated a PDF', async () => {
    const { oystehr } = makeBillingClient({
      'get-statement-details': { patient: { firstName: 'Sam' }, service: [] },
      'get-statement-status': { generated: { generated: false } },
    });

    const response = await getStatement(oystehr, 'token', {
      invoiceId: 'inv-1',
      secrets: { PROJECT_API: 'https://project-api.test/v1', PROJECT_ID: 'proj' },
    });

    expect(response).toEqual({ html: '<p>Sam</p>', generatedAt: undefined, pdfUrl: undefined });
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
