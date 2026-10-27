import type { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Patient, RelatedPerson } from 'fhir/r4b';
import { APIErrorCode } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

const ENC_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const { mockFlags, mockClinicalClient } = vi.hoisted(() => ({
  mockFlags: { ottehrBillingInvoicingEnabled: true, invoicingInBillingApp: true },
  mockClinicalClient: {
    fhir: {
      search: vi.fn(),
    },
    transactionalSMS: {
      send: vi.fn(),
    },
  },
}));

vi.mock('utils/lib/ottehr-config/feature-flags', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  FEATURE_FLAGS_CONFIG: mockFlags,
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

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

let handler!: ZambdaHandler;

const encounter = {
  resourceType: 'Encounter',
  id: ENC_1,
  status: 'finished',
  class: {
    code: 'AMB',
  },
  subject: {
    reference: 'Patient/pat-1',
  },
} as Encounter;

const patient: Patient = {
  resourceType: 'Patient',
  id: 'pat-1',
};

let recipients: RelatedPerson[];

const runHandler = (): Promise<APIGatewayProxyResult> =>
  handler({
    headers: null,
    body: JSON.stringify({ encounterId: ENC_1, message: 'Pay your invoice' }),
    secrets: {
      BILLING_INTEGRATION: 'ottehr',
      ENVIRONMENT: 'local',
    },
  });

describe('send-billing-invoice-sms', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockFlags.invoicingInBillingApp = true;
    recipients = [{ resourceType: 'RelatedPerson', id: 'rp-1', patient: { reference: 'Patient/pat-1' } }];
    mockClinicalClient.fhir.search.mockImplementation(({ resourceType }) =>
      Promise.resolve({ unbundle: () => (resourceType === 'Encounter' ? [encounter, patient] : recipients) })
    );
    mockClinicalClient.transactionalSMS.send.mockReset().mockResolvedValue({ resourceId: 'comm-1' });
    ({ index: handler } = (await import('../../src/ehr/send-billing-invoice-sms/index')) as unknown as {
      index: ZambdaHandler;
    });
  });

  it('rejects when invoicing does not run in the billing app', async () => {
    mockFlags.invoicingInBillingApp = false;

    await expect(runHandler()).rejects.toMatchObject({ message: 'Invoicing is not enabled in the billing app' });
    expect(mockClinicalClient.fhir.search).not.toHaveBeenCalled();
    expect(mockClinicalClient.transactionalSMS.send).not.toHaveBeenCalled();
  });

  it("submits the message to the patient's clinical recipient", async () => {
    const result = await runHandler();

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ message: 'Invoice SMS requests accepted' });
    expect(mockClinicalClient.transactionalSMS.send).toHaveBeenCalledExactlyOnceWith({
      message: 'Pay your invoice',
      resource: 'RelatedPerson/rp-1',
    });
  });

  it('rejects a visit without a patient before sending', async () => {
    mockClinicalClient.fhir.search.mockResolvedValue({ unbundle: () => [encounter] });

    await expect(runHandler()).rejects.toMatchObject({ code: APIErrorCode.FHIR_RESOURCE_NOT_FOUND });
    expect(mockClinicalClient.transactionalSMS.send).not.toHaveBeenCalled();
  });

  it('rejects a patient without SMS recipients instead of reporting success', async () => {
    recipients = [];

    await expect(runHandler()).rejects.toMatchObject({
      code: APIErrorCode.RESOURCE_INCOMPLETE_FOR_OPERATION,
      message: 'Patient has no SMS recipients',
    });
    expect(mockClinicalClient.transactionalSMS.send).not.toHaveBeenCalled();
  });

  it('propagates the SMS service error when sending fails', async () => {
    const smsError = { code: 503, message: 'SMS service unavailable' };
    mockClinicalClient.transactionalSMS.send.mockRejectedValue(smsError);

    await expect(runHandler()).rejects.toBe(smsError);
  });

  it('accepts partial success when one recipient request succeeds', async () => {
    recipients.push({ resourceType: 'RelatedPerson', id: 'rp-2', patient: { reference: 'Patient/pat-1' } });
    const smsError = { code: 400, message: 'Recipient has no SMS number' };
    mockClinicalClient.transactionalSMS.send
      .mockResolvedValueOnce({ resourceId: 'comm-1' })
      .mockRejectedValueOnce(smsError);

    await expect(runHandler()).resolves.toMatchObject({
      statusCode: 200,
      body: JSON.stringify({ message: 'Invoice SMS requests accepted' }),
    });
    expect(mockClinicalClient.transactionalSMS.send).toHaveBeenCalledTimes(2);
  });
});
