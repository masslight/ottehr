import Oystehr from '@oystehr/sdk';
import { PrescriptionQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, test } from 'vitest';
import { CATEGORY_CONFIG_MAP, validateInput as validateCreateInput } from '../../../src/ehr/admin-create-quick-pick';
import { validateInput as validateUpdateInput } from '../../../src/ehr/admin-update-quick-pick';
import { PRESCRIPTION_QUICK_PICK_CATEGORY } from '../../../src/ehr/shared/quick-pick-categories';
import {
  activityDefinitionToQuickPick,
  QUICK_PICK_CONFIG_EXTENSION_URL,
  quickPickToActivityDefinition,
} from '../../../src/ehr/shared/quick-pick-helpers';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const stubOystehr = {
  fhir: { search: async () => ({ unbundle: () => [] }) },
} as unknown as Oystehr;

const CATEGORY = PRESCRIPTION_QUICK_PICK_CATEGORY.tagCode;

const AMOX_STREP: Omit<PrescriptionQuickPickData, 'id'> = {
  name: 'Amox strep',
  ndc: '00093416173',
  medicationDescription: 'Amoxicillin 400 mg/5ml Susp',
  quantityValue: 120,
  quantityUnit: 'Milliliter',
  daysSupply: 10,
  numberOfRefills: 0,
  substitutionAllowed: true,
  patientInstructions: 'Take 6 mL by mouth twice daily for 10 days.',
  dosing: {
    rate: 25,
    basis: 'mg/kg/dose',
    dosesPerDay: 2,
    frequency: 'twice daily',
    durationDays: 10,
    maxPerDoseMg: 500,
  },
};

const validateCreate = async (quickPick: Record<string, unknown>): Promise<void> => {
  const validated = validateCreateInput(
    createMockZambdaInput({ category: CATEGORY, quickPick }, { secrets: createMockSecrets() })
  );
  await CATEGORY_CONFIG_MAP[validated.category].validator?.(stubOystehr, validated.quickPick);
};

const validateUpdate = async (quickPick: Record<string, unknown>): Promise<void> => {
  const validated = validateUpdateInput(
    createMockZambdaInput({ category: CATEGORY, quickPickId: 'qp-1', quickPick }, { secrets: createMockSecrets() })
  );
  await CATEGORY_CONFIG_MAP[validated.category].validator?.(stubOystehr, validated.quickPick, validated.quickPickId);
};

const rejection = async (validate: Promise<void>): Promise<any> => {
  try {
    await validate;
  } catch (error) {
    return error;
  }
  return undefined;
};

describe.each([
  ['admin-create-quick-pick', validateCreate],
  ['admin-update-quick-pick', validateUpdate],
])('%s - prescription dosing', (_endpoint, validate) => {
  test('accepts a prescription quick pick with the calculator’s dosing', async () => {
    await expect(validate(AMOX_STREP)).resolves.toBeUndefined();
  });

  test('accepts one without dosing, as older quick picks are', async () => {
    const { dosing: _dosing, ...older } = AMOX_STREP;
    await expect(validate(older)).resolves.toBeUndefined();
  });

  test('accepts a dose not by weight with only a rate and a basis', async () => {
    await expect(validate({ ...AMOX_STREP, dosing: { rate: 500, basis: 'fixed' } })).resolves.toBeUndefined();
  });

  test.each([
    ['no rate', { basis: 'mg/kg/dose' }],
    ['a zero rate', { rate: 0, basis: 'mg/kg/dose' }],
    ['a rate as text', { rate: '25', basis: 'mg/kg/dose' }],
    ['an unknown basis', { rate: 25, basis: 'mg/dose' }],
    ['a per-day rate without its doses a day', { rate: 80, basis: 'mg/kg/day' }],
    ['a frequency the order form doesn’t have', { rate: 25, basis: 'mg/kg/dose', frequency: 'bid' }],
    ['a part day', { rate: 25, basis: 'mg/kg/dose', durationDays: 2.5 }],
    ['a negative maximum per dose', { rate: 25, basis: 'mg/kg/dose', maxPerDoseMg: -1 }],
    ['a zero maximum per day', { rate: 25, basis: 'mg/kg/dose', dosesPerDay: 2, maxPerDayMg: 0 }],
    ['dosing that is not an object', 'twice daily'],
  ])('rejects %s', async (_label, dosing) => {
    const error = await rejection(validate({ ...AMOX_STREP, dosing }));
    expect(error, 'expected the request to be rejected').toBeDefined();
    expect(error.code).toBe(APIErrorCode.INVALID_INPUT);
  });
});

const SOURCE = { label: 'AAP Red Book 2024–2027, amoxicillin', url: 'https://publications.aap.org/redbook' };

describe.each([
  ['admin-create-quick-pick', validateCreate],
  ['admin-update-quick-pick', validateUpdate],
])('%s - prescription source', (_endpoint, validate) => {
  test('accepts a source with a label and an https link', async () => {
    await expect(validate({ ...AMOX_STREP, source: SOURCE })).resolves.toBeUndefined();
  });

  test('accepts a source with only a label, and a label of 200 characters', async () => {
    await expect(validate({ ...AMOX_STREP, source: { label: 'IDSA' } })).resolves.toBeUndefined();
    await expect(validate({ ...AMOX_STREP, source: { label: 'x'.repeat(200) } })).resolves.toBeUndefined();
  });

  test.each([
    ['no label', { url: SOURCE.url }],
    ['an empty label', { label: '  ' }],
    ['a label over 200 characters', { label: 'x'.repeat(201) }],
    ['an http link', { label: 'AAP', url: 'http://publications.aap.org/redbook' }],
    ['a javascript link', { label: 'AAP', url: 'javascript:alert(1)' }],
    ['a link that is not a URL', { label: 'AAP', url: 'publications.aap.org' }],
    ['a source that is not an object', 'AAP Red Book'],
  ])('rejects %s', async (_label, source) => {
    const error = await rejection(validate({ ...AMOX_STREP, source }));
    expect(error, 'expected the request to be rejected').toBeDefined();
    expect(error.code).toBe(APIErrorCode.INVALID_INPUT);
  });
});

describe('prescription quick pick dosing - stored config round trip', () => {
  test('stores the source in the config extension and loads it back', () => {
    const withSource = { ...AMOX_STREP, source: SOURCE };
    const ad = quickPickToActivityDefinition(withSource, PRESCRIPTION_QUICK_PICK_CATEGORY);
    const stored = JSON.parse(
      ad.extension?.find((extension) => extension.url === QUICK_PICK_CONFIG_EXTENSION_URL)?.valueString ?? '{}'
    );
    expect(stored.source).toEqual(SOURCE);
    expect(activityDefinitionToQuickPick({ ...ad, id: 'qp-3' }, PRESCRIPTION_QUICK_PICK_CATEGORY)).toEqual({
      id: 'qp-3',
      ...withSource,
    });
  });

  test('stores the dosing block in the config extension and loads it back', () => {
    const ad = quickPickToActivityDefinition(AMOX_STREP, PRESCRIPTION_QUICK_PICK_CATEGORY);
    const stored = JSON.parse(
      ad.extension?.find((extension) => extension.url === QUICK_PICK_CONFIG_EXTENSION_URL)?.valueString ?? '{}'
    );
    expect(stored.dosing).toEqual(AMOX_STREP.dosing);
    expect(stored).not.toHaveProperty('name');

    const loaded = activityDefinitionToQuickPick({ ...ad, id: 'qp-1' }, PRESCRIPTION_QUICK_PICK_CATEGORY);
    expect(loaded).toEqual({ id: 'qp-1', ...AMOX_STREP });
  });

  test('loads an older quick pick without dosing unchanged', () => {
    const { dosing: _dosing, ...older } = AMOX_STREP;
    const ad = quickPickToActivityDefinition(older, PRESCRIPTION_QUICK_PICK_CATEGORY);
    const loaded = activityDefinitionToQuickPick({ ...ad, id: 'qp-2' }, PRESCRIPTION_QUICK_PICK_CATEGORY);
    expect(loaded).toEqual({ id: 'qp-2', ...older });
    expect(loaded).not.toHaveProperty('dosing');
  });
});
