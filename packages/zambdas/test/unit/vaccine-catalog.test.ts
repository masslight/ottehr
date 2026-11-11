import Oystehr from '@oystehr/sdk';
import { Medication } from 'fhir/r4b';
import { getMedicationInventoryConfig } from 'utils/lib/fhir/medication-inventory';
import {
  CVX_CODE_SYSTEM_URL,
  INVENTORY_VACCINE_TYPE_CODE,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { describe, expect, it, vi } from 'vitest';
import { createVaccine } from '../../src/ehr/configuration/in-house-medications/create-in-house-medication/index';
import { validateRequestParameters as createValidate } from '../../src/ehr/configuration/in-house-medications/create-in-house-medication/validateRequestParameters';
import { lookupVaccineNdc } from '../../src/ehr/configuration/in-house-medications/lookup-ndc/index';
import { getVaccines } from '../../src/ehr/immunization/get-vaccines/index';
import { ZambdaInput } from '../../src/shared/types/common';

const input = (body: Record<string, unknown>): ZambdaInput => ({
  body: JSON.stringify(body),
  headers: { Authorization: 'Bearer test-token' },
  secrets: null,
});

const bundle = <T>(resources: T[]): { unbundle: () => T[] } => ({ unbundle: () => resources });

const vaccineMedication = (
  id: string,
  cvx: string,
  name: string,
  status: Medication['status'] = 'active'
): Medication => ({
  resourceType: 'Medication',
  id,
  status,
  identifier: [
    { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_VACCINE_TYPE_CODE },
    { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: name },
  ],
  code: { coding: [{ system: CVX_CODE_SYSTEM_URL, code: cvx }] },
});

describe('switching a vaccine on (create-in-house-medication with `vaccine`)', () => {
  it('accepts a CVX from the list and nothing else', () => {
    expect(createValidate(input({ vaccine: { cvx: '03' } })).vaccine).toEqual({ cvx: '03' });
    expect(() => createValidate(input({ vaccine: { cvx: '999' } }))).toThrow('CVX code from the vaccine list');
    expect(() => createValidate(input({ vaccine: {} }))).toThrow('CVX code from the vaccine list');
  });

  it('creates one catalog entry per CVX, named as the CDC names it, set up for inventory in doses', async () => {
    const create = vi.fn().mockImplementation(async (resource: Medication) => ({ ...resource, id: 'new-id' }));
    const oystehr = {
      fhir: { search: vi.fn().mockResolvedValue(bundle([])), create, patch: vi.fn() },
    } as unknown as Oystehr;

    const created = await createVaccine(oystehr, '03');

    expect(created.id).toBe('new-id');
    expect(created.identifier).toEqual([
      { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_VACCINE_TYPE_CODE },
      { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'MMR' },
    ]);
    expect(created.code?.coding?.[0]).toMatchObject({ system: CVX_CODE_SYSTEM_URL, code: '03' });
    expect(getMedicationInventoryConfig(created)).toMatchObject({ countedAs: 'dose', use: 'single-use' });
    // the search for an existing entry is by type and CVX, fixed here
    expect(oystehr.fhir.search).toHaveBeenCalledWith({
      resourceType: 'Medication',
      params: [
        { name: 'identifier', value: `${MEDICATION_TYPE_SYSTEM}|${INVENTORY_VACCINE_TYPE_CODE}` },
        { name: 'code', value: `${CVX_CODE_SYSTEM_URL}|03` },
      ],
    });
  });

  it('switching a vaccine on again reactivates the entry instead of making a second one', async () => {
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
  });

  it('rejects a CVX that is not offered', async () => {
    const oystehr = { fhir: { search: vi.fn(), create: vi.fn(), patch: vi.fn() } } as unknown as Oystehr;
    await expect(createVaccine(oystehr, '318')).rejects.toMatchObject({ message: expect.stringContaining('318') });
  });
});

describe('get-vaccines: the switched-on vaccines', () => {
  it('lists active catalog vaccines with a CVX, sorted by name, and leaves out the old config names', async () => {
    const oldConfigVaccine: Medication = {
      resourceType: 'Medication',
      id: 'old',
      identifier: [
        { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_VACCINE_TYPE_CODE },
        { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'DTaP (Infanrix/Daptacel)' },
      ],
    };
    const oystehr = {
      fhir: {
        search: vi
          .fn()
          .mockResolvedValue(
            bundle([vaccineMedication('tdap', '115', 'Tdap'), oldConfigVaccine, vaccineMedication('mmr', '03', 'MMR')])
          ),
      },
    } as unknown as Oystehr;

    expect(await getVaccines(oystehr)).toEqual({
      vaccines: [
        { id: 'mmr', name: 'MMR', cvx: '03' },
        { id: 'tdap', name: 'Tdap', cvx: '115' },
      ],
    });
    expect(oystehr.fhir.search).toHaveBeenCalledWith({
      resourceType: 'Medication',
      params: [
        { name: 'identifier', value: INVENTORY_VACCINE_TYPE_CODE },
        { name: 'status', value: 'active' },
      ],
    });
  });
});

describe('lookupVaccineNdc: the box against the CDC crosswalk', () => {
  it('names the vaccine and manufacturer of a known box and compares it to the catalog entry by CVX', () => {
    const match = lookupVaccineNdc('00006-4681-00', '03');
    expect(match).toMatchObject({
      status: 'match',
      comparedBy: 'cvx',
      vaccine: { cvx: '03', vaccineName: 'MMR', mvx: 'MSD' },
    });
    expect(match.product?.manufacturer).toMatch(/Merck/);
  });

  it('warns when the box is another vaccine', () => {
    expect(lookupVaccineNdc('00006-4681-00', '115')).toMatchObject({ status: 'mismatch', vaccine: { cvx: '03' } });
  });

  it('says not found for a box the crosswalk does not have', () => {
    expect(lookupVaccineNdc('99999-9999-99', '03')).toEqual({ status: 'not-found' });
  });
});
