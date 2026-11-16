import Oystehr from '@oystehr/sdk';
import { ActivityDefinition } from 'fhir/r4b';
import { PrescriptionSetQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, test, vi } from 'vitest';
import { CATEGORY_CONFIG_MAP, validateInput as validateCreateInput } from '../../../src/ehr/admin-create-quick-pick';
import { removeQuickPick, takeOutOfPrescriptionSets } from '../../../src/ehr/admin-remove-quick-pick';
import { validateInput as validateUpdateInput } from '../../../src/ehr/admin-update-quick-pick';
import {
  PRESCRIPTION_QUICK_PICK_CATEGORY,
  PRESCRIPTION_SET_QUICK_PICK_CATEGORY,
} from '../../../src/ehr/shared/quick-pick-categories';
import {
  activityDefinitionToQuickPick,
  QUICK_PICK_TAG_SYSTEM,
  quickPickToActivityDefinition,
} from '../../../src/ehr/shared/quick-pick-helpers';
import { createMockSecrets, createMockZambdaInput } from './helpers';

// The practice's prescription quick picks; no sets.
const QUICK_PICKS = ['qp-amox', 'qp-ibuprofen'].map((id) =>
  quickPickToActivityDefinition({ name: id }, PRESCRIPTION_QUICK_PICK_CATEGORY, id)
);
const search = vi.fn(async ({ params }: { params: { name: string; value: string }[] }) => ({
  unbundle: () =>
    params.some(
      ({ name, value }) =>
        name === '_tag' && value === `${QUICK_PICK_TAG_SYSTEM}|${PRESCRIPTION_QUICK_PICK_CATEGORY.tagCode}`
    )
      ? QUICK_PICKS
      : [],
}));
const stubOystehr = { fhir: { search } } as unknown as Oystehr;

const CATEGORY = PRESCRIPTION_SET_QUICK_PICK_CATEGORY.tagCode;

const EAR_INFECTION: Omit<PrescriptionSetQuickPickData, 'id'> = {
  name: 'Ear infection',
  status: 'Active',
  memberIds: ['qp-amox', 'qp-ibuprofen'],
};

const validateCreate = async (quickPick: Record<string, unknown>): Promise<void> => {
  const validated = validateCreateInput(
    createMockZambdaInput({ category: CATEGORY, quickPick }, { secrets: createMockSecrets() })
  );
  await CATEGORY_CONFIG_MAP[validated.category].validator?.(stubOystehr, validated.quickPick);
};

const validateUpdate = async (quickPick: Record<string, unknown>): Promise<void> => {
  const validated = validateUpdateInput(
    createMockZambdaInput({ category: CATEGORY, quickPickId: 'set-1', quickPick }, { secrets: createMockSecrets() })
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
])('%s - prescription set', (_endpoint, validate) => {
  test('accepts a name, a status and its quick picks in order', async () => {
    await expect(validate(EAR_INFECTION)).resolves.toBeUndefined();
    await expect(validate({ ...EAR_INFECTION, status: 'Inactive' })).resolves.toBeUndefined();
  });

  test('accepts the note of a removed quick pick', async () => {
    await expect(
      validate({ ...EAR_INFECTION, removedMembers: [{ name: 'Amox', removedAt: '2026-10-27T14:00:00.000Z' }] })
    ).resolves.toBeUndefined();
  });

  // Claim audit r6, flag 2: a dialog opened before a quick pick was removed would save it back into the set.
  test('refuses a quick pick that no longer exists, found by a search of its own making', async () => {
    search.mockClear();
    const one = await rejection(validate({ ...EAR_INFECTION, memberIds: ['qp-amox', 'qp-gone'] }));
    expect(one?.code).toBe(APIErrorCode.INVALID_INPUT);
    expect(one.message).toBe('1 prescription in this set no longer exists. Reopen the set and save again.');
    const two = await rejection(validate({ ...EAR_INFECTION, memberIds: ['qp-gone', 'qp-amox', 'qp-old'] }));
    expect(two.message).toBe('2 prescriptions in this set no longer exist. Reopen the set and save again.');
    // Only the prescription quick picks are searched, never with the ids sent.
    expect(search).toHaveBeenCalledWith({
      resourceType: 'ActivityDefinition',
      params: [
        { name: '_tag', value: `${QUICK_PICK_TAG_SYSTEM}|${PRESCRIPTION_QUICK_PICK_CATEGORY.tagCode}` },
        { name: 'status', value: 'active' },
      ],
    });
    expect(JSON.stringify(search.mock.calls)).not.toContain('qp-gone');
  });

  // Claim audit r7: the order form would add the same prescription twice.
  test('refuses the same quick pick listed twice', async () => {
    const error = await rejection(validate({ ...EAR_INFECTION, memberIds: ['qp-amox', 'qp-ibuprofen', 'qp-amox'] }));
    expect(error?.code).toBe(APIErrorCode.INVALID_INPUT);
    expect(error.message).toBe('This set lists the same quick pick more than once. Remove one and save again.');
  });

  test.each([
    ['no name', { ...EAR_INFECTION, name: '' }],
    ['no status', { name: 'Ear infection', memberIds: ['qp-amox'] }],
    ['an unknown status', { ...EAR_INFECTION, status: 'Retired' }],
    ['no quick picks', { ...EAR_INFECTION, memberIds: [] }],
    ['no member list', { name: 'Ear infection', status: 'Active' }],
    ['an empty quick pick id', { ...EAR_INFECTION, memberIds: [' '] }],
  ])('rejects %s', async (_case, quickPick) => {
    const error = await rejection(validate(quickPick));
    expect(error, 'expected the request to be rejected').toBeDefined();
    expect(error.code).toBe(APIErrorCode.INVALID_INPUT);
  });
});

describe('prescription set storage', () => {
  test('keeps its status and members in order through the ActivityDefinition', () => {
    const ad = quickPickToActivityDefinition(EAR_INFECTION, PRESCRIPTION_SET_QUICK_PICK_CATEGORY, 'set-1');
    expect(ad.title).toBe('Ear infection');
    expect(ad.meta?.tag).toEqual([{ system: QUICK_PICK_TAG_SYSTEM, code: 'prescription-set-quick-pick' }]);
    expect(activityDefinitionToQuickPick(ad, PRESCRIPTION_SET_QUICK_PICK_CATEGORY)).toEqual({
      id: 'set-1',
      ...EAR_INFECTION,
    });
  });
});

const setAd = (id: string, set: Omit<PrescriptionSetQuickPickData, 'id'>): ActivityDefinition =>
  quickPickToActivityDefinition(set, PRESCRIPTION_SET_QUICK_PICK_CATEGORY, id);

const mockOystehr = (
  sets: ActivityDefinition[],
  existing?: ActivityDefinition
): { oystehr: Oystehr; update: ReturnType<typeof vi.fn> } => {
  const update = vi.fn(async (resource: ActivityDefinition) => resource);
  const oystehr = {
    fhir: {
      get: vi.fn(async () => existing),
      search: vi.fn(async () => ({ unbundle: () => sets })),
      update,
    },
  } as unknown as Oystehr;
  return { oystehr, update };
};

describe('admin-remove-quick-pick - prescription sets', () => {
  const strep = setAd('set-2', { name: 'Strep throat', status: 'Active', memberIds: ['qp-amox'] });
  const cough = setAd('set-3', { name: 'Cough', status: 'Active', memberIds: ['qp-honey'] });

  test('takes the quick pick out of the sets that have it, makes them Inactive and notes it', async () => {
    const { oystehr, update } = mockOystehr([setAd('set-1', EAR_INFECTION), strep, cough]);
    await takeOutOfPrescriptionSets(oystehr, 'qp-amox', 'Amox otitis', '2026-10-27T14:00:00.000Z');
    expect(update).toHaveBeenCalledTimes(2);
    const updated = update.mock.calls.map(([ad]) =>
      activityDefinitionToQuickPick(ad, PRESCRIPTION_SET_QUICK_PICK_CATEGORY)
    );
    expect(updated).toEqual([
      {
        id: 'set-1',
        name: 'Ear infection',
        status: 'Inactive',
        memberIds: ['qp-ibuprofen'],
        removedMembers: [{ name: 'Amox otitis', removedAt: '2026-10-27T14:00:00.000Z' }],
      },
      {
        id: 'set-2',
        name: 'Strep throat',
        status: 'Inactive',
        memberIds: [],
        removedMembers: [{ name: 'Amox otitis', removedAt: '2026-10-27T14:00:00.000Z' }],
      },
    ]);
  });

  test('adds to the notes of a set already waiting for review', async () => {
    const earlier = { name: 'Ibuprofen', removedAt: '2026-10-26T14:00:00.000Z' };
    const { oystehr, update } = mockOystehr([
      setAd('set-1', { ...EAR_INFECTION, status: 'Inactive', removedMembers: [earlier] }),
    ]);
    await takeOutOfPrescriptionSets(oystehr, 'qp-amox', 'Amox otitis', '2026-10-27T14:00:00.000Z');
    const [ad] = update.mock.calls[0];
    expect(activityDefinitionToQuickPick(ad, PRESCRIPTION_SET_QUICK_PICK_CATEGORY)).toMatchObject({
      removedMembers: [earlier, { name: 'Amox otitis', removedAt: '2026-10-27T14:00:00.000Z' }],
    });
  });

  test('removing a prescription quick pick updates its sets, then retires it', async () => {
    const quickPick = quickPickToActivityDefinition(
      { name: 'Amox otitis' },
      PRESCRIPTION_QUICK_PICK_CATEGORY,
      'qp-amox'
    );
    const { oystehr, update } = mockOystehr([setAd('set-1', EAR_INFECTION)], quickPick);
    await removeQuickPick('qp-amox', oystehr);
    expect(update.mock.calls[0][0]).toMatchObject({ id: 'set-1' });
    expect(
      activityDefinitionToQuickPick(update.mock.calls[0][0], PRESCRIPTION_SET_QUICK_PICK_CATEGORY).removedMembers?.[0]
        .name
    ).toBe('Amox otitis');
    expect(update.mock.calls[1][0]).toMatchObject({ id: 'qp-amox', status: 'retired' });
  });

  test('a set that fails to update leaves the quick pick in place', async () => {
    const quickPick = quickPickToActivityDefinition(
      { name: 'Amox otitis' },
      PRESCRIPTION_QUICK_PICK_CATEGORY,
      'qp-amox'
    );
    const { oystehr, update } = mockOystehr([setAd('set-1', EAR_INFECTION)], quickPick);
    update.mockRejectedValueOnce(new Error('set update failed'));
    await expect(removeQuickPick('qp-amox', oystehr)).rejects.toThrow('set update failed');
    expect(update.mock.calls.map(([resource]) => resource.id)).toEqual(['set-1']);
  });

  test('removing another kind of quick pick leaves the sets alone', async () => {
    const allergy: ActivityDefinition = {
      ...quickPickToActivityDefinition({ name: 'Penicillin' }, PRESCRIPTION_QUICK_PICK_CATEGORY, 'a-1'),
      meta: { tag: [{ system: QUICK_PICK_TAG_SYSTEM, code: 'allergy-quick-pick' }] },
    };
    const { oystehr, update } = mockOystehr([setAd('set-1', { ...EAR_INFECTION, memberIds: ['a-1'] })], allergy);
    await removeQuickPick('a-1', oystehr);
    expect(update).toHaveBeenCalledTimes(1);
    expect(oystehr.fhir.search).not.toHaveBeenCalled();
  });
});
