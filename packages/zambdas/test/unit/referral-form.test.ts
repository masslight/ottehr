import { Organization, ServiceRequest } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockSecrets } from './validate-request-parameters/helpers';

const { mockOystehr, mockCreateReferralFormPDF, mockCaptureException } = vi.hoisted(() => ({
  mockOystehr: { fhir: { get: vi.fn(), search: vi.fn() } },
  mockCreateReferralFormPDF: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock('../../src/shared/pdf/referral-form-pdf', () => ({
  createReferralFormPDF: (...args: unknown[]) => mockCreateReferralFormPDF(...args),
}));

vi.mock('../../src/shared/referrals/recipient', () => ({
  loadReferralRecipient: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@sentry/node-core/light', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

import { getOrCreateReferralForm } from '../../src/shared/referrals/referral-form';

const PATIENT_ID = '11111111-1111-4111-8111-111111111111';
const REFERRAL_ID = '44444444-4444-4444-8444-444444444444';

const referral: ServiceRequest = {
  resourceType: 'ServiceRequest',
  id: REFERRAL_ID,
  meta: { versionId: '3' },
  status: 'draft',
  intent: 'order',
  subject: { reference: `Patient/${PATIENT_ID}` },
};

const practice: Organization = { resourceType: 'Organization', id: 'org-1', name: 'Practice' };

const notFound = Object.assign(new Error('Not found'), { code: 404 });

describe('getOrCreateReferralForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOystehr.fhir.search.mockResolvedValue({ unbundle: () => [] });
    mockCreateReferralFormPDF.mockResolvedValue({
      documentReference: {
        resourceType: 'DocumentReference',
        id: 'form-1',
        content: [{ attachment: { url: 'z3://referrals/form.pdf' } }],
      },
      presignedURL: 'https://signed/form.pdf',
    });
  });

  const run = (): ReturnType<typeof getOrCreateReferralForm> =>
    getOrCreateReferralForm(referral, {
      oystehr: mockOystehr as never,
      secrets: createMockSecrets(),
      token: 'token',
    });

  const gets = (organization: () => Promise<Organization | undefined>): void => {
    mockOystehr.fhir.get.mockImplementation(async ({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Patient') return { resourceType: 'Patient', id: PATIENT_ID };
      if (resourceType === 'Organization') return organization();
      throw new Error(`unexpected get for ${resourceType}`);
    });
  };

  it('passes the practice to the form when ORGANIZATION_ID resolves', async () => {
    gets(async () => practice);

    const form = await run();

    expect(form.z3Url).toBe('z3://referrals/form.pdf');
    expect(mockCreateReferralFormPDF.mock.calls[0][0]).toMatchObject({ practice });
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('still renders the form without the practice when ORGANIZATION_ID names no Organization, and reports it', async () => {
    gets(async () => {
      throw notFound;
    });

    const form = await run();

    expect(form.z3Url).toBe('z3://referrals/form.pdf');
    expect(mockCreateReferralFormPDF.mock.calls[0][0]).toMatchObject({ practice: undefined });
    expect(mockCaptureException).toHaveBeenCalledWith(notFound);
  });

  it('fails the form on any other practice lookup error, so an outage or lost access is not hidden', async () => {
    const forbidden = Object.assign(new Error('Forbidden'), { code: 403 });
    gets(async () => {
      throw forbidden;
    });

    await expect(run()).rejects.toBe(forbidden);
    expect(mockCreateReferralFormPDF).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});
