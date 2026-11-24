import { APIGatewayProxyResult } from 'aws-lambda';
import { NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const { mockOystehr, requireAdminTierUser } = vi.hoisted(() => ({
  mockOystehr: { fhir: { get: vi.fn(), search: vi.fn(), create: vi.fn(), update: vi.fn() } },
  requireAdminTierUser: vi.fn(),
}));

vi.mock('../../src/shared/helpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, createClinicalOystehrClient: vi.fn(() => mockOystehr) };
});

vi.mock('../../src/shared/auth', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'), requireAdminTierUser };
});

import { index as createRaw } from '../../src/ehr/admin-create-quick-pick';
import { index as removeRaw } from '../../src/ehr/admin-remove-quick-pick';
import { index as updateRaw } from '../../src/ehr/admin-update-quick-pick';

const call = (handler: unknown, body: Record<string, unknown>): Promise<APIGatewayProxyResult> =>
  (handler as ZambdaHandler)({
    headers: { Authorization: 'Bearer user-token' },
    body: JSON.stringify(body),
    secrets: { ENVIRONMENT: 'local' },
  } as ZambdaInput);

const SET = { name: 'Ear infection', status: 'Active', memberIds: ['qp-amox'] };
const CATEGORY = 'prescription-set-quick-pick';

// Review S1: every staff role can call any zambda, so the quick pick writes check the caller's role themselves.
describe.each([
  ['admin-create-quick-pick', createRaw, { category: CATEGORY, quickPick: SET }],
  ['admin-update-quick-pick', updateRaw, { category: CATEGORY, quickPickId: 'set-1', quickPick: SET }],
  ['admin-remove-quick-pick', removeRaw, { quickPickId: 'set-1' }],
])('%s', (_name, handler, body) => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refuses a caller without an admin role, and writes nothing', async () => {
    requireAdminTierUser.mockRejectedValue(NOT_AUTHORIZED);
    const response = await call(handler, body);
    expect(response.statusCode).toBe(401);
    expect(requireAdminTierUser).toHaveBeenCalledWith('user-token', expect.anything());
    expect(mockOystehr.fhir.get).not.toHaveBeenCalled();
    expect(mockOystehr.fhir.create).not.toHaveBeenCalled();
    expect(mockOystehr.fhir.update).not.toHaveBeenCalled();
  });
});

// Review S2: an update only writes over a quick pick of the category it names.
describe('admin-update-quick-pick: what it writes over', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminTierUser.mockResolvedValue(undefined);
    mockOystehr.fhir.update.mockImplementation(async (resource: unknown) => resource);
  });

  it('looks the quick pick up by its id and its category tag', async () => {
    // The set by its id, then the prescription quick picks its members must be.
    mockOystehr.fhir.search.mockImplementation(async ({ params }: { params: { name: string }[] }) => ({
      unbundle: () => [
        { resourceType: 'ActivityDefinition', id: params.some(({ name }) => name === '_id') ? 'set-1' : 'qp-amox' },
      ],
    }));
    const response = await call(updateRaw, { category: CATEGORY, quickPickId: 'set-1', quickPick: SET });
    expect(mockOystehr.fhir.search).toHaveBeenCalledWith({
      resourceType: 'ActivityDefinition',
      params: [
        { name: '_id', value: 'set-1' },
        { name: '_tag', value: `https://fhir.ottehr.com/CodeSystem/quick-pick-category|${CATEGORY}` },
      ],
    });
    expect(response.statusCode).toBe(200);
    expect(mockOystehr.fhir.update).toHaveBeenCalledTimes(1);
  });

  it('writes nothing over another resource, or a quick pick of another category, and says only "not found"', async () => {
    mockOystehr.fhir.search.mockResolvedValue({ unbundle: () => [] });
    const response = await call(updateRaw, { category: CATEGORY, quickPickId: 'some-other-ad', quickPick: SET });
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toBe('The requested ActivityDefinition resource could not be found');
    expect(mockOystehr.fhir.update).not.toHaveBeenCalled();
  });
});
