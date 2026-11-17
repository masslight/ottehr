import type { APIGatewayProxyResult } from 'aws-lambda';
import { Practitioner } from 'fhir/r4b';
import { GetEmployeesResponse } from 'utils/lib/types/api/get-employees/get-employees.types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

const PROVIDER_USER = { id: 'user-provider', name: 'provider@example.com', email: 'provider@example.com' };
const INACTIVE_USER = { id: 'user-inactive', name: 'gone@example.com', email: 'gone@example.com' };
const PRACTITIONER: Practitioner = {
  resourceType: 'Practitioner',
  id: 'prac-1',
  name: [{ given: ['Sam'], family: 'Provider' }],
};

const mockFhirBatch = vi.fn();
const mockRoleMembers = vi.fn();

const mockOystehrClient = {
  user: {
    list: vi.fn().mockResolvedValue([
      { ...PROVIDER_USER, profile: 'Practitioner/prac-1' },
      { ...INACTIVE_USER, profile: 'Practitioner/prac-2' },
      { id: 'user-patient', name: '+15555550100', profile: 'Patient/pat-1' },
    ]),
  },
  role: {
    list: vi.fn().mockResolvedValue([
      { id: 'role-inactive', name: RoleType.Inactive },
      { id: 'role-provider', name: RoleType.Provider },
    ]),
  },
  fhir: { batch: mockFhirBatch },
};

vi.mock('../../src/shared/getAuth0Token', () => ({ getAuth0Token: vi.fn().mockResolvedValue('mock-token') }));

vi.mock('../../src/shared/helpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, createClinicalOystehrClient: vi.fn(() => mockOystehrClient) };
});

vi.mock('../../src/shared/users.helper', () => ({ getRoleMembers: (...args: unknown[]) => mockRoleMembers(...args) }));

vi.mock('../../src/shared/sentry', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn };
});

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

let handler!: ZambdaHandler;

const run = async (body: string | null): Promise<GetEmployeesResponse> => {
  const result = await handler({ headers: {}, body, secrets: { ENVIRONMENT: 'testing' } });
  return JSON.parse(result.body);
};

const batchedUrls = (): string[] =>
  mockFhirBatch.mock.calls.flatMap(([input]) => (input as { requests: { url: string }[] }).requests.map((r) => r.url));

describe('get-employees', () => {
  beforeAll(async () => {
    handler = (await import('../../src/ehr/get-employees/index')).index as unknown as ZambdaHandler;
  });

  beforeEach(() => {
    mockFhirBatch.mockReset().mockResolvedValue({
      resourceType: 'Bundle',
      type: 'batch-response',
      entry: [
        {
          response: { status: '200', outcome: { id: 'ok' } },
          resource: { resourceType: 'Bundle', type: 'searchset', entry: [{ resource: PRACTITIONER }] },
        },
      ],
    });
    mockRoleMembers
      .mockReset()
      .mockImplementation(async (roleId: string) =>
        roleId === 'role-inactive' ? [{ id: INACTIVE_USER.id }] : [{ id: PROVIDER_USER.id }]
      );
  });

  it.each([
    ['no body', null],
    ['an empty body', '{}'],
    ['the retired lite flag', JSON.stringify({ lite: true })],
  ])('reads only the employees’ Practitioners from FHIR when called with %s', async (_label, body) => {
    await run(body);

    expect(batchedUrls()).toEqual([
      'Practitioner?_id=prac-1,prac-2&_elements=id,meta,qualification,name,extension,telecom',
    ]);
  });

  it('returns each employee with names from the Practitioner, roles and status', async () => {
    const { employees } = await run(null);

    expect(employees).toHaveLength(2);
    expect(employees[0]).toMatchObject({
      id: PROVIDER_USER.id,
      firstName: 'Sam',
      lastName: 'Provider',
      roles: [RoleType.Provider],
      status: 'Active',
    });
    expect(employees[0]).not.toHaveProperty('seenPatientRecently');
    expect(employees[1]).toMatchObject({ id: INACTIVE_USER.id, firstName: '', status: 'Deactivated' });
  });
});
