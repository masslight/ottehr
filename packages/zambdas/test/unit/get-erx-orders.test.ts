import { APIGatewayProxyResult } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const { mockOystehr } = vi.hoisted(() => ({
  mockOystehr: { fhir: { search: vi.fn() } },
}));

vi.mock('../../src/shared/helpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, createClinicalOystehrClient: vi.fn(() => mockOystehr) };
});

vi.mock('../../src/shared/auth', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token') };
});

import { index as getErxOrdersRaw } from '../../src/ehr/get-erx-orders';

const call = (body: Record<string, unknown>): Promise<APIGatewayProxyResult> =>
  (getErxOrdersRaw as unknown as ZambdaHandler)({
    headers: { Authorization: 'Bearer user-token' },
    body: JSON.stringify(body),
    secrets: { ENVIRONMENT: 'local' },
  } as ZambdaInput);

const ENCOUNTER_ID = '3c2b1a09-8f7e-4d6c-9b5a-4e3d2c1b0a99';

// Review S8: the ids go into the search, so each is one encounter id, and there is at least one.
describe('get-erx-orders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOystehr.fhir.search.mockResolvedValue({ unbundle: () => [] });
  });

  it('searches the visits named by their ids', async () => {
    const response = await call({ encounterIds: [ENCOUNTER_ID] });
    expect(response.statusCode).toBe(200);
    expect(mockOystehr.fhir.search.mock.calls[0][0].params[0]).toEqual({
      name: 'encounter',
      value: `Encounter/${ENCOUNTER_ID}`,
    });
  });

  it.each([
    ['a search of its own', [`${ENCOUNTER_ID}&_count=1000`]],
    ['a list in one id', [`${ENCOUNTER_ID},Encounter/other`]],
    ['no ids', []],
  ])('refuses %s, searching nothing', async (_name, encounterIds) => {
    const response = await call({ encounterIds });
    expect(response.statusCode).toBe(400);
    expect(mockOystehr.fhir.search).not.toHaveBeenCalled();
  });
});
