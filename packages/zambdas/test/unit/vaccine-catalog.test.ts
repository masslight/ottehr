import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Medication } from 'fhir/r4b';
import {
  getCatalogMedicationType,
  getMedicationCvx,
  getMedicationInventoryConfig,
  isCatalogMedication,
  isVaccineCatalogMedication,
  makeInventoryLot,
  makeMedicationInventoryExtension,
} from 'utils/lib/fhir/medication-inventory';
import { VACCINE_DEFAULT_INVENTORY } from 'utils/lib/types/api/config/in-house-medications';
import {
  CVX_CODE_SYSTEM_URL,
  INVENTORY_MEDICATION_TYPE_CODE,
  INVENTORY_VACCINE_TYPE_CODE,
  MEDICATION_DISPENSABLE_DRUG_ID,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { RoleType } from 'utils/lib/types/api/user.types';
import { APIErrorCode, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

const { mockOystehr, mockRequireUserWithRole } = vi.hoisted(() => ({
  mockOystehr: { fhir: { search: vi.fn(), create: vi.fn(), patch: vi.fn() } },
  mockRequireUserWithRole: vi.fn(),
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

vi.mock('@sentry/node-core/light', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  init: vi.fn(),
  isInitialized: vi.fn(() => true),
  setTag: vi.fn(),
  setTags: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

import {
  createVaccine,
  index as createRaw,
} from '../../src/ehr/configuration/in-house-medications/create-in-house-medication/index';
import { validateRequestParameters as createValidate } from '../../src/ehr/configuration/in-house-medications/create-in-house-medication/validateRequestParameters';
import { performEffect as getCatalog } from '../../src/ehr/configuration/in-house-medications/get-in-house-medications/index';

const secrets = { ENVIRONMENT: 'development' };
const input = (body: Record<string, unknown>): ZambdaInput => ({
  body: JSON.stringify(body),
  headers: { Authorization: 'Bearer caller-token' },
  secrets,
});

const bundle = <T>(resources: T[]): { unbundle: () => T[] } => ({ unbundle: () => resources });

const vaccineMedication = (
  id: string,
  cvx: string,
  name: string,
  status: Medication['status'] = 'active'
): Medication & { id: string } => ({
  resourceType: 'Medication',
  id,
  status,
  identifier: [
    { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_VACCINE_TYPE_CODE },
    { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: name },
  ],
  code: { coding: [{ system: CVX_CODE_SYSTEM_URL, code: cvx }] },
  extension: [makeMedicationInventoryExtension(VACCINE_DEFAULT_INVENTORY)],
});

const medication: Medication = {
  resourceType: 'Medication',
  id: 'ibuprofen',
  status: 'active',
  identifier: [
    { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_MEDICATION_TYPE_CODE },
    { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'Ibuprofen 200mg' },
  ],
  code: { coding: [{ system: MEDICATION_DISPENSABLE_DRUG_ID, code: 'DRUG123' }] },
};

// A vaccine that used to be set up from a config file: the vaccine type and a name, no CVX code and no status.
const retiredConfigVaccine: Medication = {
  resourceType: 'Medication',
  id: 'old',
  identifier: [
    { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_VACCINE_TYPE_CODE },
    { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'DTaP (Infanrix/Daptacel)' },
  ],
};

describe('what counts as a catalog entry', () => {
  const mmr = vaccineMedication('mmr', '03', 'MMR');

  it('tells a medication from a vaccine', () => {
    expect(getCatalogMedicationType(medication)).toBe('medication');
    expect(getCatalogMedicationType(mmr)).toBe('vaccine');
    expect(isVaccineCatalogMedication(mmr)).toBe(true);
    expect(isVaccineCatalogMedication(medication)).toBe(false);
    expect(getMedicationCvx(mmr)).toBe('03');
    expect(getMedicationCvx(medication)).toBeUndefined();
  });

  it('does not take a retired config vaccine for a catalog entry', () => {
    expect(getCatalogMedicationType(retiredConfigVaccine)).toBeUndefined();
    expect(isVaccineCatalogMedication(retiredConfigVaccine)).toBe(false);
  });

  it('does not take a vaccine lot for a catalog entry, though the lot carries the CVX code', () => {
    const lot = makeInventoryLot(mmr, {
      locationId: 'loc-a',
      lotNumber: 'Y0112',
      expirationDate: '2027-07-11',
      ndc: '00006-4681-00',
      unit: 'dose',
    });
    expect(getMedicationCvx(lot)).toBe('03');
    expect(getCatalogMedicationType(lot)).toBeUndefined();
  });

  it('leaves a vaccine out of the in-house medications the medication order side looks up', () => {
    expect(isCatalogMedication(mmr)).toBe(false);
    expect(isCatalogMedication(medication)).toBe(true);
  });
});

describe('adding a vaccine (create-in-house-medication with `vaccine`)', () => {
  it('accepts a CVX from the list and nothing else', () => {
    expect(createValidate(input({ vaccine: { cvx: '03' } }))).toEqual({ vaccine: { cvx: '03' }, secrets });
    expect(() => createValidate(input({ vaccine: { cvx: '999' } }))).toThrow('CVX code from the vaccine list');
    expect(() => createValidate(input({ vaccine: { cvx: 3 } }))).toThrow('CVX code from the vaccine list');
    expect(() => createValidate(input({ vaccine: {} }))).toThrow('CVX code from the vaccine list');
    expect(() => createValidate(input({ vaccine: null }))).toThrow('CVX code from the vaccine list');
  });

  it('creates one catalog entry per CVX, named as the CDC names it, set up for inventory in doses', async () => {
    const create = vi.fn().mockImplementation(async (resource: Medication) => ({ ...resource, id: 'new-id' }));
    const oystehr = {
      fhir: { search: vi.fn().mockResolvedValue(bundle([])), create, patch: vi.fn() },
    } as unknown as Oystehr;

    const created = await createVaccine(oystehr, '03');

    expect(created.id).toBe('new-id');
    expect(created.status).toBe('active');
    expect(created.identifier).toEqual([
      { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_VACCINE_TYPE_CODE },
      { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'MMR' },
    ]);
    expect(created.code?.coding).toEqual([
      { system: CVX_CODE_SYSTEM_URL, code: '03', display: 'measles, mumps and rubella virus vaccine' },
    ]);
    expect(getMedicationInventoryConfig(created)).toEqual(VACCINE_DEFAULT_INVENTORY);
    expect(getMedicationInventoryConfig(created)).toMatchObject({ countedAs: 'dose', use: 'single-use' });
    expect(getCatalogMedicationType(created)).toBe('vaccine');
    // An existing entry is looked for by the vaccine type and the CVX code.
    expect(oystehr.fhir.search).toHaveBeenCalledWith({
      resourceType: 'Medication',
      params: [
        { name: 'identifier', value: `${MEDICATION_TYPE_SYSTEM}|${INVENTORY_VACCINE_TYPE_CODE}` },
        { name: 'code', value: `${CVX_CODE_SYSTEM_URL}|03` },
      ],
    });
  });

  it('adding a vaccine again reactivates the entry instead of making a second one', async () => {
    const existing = vaccineMedication('mmr-id', '03', 'MMR', 'inactive');
    const patch = vi.fn().mockResolvedValue({ ...existing, status: 'active' });
    const oystehr = {
      fhir: { search: vi.fn().mockResolvedValue(bundle([existing])), create: vi.fn(), patch },
    } as unknown as Oystehr;

    const result = await createVaccine(oystehr, '03');

    expect(oystehr.fhir.create).not.toHaveBeenCalled();
    expect(patch).toHaveBeenCalledWith({
      resourceType: 'Medication',
      id: 'mmr-id',
      operations: [{ op: 'replace', path: '/status', value: 'active' }],
    });
    expect(result.status).toBe('active');
  });

  it('an active entry is returned as is', async () => {
    const existing = vaccineMedication('mmr-id', '03', 'MMR');
    const oystehr = {
      fhir: { search: vi.fn().mockResolvedValue(bundle([existing])), create: vi.fn(), patch: vi.fn() },
    } as unknown as Oystehr;
    expect(await createVaccine(oystehr, '03')).toBe(existing);
    expect(oystehr.fhir.patch).not.toHaveBeenCalled();
    expect(oystehr.fhir.create).not.toHaveBeenCalled();
  });

  it('rejects a CVX that is not offered, before any FHIR call', async () => {
    const oystehr = { fhir: { search: vi.fn(), create: vi.fn(), patch: vi.fn() } } as unknown as Oystehr;
    await expect(createVaccine(oystehr, '318')).rejects.toMatchObject({
      code: APIErrorCode.INVALID_INPUT,
      message: expect.stringContaining('318'),
    });
    expect(oystehr.fhir.search).not.toHaveBeenCalled();
  });
});

describe('create-in-house-medication - caller role', () => {
  const create = createRaw as unknown as (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOystehr.fhir.search.mockResolvedValue(bundle([]));
    mockOystehr.fhir.create.mockImplementation(async (resource: Medication) => ({ ...resource, id: 'new-id' }));
  });

  it('refuses to add a vaccine for a caller who is not an Administrator or Customer Support, before any FHIR call', async () => {
    mockRequireUserWithRole.mockRejectedValue(NOT_AUTHORIZED);

    const result = await create(input({ vaccine: { cvx: '03' } }));

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).code).toBe(APIErrorCode.NOT_AUTHORIZED);
    expect(mockRequireUserWithRole).toHaveBeenCalledWith('caller-token', secrets, [
      RoleType.Administrator,
      RoleType.CustomerSupport,
    ]);
    expect(mockOystehr.fhir.search).not.toHaveBeenCalled();
    expect(mockOystehr.fhir.create).not.toHaveBeenCalled();
  });

  it('adds the vaccine for a caller with the role', async () => {
    mockRequireUserWithRole.mockResolvedValue({});

    const result = await create(input({ vaccine: { cvx: '03' } }));

    expect(result.statusCode).toBe(200);
    expect(getCatalogMedicationType(JSON.parse(result.body))).toBe('vaccine');
    expect(mockOystehr.fhir.create).toHaveBeenCalledOnce();
  });

  it('adds a medication as before, without a role check', async () => {
    mockRequireUserWithRole.mockRejectedValue(NOT_AUTHORIZED);

    const result = await create(input({ name: 'Ibuprofen 200mg', medispanID: 'DRUG123' }));

    expect(result.statusCode).toBe(200);
    expect(mockRequireUserWithRole).not.toHaveBeenCalled();
    expect(mockOystehr.fhir.search).not.toHaveBeenCalled();
    expect(getCatalogMedicationType(JSON.parse(result.body))).toBe('medication');
  });
});

describe('get-in-house-medications: the catalog list', () => {
  it('lists medications and catalog vaccines in one search, and leaves the retired config vaccines out', async () => {
    const mmr = vaccineMedication('mmr', '03', 'MMR');
    const inactiveTdap = vaccineMedication('tdap', '115', 'Tdap', 'inactive');
    const oystehr = {
      fhir: { search: vi.fn().mockResolvedValue(bundle([medication, retiredConfigVaccine, mmr, inactiveTdap])) },
    } as unknown as Oystehr;

    expect(await getCatalog(oystehr)).toEqual([medication, mmr, inactiveTdap]);
    expect(oystehr.fhir.search).toHaveBeenCalledWith({
      resourceType: 'Medication',
      params: [{ name: 'identifier', value: `${INVENTORY_MEDICATION_TYPE_CODE},${INVENTORY_VACCINE_TYPE_CODE}` }],
    });
  });
});
