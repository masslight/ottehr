import Oystehr from '@oystehr/sdk';
import { MAX_PLAUSIBLE_LENGTH_CM } from 'utils/lib/procedure-coding/extract';
import { REPAIR_DEPTH_OPTIONS } from 'utils/lib/procedure-coding/format';
import { ProcedureQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, test } from 'vitest';
import { CATEGORY_CONFIG_MAP, validateInput } from '../../../src/ehr/admin-create-quick-pick';
import {
  ALLERGY_QUICK_PICK_CATEGORY,
  PROCEDURE_QUICK_PICK_CATEGORY,
} from '../../../src/ehr/shared/quick-pick-categories';
import {
  QUICK_PICK_CONFIG_EXTENSION_URL,
  quickPickToActivityDefinition,
} from '../../../src/ehr/shared/quick-pick-helpers';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const stubOystehr = {
  fhir: { search: async () => ({ unbundle: () => [] }) },
} as unknown as Oystehr;

const validateCreate = async (category: string, quickPick: Record<string, unknown>): Promise<void> => {
  const validated = validateInput(createMockZambdaInput({ category, quickPick }, { secrets: createMockSecrets() }));
  const config = CATEGORY_CONFIG_MAP[validated.category];
  if (config.validator) {
    await config.validator(stubOystehr, validated.quickPick);
  }
};

const validateProcedureQuickPick = async (fields: Record<string, unknown>): Promise<void> => {
  await validateCreate(PROCEDURE_QUICK_PICK_CATEGORY.tagCode, { name: 'Lac Repair - Left Arm', ...fields });
};

const expectRejected = async (fields: Record<string, unknown>): Promise<void> => {
  let thrown: any;
  try {
    await validateProcedureQuickPick(fields);
  } catch (error) {
    thrown = error;
  }
  expect(thrown, 'expected the request to be rejected').toBeDefined();
  expect(thrown.code).toBe(APIErrorCode.INVALID_INPUT);
};

describe('admin-create-quick-pick - procedure quick pick payload', () => {
  test('should accept a procedure quick pick with none of the structured fields set', async () => {
    await expect(validateProcedureQuickPick({})).resolves.toBeUndefined();
  });

  test('should accept all four structured fields together', async () => {
    await expect(
      validateProcedureQuickPick({
        lengthCm: 3.5,
        repairDepth: 'subcutaneous-layered',
        infusionStartTime: '10:15',
        infusionStopTime: '11:00',
      })
    ).resolves.toBeUndefined();
  });

  test('should leave the rest of ProcedureQuickPickData unchecked', async () => {
    await expect(
      validateProcedureQuickPick({
        procedureType: 'Laceration Repair',
        cptCodes: [{ code: '12042', display: 'Intermediate repair' }],
        bodySite: 'Left arm',
        technique: ['Simple interrupted'],
        consentObtained: true,
        procedureDetails: 'Layered closure, 5 x 4-0 nylon',
      })
    ).resolves.toBeUndefined();
  });

  test('should still require name', async () => {
    let thrown: any;
    try {
      await validateCreate(PROCEDURE_QUICK_PICK_CATEGORY.tagCode, { lengthCm: 3.5 });
    } catch (error) {
      thrown = error;
    }
    expect(thrown.code).toBe(APIErrorCode.INVALID_INPUT);
  });
});

describe('admin-create-quick-pick - procedure lengthCm', () => {
  test.each([0.1, 1, 3.5, MAX_PLAUSIBLE_LENGTH_CM])('should accept %s cm', async (lengthCm) => {
    await expect(validateProcedureQuickPick({ lengthCm })).resolves.toBeUndefined();
  });

  test.each([
    ['just past the plausibility ceiling', MAX_PLAUSIBLE_LENGTH_CM + 0.1],
    ['far past the plausibility ceiling', 100_000],
    ['zero', 0],
    ['negative', -5],
    ['infinity', Number.POSITIVE_INFINITY],
    ['a numeric string', '3.5'],
    ['null', null],
  ])('should throw for %s', async (_label, lengthCm) => {
    await expectRejected({ lengthCm });
  });
});

describe('admin-create-quick-pick - procedure repairDepth', () => {
  test.each(REPAIR_DEPTH_OPTIONS.map((option) => option.value))(
    'should accept the %s selection',
    async (repairDepth) => {
      await expect(validateProcedureQuickPick({ repairDepth })).resolves.toBeUndefined();
    }
  );

  test.each([
    ['an unknown selection', 'deep-single'],
    ['a display label instead of the stored code', 'Subcutaneous — layered closure'],
    ['markup', '<script>alert(1)</script>'],
    ['an empty string', ''],
    ['a non-string', 3],
  ])('should throw for %s', async (_label, repairDepth) => {
    await expectRejected({ repairDepth });
  });
});

describe('admin-create-quick-pick - procedure infusion times', () => {
  test.each(['00:00', '09:05', '12:30', '23:59'])('should accept %s', async (time) => {
    await expect(
      validateProcedureQuickPick({ infusionStartTime: time, infusionStopTime: time })
    ).resolves.toBeUndefined();
  });

  test.each([
    ['an out-of-range hour', '24:00'],
    ['an out-of-range minute', '12:60'],
    ['a nonsense clock', '99:99'],
    ['an unpadded hour, a second spelling of one time', '9:05'],
    ['seconds precision', '09:05:00'],
    ['a 12-hour clock with a meridiem', '9:05 pm'],
    ['an empty string', ''],
    ['free text', 'around lunchtime'],
    ['a non-string', 1015],
  ])('should throw for %s as a start time', async (_label, infusionStartTime) => {
    await expectRejected({ infusionStartTime });
  });

  test('should throw for an invalid stop time even when the start time is valid', async () => {
    await expectRejected({ infusionStartTime: '10:00', infusionStopTime: '24:00' });
  });
});

describe('admin-create-quick-pick - other categories are unaffected', () => {
  test('should not apply the procedure field rules to another category', async () => {
    await expect(
      validateCreate(ALLERGY_QUICK_PICK_CATEGORY.tagCode, { name: 'Penicillin', lengthCm: -5 })
    ).resolves.toBeUndefined();
  });

  test('should reject an unknown category', () => {
    expect(() =>
      validateInput(
        createMockZambdaInput(
          { category: 'not-a-quick-pick', quickPick: { name: 'x' } },
          { secrets: createMockSecrets() }
        )
      )
    ).toThrow('Unknown quick pick category');
  });
});

describe('admin-create-quick-pick - stored config round trip', () => {
  const storedConfig = (quickPick: Omit<ProcedureQuickPickData, 'id'>): Record<string, unknown> => {
    const ad = quickPickToActivityDefinition(quickPick, PROCEDURE_QUICK_PICK_CATEGORY);
    const configExtension = ad.extension?.find((extension) => extension.url === QUICK_PICK_CONFIG_EXTENSION_URL);
    return JSON.parse(configExtension?.valueString ?? '{}');
  };

  test('should store the structured fields in the config blob once they pass validation', async () => {
    const quickPick = {
      name: 'Lac Repair - Left Arm',
      lengthCm: 3.5,
      repairDepth: 'subcutaneous-layered',
      infusionStartTime: '10:15',
      infusionStopTime: '11:00',
    };
    await validateProcedureQuickPick(quickPick);

    expect(storedConfig(quickPick)).toMatchObject({
      lengthCm: 3.5,
      repairDepth: 'subcutaneous-layered',
      infusionStartTime: '10:15',
      infusionStopTime: '11:00',
    });
  });
});
