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

  test('accepts a maximum per day with the count from the frequency, and an as-needed frequency with its doses a day', async () => {
    await expect(
      validate({
        ...AMOX_STREP,
        dosing: { rate: 25, basis: 'mg/kg/dose', frequency: 'twice daily', maxPerDayMg: 1000 },
      })
    ).resolves.toBeUndefined();
    await expect(
      validate({ ...AMOX_STREP, dosing: { rate: 25, basis: 'mg/kg/dose', frequency: 'as needed', dosesPerDay: 3 } })
    ).resolves.toBeUndefined();
  });

  test('accepts a per-day rate with a scheduled frequency and no doses a day, and an older one with them', async () => {
    await expect(
      validate({ ...AMOX_STREP, dosing: { rate: 80, basis: 'mg/kg/day', frequency: 'twice daily' } })
    ).resolves.toBeUndefined();
    await expect(
      validate({ ...AMOX_STREP, dosing: { rate: 80, basis: 'mg/kg/day', dosesPerDay: 3, frequency: 'twice daily' } })
    ).resolves.toBeUndefined();
  });

  test('accepts a dose not by weight with only a rate and a basis', async () => {
    await expect(validate({ ...AMOX_STREP, dosing: { rate: 500, basis: 'fixed' } })).resolves.toBeUndefined();
  });

  test.each([
    ['no rate', { basis: 'mg/kg/dose' }],
    ['a zero rate', { rate: 0, basis: 'mg/kg/dose' }],
    ['a rate as text', { rate: '25', basis: 'mg/kg/dose' }],
    ['an unknown basis', { rate: 25, basis: 'mg/dose' }],
    ['a per-day rate without a frequency', { rate: 80, basis: 'mg/kg/day' }],
    ['a per-day rate with only "as needed"', { rate: 80, basis: 'mg/kg/day', frequency: 'as needed' }],
    ['a frequency the order form doesn’t have', { rate: 25, basis: 'mg/kg/dose', frequency: 'bid' }],
    ['a part day', { rate: 25, basis: 'mg/kg/dose', durationDays: 2.5 }],
    ['a negative maximum per dose', { rate: 25, basis: 'mg/kg/dose', maxPerDoseMg: -1 }],
    ['a zero maximum per day', { rate: 25, basis: 'mg/kg/dose', dosesPerDay: 2, maxPerDayMg: 0 }],
    ['dosing that is not an object', 'twice daily'],
    ['a frequency every object has ("constructor")', { rate: 25, basis: 'mg/kg/dose', frequency: 'constructor' }],
    ['a frequency every object has ("toString")', { rate: 25, basis: 'mg/kg/dose', frequency: 'toString' }],
    [
      'a maximum per day without doses a day or a counted frequency',
      { rate: 25, basis: 'mg/kg/dose', maxPerDayMg: 1000 },
    ],
    [
      'a maximum per day with only "as needed"',
      { rate: 25, basis: 'mg/kg/dose', frequency: 'as needed', maxPerDayMg: 1000 },
    ],
  ])('rejects %s', async (_label, dosing) => {
    const error = await rejection(validate({ ...AMOX_STREP, dosing }));
    expect(error, 'expected the request to be rejected').toBeDefined();
    expect(error.code).toBe(APIErrorCode.INVALID_INPUT);
  });
});

describe.each([
  ['admin-create-quick-pick', validateCreate],
  ['admin-update-quick-pick', validateUpdate],
])('%s - prescription product', (_endpoint, validate) => {
  test.each([
    ['no NDC', { ndc: undefined }],
    ['an empty NDC', { ndc: '' }],
    ['no medication description', { medicationDescription: undefined }],
  ])('rejects a quick pick with %s, with or without dosing', async (_label, product) => {
    const { dosing: _dosing, ...asWritten } = AMOX_STREP;
    for (const quickPick of [AMOX_STREP, asWritten]) {
      const error = await rejection(validate({ ...quickPick, ...product }));
      expect(error, 'expected the request to be rejected').toBeDefined();
      expect(error.code).toBe(APIErrorCode.INVALID_INPUT);
    }
  });
});

describe.each([
  ['admin-create-quick-pick', validateCreate],
  ['admin-update-quick-pick', validateUpdate],
])('%s - prescription additional instructions', (_endpoint, validate) => {
  test('accepts additional instructions up to 500 characters', async () => {
    await expect(
      validate({ ...AMOX_STREP, additionalInstructions: 'Shake well. Take with food.' })
    ).resolves.toBeUndefined();
    await expect(validate({ ...AMOX_STREP, additionalInstructions: 'x'.repeat(500) })).resolves.toBeUndefined();
  });

  test.each([
    ['over 500 characters', 'x'.repeat(501)],
    ['not text', 5],
  ])('rejects additional instructions %s', async (_label, additionalInstructions) => {
    const error = await rejection(validate({ ...AMOX_STREP, additionalInstructions }));
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

describe.each([
  ['admin-create-quick-pick', validateCreate],
  ['admin-update-quick-pick', validateUpdate],
])('%s - prescription diagnosis', (_endpoint, validate) => {
  test('accepts a diagnosis with a code and display', async () => {
    await expect(
      validate({ ...AMOX_STREP, diagnosis: { code: 'J02.0', display: 'Streptococcal pharyngitis' } })
    ).resolves.toBeUndefined();
  });

  test.each([
    ['no code', { display: 'Streptococcal pharyngitis' }],
    ['an empty code', { code: '', display: 'Streptococcal pharyngitis' }],
    ['no display', { code: 'J02.0' }],
    ['a diagnosis that is not an object', 'J02.0'],
  ])('rejects %s', async (_label, diagnosis) => {
    const error = await rejection(validate({ ...AMOX_STREP, diagnosis }));
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

// As the medication search gives them: amoxicillin 80 MG/ML / clavulanate 11.4 MG/ML Oral Suspension.
const DETAILS = {
  rxcui: '617430',
  doseForm: 'Oral Suspension',
  ingredients: [
    { name: 'amoxicillin', amount: 80, unit: 'MG', per: 1, perUnit: 'ML' },
    { name: 'clavulanate', amount: 11.4, unit: 'MG', per: 1, perUnit: 'ML' },
  ],
};

describe.each([
  ['admin-create-quick-pick', validateCreate],
  ['admin-update-quick-pick', validateUpdate],
])('%s - prescription product details', (_endpoint, validate) => {
  test('accepts the product’s RxCUI, dose form and ingredients', async () => {
    await expect(validate({ ...AMOX_STREP, ...DETAILS })).resolves.toBeUndefined();
  });

  test.each([
    ['an RxCUI that isn’t digits', { rxcui: '617430a' }],
    ['an empty dose form', { doseForm: '' }],
    ['no ingredients', { ingredients: [] }],
    ['an amount as text', { ingredients: [{ ...DETAILS.ingredients[0], amount: '80' }] }],
    ['a zero "per"', { ingredients: [{ ...DETAILS.ingredients[0], per: 0 }] }],
    ['an ingredient without a unit', { ingredients: [{ ...DETAILS.ingredients[0], unit: '' }] }],
  ])('rejects %s', async (_label, details) => {
    const error = await rejection(validate({ ...AMOX_STREP, ...DETAILS, ...details }));
    expect(error, 'expected the request to be rejected').toBeDefined();
    expect(error.code).toBe(APIErrorCode.INVALID_INPUT);
  });
});

// A compound quick pick: no NDC, medication description, substitution or dosing.
const COMPOUND_PICK: Omit<PrescriptionQuickPickData, 'id'> = {
  name: 'Pain cream',
  compound: {
    description: 'Ketoprofen / gabapentin / lidocaine cream',
    ingredients: [
      { description: 'Ketoprofen Powder', ndc: '00000000001', rxcui: '1001', strength: { value: 10, unit: '%' } },
      { description: 'Gabapentin Powder', ndc: '00000000002', amount: { value: 6, unit: 'Gram' } },
      { description: 'Compounding cream', typedNotControlled: true, base: true },
    ],
  },
  quantityValue: 60,
  quantityUnit: 'Gram',
  daysSupply: 30,
  numberOfRefills: 1,
  patientInstructions: 'Apply to the affected area three times daily.',
};

describe.each([
  ['admin-create-quick-pick', validateCreate],
  ['admin-update-quick-pick', validateUpdate],
])('%s - prescription compound', (_endpoint, validate) => {
  test('accepts a compound without an NDC', async () => {
    await expect(validate(COMPOUND_PICK)).resolves.toBeUndefined();
  });

  const [ketoprofen, gabapentin, base] = COMPOUND_PICK.compound!.ingredients;
  test.each([
    ['an NDC as well', { ndc: '00093416173' }],
    // Review #7: a compound has no calculator settings or substitution.
    ['dosing', { dosing: AMOX_STREP.dosing }],
    ['a substitution choice', { substitutionAllowed: true }],
    ['no compound name', { compound: { ...COMPOUND_PICK.compound!, description: '' } }],
    ['no ingredients', { compound: { ...COMPOUND_PICK.compound!, ingredients: [] } }],
    [
      'an ingredient without a measure',
      { compound: { description: 'x', ingredients: [{ ...ketoprofen, strength: undefined }] } },
    ],
    [
      'an ingredient with two measures',
      { compound: { description: 'x', ingredients: [{ ...gabapentin, base: true }] } },
    ],
    [
      'a typed ingredient not confirmed',
      { compound: { description: 'x', ingredients: [{ description: 'Cream', base: true }] } },
    ],
    ['two bases', { compound: { description: 'x', ingredients: [ketoprofen, base, base] } }],
  ])('rejects a compound quick pick with %s', async (_label, change) => {
    const error = await rejection(validate({ ...COMPOUND_PICK, ...change }));
    expect(error, 'expected the request to be rejected').toBeDefined();
    expect(error.code).toBe(APIErrorCode.INVALID_INPUT);
  });

  test('saves and loads a compound back unchanged', () => {
    const ad = quickPickToActivityDefinition(COMPOUND_PICK, PRESCRIPTION_QUICK_PICK_CATEGORY);
    expect(activityDefinitionToQuickPick({ ...ad, id: 'qp-9' }, PRESCRIPTION_QUICK_PICK_CATEGORY)).toEqual({
      id: 'qp-9',
      ...COMPOUND_PICK,
    });
  });
});
