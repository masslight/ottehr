import { captureException } from '@sentry/aws-serverless';
import type { APIGatewayProxyResult } from 'aws-lambda';
import { UserActivationZambdaOutput } from 'utils/lib/types/api/user-activation.types';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

// Deactivating an Oystehr user doesn't touch their enrollment with the upstream eRx provider, so
// user-activation unenrolls the linked Practitioner as part of deactivation. These tests cover that
// side effect: when it runs, when it's skipped, and that it can never fail the deactivation itself.

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const PRACTITIONER_ID = 'practitioner-abc';
const INACTIVE_ROLE = { id: 'role-inactive', name: 'Inactive' };
const PROVIDER_ROLE = { id: 'role-provider', name: 'Provider' };

const mockCheckPractitionerEnrollment = vi.fn();
const mockUnenrollPractitioner = vi.fn();
const mockFhirPatch = vi.fn();
const mockUserGet = vi.fn();
const mockOystehrFetch = vi.fn();

const mockOystehrClient = {
  user: { get: mockUserGet },
  fhir: { patch: mockFhirPatch },
  erx: {
    checkPractitionerEnrollment: mockCheckPractitionerEnrollment,
    unenrollPractitioner: mockUnenrollPractitioner,
  },
};

vi.mock('../../src/shared/auth', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
  };
});

vi.mock('../../src/shared/helpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createClinicalOystehrClient: vi.fn(() => mockOystehrClient),
  };
});

vi.mock('../../src/shared/sentry', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
  };
});

vi.mock('utils/lib/helpers/helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('utils/lib/helpers/helpers')>();
  return {
    ...actual,
    createFetchClientWithOystehrAuth: vi.fn(() => ({ oystehrFetch: mockOystehrFetch })),
  };
});

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

let handler!: ZambdaHandler;

const makeInput = (mode: 'activate' | 'deactivate'): ZambdaInput => ({
  headers: { Authorization: 'Bearer test-token' },
  body: JSON.stringify({ userId: USER_ID, userActivationMode: mode }),
  secrets: {
    PROJECT_API: 'https://project.api',
    FHIR_API: 'https://fhir.api',
    ENVIRONMENT: 'testing',
  },
});

/** Both `oystehr.user.get` calls (before + after the change) resolve to the same shape. */
const givenUser = (overrides?: { roles?: (typeof PROVIDER_ROLE)[]; profile?: string | undefined }): void => {
  mockUserGet.mockResolvedValue({
    id: USER_ID,
    name: 'Test User',
    email: 'test@ottehr.com',
    profile: overrides?.profile === undefined ? `Practitioner/${PRACTITIONER_ID}` : overrides.profile,
    roles: overrides?.roles ?? [PROVIDER_ROLE],
  });
};

const parseBody = (result: APIGatewayProxyResult): UserActivationZambdaOutput => JSON.parse(result.body);

describe('user-activation eRx unenrollment', () => {
  beforeAll(async () => {
    ({ index: handler } = (await import('../../src/ehr/user-activation/index')) as { index: ZambdaHandler });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // The role lookup (`GET /iam/role`) is the only oystehrFetch call whose response is read.
    mockOystehrFetch.mockResolvedValue([PROVIDER_ROLE, INACTIVE_ROLE]);
    mockFhirPatch.mockResolvedValue({});
    mockCheckPractitionerEnrollment.mockResolvedValue({ registered: true, confirmed: true, active: true });
    mockUnenrollPractitioner.mockResolvedValue(undefined);
    givenUser();
  });

  it('unenrolls an enrolled practitioner when the user is deactivated', async () => {
    const result = await handler(makeInput('deactivate'));

    expect(result.statusCode).toBe(200);
    expect(parseBody(result)).toEqual({ message: 'User successfully deactivated.', erxUnenrollment: 'unenrolled' });
    expect(mockCheckPractitionerEnrollment).toHaveBeenCalledWith({ practitionerId: PRACTITIONER_ID });
    expect(mockUnenrollPractitioner).toHaveBeenCalledWith({ practitionerId: PRACTITIONER_ID });
  });

  it('unenrolls only after the Inactive role and Practitioner.active=false have landed', async () => {
    await handler(makeInput('deactivate'));

    const rolePatch = mockOystehrFetch.mock.calls.findIndex(([method]) => method === 'PATCH');
    expect(rolePatch).toBeGreaterThanOrEqual(0);
    expect(mockFhirPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'Practitioner',
        id: PRACTITIONER_ID,
        operations: [{ op: 'add', path: '/active', value: false }],
      })
    );
    // Revoking access is the effect that must not be blocked by a flaky eRx vendor call.
    expect(mockUnenrollPractitioner.mock.invocationCallOrder[0]).toBeGreaterThan(
      mockOystehrFetch.mock.invocationCallOrder[rolePatch]
    );
    expect(mockUnenrollPractitioner.mock.invocationCallOrder[0]).toBeGreaterThan(
      mockFhirPatch.mock.invocationCallOrder[0]
    );
  });

  it('skips the unenroll call when the practitioner was never registered with the eRx provider', async () => {
    mockCheckPractitionerEnrollment.mockResolvedValue({ registered: false, confirmed: false, active: false });

    const result = await handler(makeInput('deactivate'));

    expect(parseBody(result)).toEqual({ message: 'User successfully deactivated.', erxUnenrollment: 'not-enrolled' });
    expect(mockUnenrollPractitioner).not.toHaveBeenCalled();
  });

  it('treats an unconfigured eRx project as a no-op rather than a failure worth reporting', async () => {
    mockCheckPractitionerEnrollment.mockRejectedValue({ code: '4006', message: 'eRx service is not configured' });

    const result = await handler(makeInput('deactivate'));

    expect(result.statusCode).toBe(200);
    expect(parseBody(result)).toEqual({ message: 'User successfully deactivated.', erxUnenrollment: 'not-configured' });
    expect(mockUnenrollPractitioner).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('still reports a successful deactivation when the unenroll call fails, and sends it to Sentry', async () => {
    const error = new Error('eRx provider unavailable');
    mockUnenrollPractitioner.mockRejectedValue(error);

    const result = await handler(makeInput('deactivate'));

    expect(result.statusCode).toBe(200);
    expect(parseBody(result)).toEqual({ message: 'User successfully deactivated.', erxUnenrollment: 'failed' });
    // The role patch is what actually revoked access; it must have gone through.
    expect(mockOystehrFetch).toHaveBeenCalledWith(
      'PATCH',
      `https://project.api/user/${USER_ID}`,
      expect.objectContaining({ roles: expect.arrayContaining([INACTIVE_ROLE.id]) })
    );
    expect(captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        extra: expect.objectContaining({ practitionerId: PRACTITIONER_ID, operation: 'unenrollPractitioner' }),
      })
    );
  });

  // A 403 means the zambdas M2M client is missing an eRx:Enrollment grant, not that anything is
  // wrong with the user — and it surfaces on the precheck, which runs first. Sentry has to name
  // that call, otherwise the report sends you looking at the wrong one.
  it('attributes a Forbidden precheck to checkPractitionerEnrollment, not to the unenroll call', async () => {
    const forbidden = Object.assign(new Error('Forbidden'), { code: 403 });
    mockCheckPractitionerEnrollment.mockRejectedValue(forbidden);

    const result = await handler(makeInput('deactivate'));

    expect(result.statusCode).toBe(200);
    expect(parseBody(result)).toEqual({ message: 'User successfully deactivated.', erxUnenrollment: 'failed' });
    expect(mockUnenrollPractitioner).not.toHaveBeenCalled();
    expect(captureException).toHaveBeenCalledWith(
      forbidden,
      expect.objectContaining({
        extra: expect.objectContaining({ operation: 'checkPractitionerEnrollment', status: 403 }),
      })
    );
  });

  it('retries the unenrollment when deactivate is re-run on an already-deactivated user', async () => {
    givenUser({ roles: [PROVIDER_ROLE, INACTIVE_ROLE] });

    const result = await handler(makeInput('deactivate'));

    expect(parseBody(result)).toEqual({ message: 'User is already deactivated.', erxUnenrollment: 'unenrolled' });
    expect(mockUnenrollPractitioner).toHaveBeenCalledWith({ practitionerId: PRACTITIONER_ID });
    // No role changes on this path — only the Practitioner.active resync and the eRx retry.
    expect(mockOystehrFetch).not.toHaveBeenCalled();
  });

  it('makes no eRx calls for a user with no Practitioner profile', async () => {
    givenUser({ profile: 'Patient/patient-123' });

    const result = await handler(makeInput('deactivate'));

    expect(parseBody(result)).toEqual({
      message: 'User successfully deactivated.',
      erxUnenrollment: 'no-practitioner',
    });
    expect(mockCheckPractitionerEnrollment).not.toHaveBeenCalled();
    expect(mockUnenrollPractitioner).not.toHaveBeenCalled();
  });

  it('leaves eRx alone on activation — enrollment is re-created on demand by the eRx module', async () => {
    givenUser({ roles: [PROVIDER_ROLE, INACTIVE_ROLE] });

    const result = await handler(makeInput('activate'));

    expect(parseBody(result)).toEqual({ message: 'User successfully activated.' });
    expect(mockCheckPractitionerEnrollment).not.toHaveBeenCalled();
    expect(mockUnenrollPractitioner).not.toHaveBeenCalled();
    expect(mockFhirPatch).toHaveBeenCalledWith(
      expect.objectContaining({ operations: [{ op: 'add', path: '/active', value: true }] })
    );
  });
});
