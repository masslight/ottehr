import { APIGatewayProxyResult } from 'aws-lambda';
import { ADMIN_TIER_ROLES, INVENTORY_STAFF_ROLES } from 'utils/lib/types/api/user.types';
import { APIErrorCode, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

// Every inventory endpoint resolves the caller's role before it touches FHIR: a signed-in user without a staff
// role (e.g. a patient-portal account) gets NOT_AUTHORIZED and no search, read or write happens.

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const { mockOystehr, mockRequireUserWithRole, mockGetMyPractitionerId } = vi.hoisted(() => ({
  mockOystehr: { fhir: { get: vi.fn(), search: vi.fn(), transaction: vi.fn(), patch: vi.fn() } },
  mockRequireUserWithRole: vi.fn(),
  mockGetMyPractitionerId: vi.fn(),
}));

vi.mock('../../src/shared/helpers', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createClinicalOystehrClient: vi.fn(() => mockOystehr),
}));

vi.mock('../../src/shared/auth', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('m2m-token'),
  requireUserWithRole: mockRequireUserWithRole,
}));

vi.mock('../../src/shared/practitioners', () => ({ getMyPractitionerId: mockGetMyPractitionerId }));

vi.mock('@sentry/node-core/light', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  init: vi.fn(),
  isInitialized: vi.fn(() => true),
  setTag: vi.fn(),
  setTags: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

import { index as adjustRaw } from '../../src/ehr/configuration/in-house-medications/adjust-medication-inventory/index';
import { index as getRaw } from '../../src/ehr/configuration/in-house-medications/get-medication-inventory/index';
import { index as listRaw } from '../../src/ehr/configuration/in-house-medications/list-medication-inventory/index';
import { index as lookupNdcRaw } from '../../src/ehr/configuration/in-house-medications/lookup-ndc/index';
import { index as receiveRaw } from '../../src/ehr/configuration/in-house-medications/receive-medication-shipment/index';
import { index as updateRaw } from '../../src/ehr/configuration/in-house-medications/update-in-house-medication/index';

const secrets = { ENVIRONMENT: 'development' };
const makeInput = (body: Record<string, unknown>): ZambdaInput => ({
  headers: { Authorization: 'Bearer caller-token' },
  body: JSON.stringify(body),
  secrets,
});

const MEDICATION_ID = '6f1c2a4e-1111-4b2a-9c3d-000000000001';
const LOCATION_ID = '6f1c2a4e-2222-4b2a-9c3d-000000000002';
const LOT_ID = '6f1c2a4e-3333-4b2a-9c3d-000000000003';

const receiveBody = {
  medicationId: MEDICATION_ID,
  locationId: LOCATION_ID,
  lotNumber: 'A123',
  expirationDate: '2027-03-31',
  quantity: 25,
  ndc: '72572-0160-25',
};

const inventory = { countedAs: 'vial', eachContains: { amount: 4, unit: 'mg' }, use: 'single-use' };

const staffEndpoints: [string, ZambdaHandler, Record<string, unknown>][] = [
  ['list-medication-inventory', listRaw as unknown as ZambdaHandler, { view: 'all-locations' }],
  [
    'adjust-medication-inventory',
    adjustRaw as unknown as ZambdaHandler,
    { action: 'count', lotId: LOT_ID, counted: 5 },
  ],
  ['receive-medication-shipment', receiveRaw as unknown as ZambdaHandler, receiveBody],
  ['get-medication-inventory', getRaw as unknown as ZambdaHandler, { medicationId: MEDICATION_ID }],
  ['lookup-ndc', lookupNdcRaw as unknown as ZambdaHandler, { ndc: '72572-0160-25', medicationId: MEDICATION_ID }],
];
const update = updateRaw as unknown as ZambdaHandler;

const expectNothingTouched = (): void => {
  expect(mockOystehr.fhir.get).not.toHaveBeenCalled();
  expect(mockOystehr.fhir.search).not.toHaveBeenCalled();
  expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
  expect(mockOystehr.fhir.patch).not.toHaveBeenCalled();
  expect(mockGetMyPractitionerId).not.toHaveBeenCalled();
};

describe('inventory endpoints - caller role', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUserWithRole.mockRejectedValue(NOT_AUTHORIZED);
  });

  it.each(staffEndpoints)(
    '%s rejects a caller without a staff role before any FHIR call',
    async (_name, handler, body) => {
      const result = await handler(makeInput(body));

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body).code).toBe(APIErrorCode.NOT_AUTHORIZED);
      expect(mockRequireUserWithRole).toHaveBeenCalledWith('caller-token', secrets, INVENTORY_STAFF_ROLES);
      expectNothingTouched();
    }
  );

  it('update-in-house-medication rejects a non-admin changing the inventory setup before any FHIR call', async () => {
    const result = await update(makeInput({ medicationID: 'med-123', name: 'Drug', inventory }));

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).code).toBe(APIErrorCode.NOT_AUTHORIZED);
    expect(mockRequireUserWithRole).toHaveBeenCalledWith('caller-token', secrets, ADMIN_TIER_ROLES);
    expectNothingTouched();
  });

  it('update-in-house-medication rejects a non-admin clearing the inventory setup', async () => {
    const result = await update(makeInput({ medicationID: 'med-123', name: 'Drug', inventory: null }));

    expect(JSON.parse(result.body).code).toBe(APIErrorCode.NOT_AUTHORIZED);
    expectNothingTouched();
  });

  it.each([
    ['deactivating', { medicationID: 'med-123', status: 'inactive' }],
    ['renaming or re-coding', { medicationID: 'med-123', name: 'X', ndc: '0000-0000-00' }],
  ])('update-in-house-medication rejects a non-admin %s a medication', async (_label, body) => {
    const result = await update(makeInput(body));

    expect(result.statusCode).toBe(401);
    expect(mockRequireUserWithRole).toHaveBeenCalledWith('caller-token', secrets, ADMIN_TIER_ROLES);
    expectNothingTouched();
  });

  it('update-in-house-medication lets an admin save the inventory setup', async () => {
    mockRequireUserWithRole.mockResolvedValue({});
    mockOystehr.fhir.get.mockResolvedValue({ resourceType: 'Medication', id: 'med-123', status: 'active' });

    const result = await update(makeInput({ medicationID: 'med-123', name: 'Drug', inventory }));

    expect(result.statusCode).toBe(200);
    expect(mockOystehr.fhir.patch).toHaveBeenCalledOnce();
  });
});
