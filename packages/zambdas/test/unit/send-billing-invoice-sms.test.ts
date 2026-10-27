import type { APIGatewayProxyResult } from 'aws-lambda';
import { RelatedPerson } from 'fhir/r4b';
import { APIErrorCode } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

const { mockClinicalClient } = vi.hoisted(() => ({
  mockClinicalClient: { fhir: { search: vi.fn() }, transactionalSMS: { send: vi.fn() } },
}));

vi.mock('utils/lib/ottehr-config/feature-flags', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  FEATURE_FLAGS_CONFIG: { ottehrBillingInvoicingEnabled: true, invoicingInBillingApp: true },
}));
vi.mock('../../src/shared/auth', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
}));
vi.mock('../../src/shared/helpers', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createClinicalOystehrClient: () => mockClinicalClient,
}));
vi.mock('../../src/shared/sentry', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));

let recipients: RelatedPerson[];
let handler!: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const runHandler = (): Promise<APIGatewayProxyResult> =>
  handler({
    headers: null,
    body: JSON.stringify({ encounterId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', message: 'Pay your invoice' }),
    secrets: { BILLING_INTEGRATION: 'ottehr', ENVIRONMENT: 'local' },
  });

describe('send-billing-invoice-sms', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockClinicalClient.fhir.search.mockImplementation(async ({ resourceType }) => ({
      unbundle: () => (resourceType === 'Encounter' ? [{ resourceType: 'Patient', id: 'pat-1' }] : recipients),
    }));
    ({ index: handler } = (await import('../../src/ehr/send-billing-invoice-sms/index')) as unknown as {
      index: typeof handler;
    });
  });

  it("sends to the patient's portal users and accepts a partial failure", async () => {
    recipients = ['rp-1', 'rp-2'].map((id) => ({ resourceType: 'RelatedPerson', id, patient: {} }) as RelatedPerson);
    mockClinicalClient.transactionalSMS.send
      .mockResolvedValueOnce({ resourceId: 'comm-1' })
      .mockRejectedValueOnce({ code: 400, message: 'Recipient has no SMS number' });

    expect((await runHandler()).statusCode).toBe(200);
    expect(mockClinicalClient.transactionalSMS.send).toHaveBeenCalledWith({
      message: 'Pay your invoice',
      resource: 'RelatedPerson/rp-1',
    });
    expect(mockClinicalClient.transactionalSMS.send).toHaveBeenCalledTimes(2);
  });

  it('rejects a patient without portal users instead of reporting success', async () => {
    recipients = [];

    await expect(runHandler()).rejects.toMatchObject({ code: APIErrorCode.RESOURCE_INCOMPLETE_FOR_OPERATION });
    expect(mockClinicalClient.transactionalSMS.send).not.toHaveBeenCalled();
  });
});
