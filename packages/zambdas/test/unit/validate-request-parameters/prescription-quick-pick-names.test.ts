import Oystehr from '@oystehr/sdk';
import { ActivityDefinition } from 'fhir/r4b';
import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, test, vi } from 'vitest';
import { CATEGORY_CONFIG_MAP } from '../../../src/ehr/admin-create-quick-pick';
import {
  PRESCRIPTION_QUICK_PICK_CATEGORY,
  PRESCRIPTION_SET_QUICK_PICK_CATEGORY,
} from '../../../src/ehr/shared/quick-pick-categories';
import {
  QUICK_PICK_TAG_SYSTEM,
  QuickPickCategory,
  quickPickToActivityDefinition,
} from '../../../src/ehr/shared/quick-pick-helpers';

const AMOX_STREP = {
  name: 'Amox strep',
  ndc: '00093416173',
  medicationDescription: 'Amoxicillin 400 mg/5ml Susp',
  numberOfRefills: 0,
  substitutionAllowed: true,
};

const EAR_INFECTION = { name: 'Ear infection', status: 'Active', memberIds: ['qp-amox'] };

/** A search that finds the given quick picks of the category, as saved. */
const oystehrWith = <T extends { id?: string }>(
  category: QuickPickCategory<T>,
  saved: (Record<string, unknown> & { id: string })[]
): Oystehr =>
  ({
    fhir: {
      search: async () => ({
        unbundle: (): ActivityDefinition[] =>
          saved.map(({ id, ...quickPick }) => quickPickToActivityDefinition(quickPick as any, category, id)),
      }),
    },
  }) as unknown as Oystehr;

const rejection = async (validate: Promise<void> | undefined): Promise<any> => {
  try {
    await validate;
  } catch (error) {
    return error;
  }
  return undefined;
};

describe.each([
  [
    'prescription quick pick',
    PRESCRIPTION_QUICK_PICK_CATEGORY,
    AMOX_STREP,
    'A quick pick named "amox STREP" already exists',
  ],
  [
    'prescription set',
    PRESCRIPTION_SET_QUICK_PICK_CATEGORY,
    { ...EAR_INFECTION, name: 'Amox strep' },
    'A prescription set named "amox STREP" already exists',
  ],
] as const)('%s names', (_kind, category, quickPick, message) => {
  const validator = CATEGORY_CONFIG_MAP[category.tagCode].validator;
  const oystehr = oystehrWith(category as QuickPickCategory<any>, [{ ...quickPick, id: 'qp-1' }]);

  test('a create with a name already in use, trimmed and in any case, is rejected', async () => {
    const error = await rejection(validator?.(oystehr, { ...quickPick, name: ' amox STREP ' }));
    expect(error, 'expected the request to be rejected').toBeDefined();
    expect(error.code).toBe(APIErrorCode.INVALID_INPUT);
    expect(error.message).toBe(message);
  });

  test('an update to another one with that name is rejected', async () => {
    const error = await rejection(validator?.(oystehr, { ...quickPick, name: ' amox STREP ' }, 'qp-2'));
    expect(error?.code).toBe(APIErrorCode.INVALID_INPUT);
  });

  test('the one being edited keeps its own name', async () => {
    await expect(validator?.(oystehr, { ...quickPick, name: 'Amox Strep' }, 'qp-1')).resolves.toBeUndefined();
  });

  test('a new name is accepted', async () => {
    await expect(validator?.(oystehr, { ...quickPick, name: 'Amox strep 2' })).resolves.toBeUndefined();
  });

  test('two that already share a name still save under another', async () => {
    const duplicates = oystehrWith(category as QuickPickCategory<any>, [
      { ...quickPick, id: 'qp-1' },
      { ...quickPick, id: 'qp-2' },
    ]);
    await expect(validator?.(duplicates, { ...quickPick, name: 'Amox strep 3' }, 'qp-1')).resolves.toBeUndefined();
  });
});

describe('names are unique per category', () => {
  test('a set is checked against sets only, so it may share a quick pick’s name', async () => {
    const search = vi.fn(async () => ({ unbundle: () => [] }));
    const validator = CATEGORY_CONFIG_MAP[PRESCRIPTION_SET_QUICK_PICK_CATEGORY.tagCode].validator;
    await validator?.({ fhir: { search } } as unknown as Oystehr, { ...EAR_INFECTION, name: 'Amox strep' });
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.arrayContaining([
          { name: '_tag', value: `${QUICK_PICK_TAG_SYSTEM}|${PRESCRIPTION_SET_QUICK_PICK_CATEGORY.tagCode}` },
        ]),
      })
    );
  });
});
