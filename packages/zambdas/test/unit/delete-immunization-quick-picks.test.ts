// The one-time cleanup that deletes every immunization quick pick: they were saved against the vaccines the retired
// config/oystehr/vaccines.json created, which the vaccine list does not have.
import Oystehr from '@oystehr/sdk';
import { ActivityDefinition, Bundle } from 'fhir/r4b';
import { ImmunizationQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { describe, expect, it, vi } from 'vitest';
import { IMMUNIZATION_QUICK_PICK_CATEGORY } from '../../src/ehr/shared/quick-pick-categories';
import { QUICK_PICK_TAG_SYSTEM, quickPickToActivityDefinition } from '../../src/ehr/shared/quick-pick-helpers';
import { deleteImmunizationQuickPicks } from '../../src/scripts/delete-immunization-quick-picks.helpers';

const quickPick = (id: string, name: string, status: ActivityDefinition['status'] = 'active'): ActivityDefinition => ({
  ...quickPickToActivityDefinition<ImmunizationQuickPickData>(
    { name, vaccine: { id: 'a3f1c2d4-0000-4000-8000-000000000001', name: 'Tdap (Adacel/Boostrix)' } },
    IMMUNIZATION_QUICK_PICK_CATEGORY
  ),
  id,
  status,
});

/** One page holding everything, as getAllFhirSearchPages reads it. */
const searchPage = (resources: ActivityDefinition[]): Bundle<ActivityDefinition> & { unbundle: () => unknown } => ({
  resourceType: 'Bundle',
  type: 'searchset',
  total: resources.length,
  entry: resources.map((resource) => ({ resource, search: { mode: 'match' as const } })),
  unbundle: () => resources,
});

const QUICK_PICKS = [
  quickPick('qp-1', 'Tdap adult'),
  quickPick('qp-2', 'MMR'),
  quickPick('qp-3', 'Old one', 'retired'),
];

type DeleteRequest = { resourceType: string; id: string };

const makeOystehr = (
  remove = vi.fn(async (_request: DeleteRequest): Promise<void> => undefined)
): { oystehr: Oystehr; search: ReturnType<typeof vi.fn>; remove: typeof remove } => {
  const search = vi.fn(async () => searchPage(QUICK_PICKS));
  return { oystehr: { fhir: { search, delete: remove } } as unknown as Oystehr, search, remove };
};

describe('deleteImmunizationQuickPicks', () => {
  it('reads only immunization quick picks, of any status', async () => {
    const { oystehr, search } = makeOystehr();
    await deleteImmunizationQuickPicks(oystehr, true);
    const { resourceType, params } = search.mock.calls[0][0];
    expect(resourceType).toBe('ActivityDefinition');
    expect(params).toContainEqual({
      name: '_tag',
      value: `${QUICK_PICK_TAG_SYSTEM}|${IMMUNIZATION_QUICK_PICK_CATEGORY.tagCode}`,
    });
    expect(params.some((param: { name: string }) => param.name === 'status')).toBe(false);
  });

  it('deletes nothing on a dry run', async () => {
    const { oystehr, remove } = makeOystehr();
    const stats = await deleteImmunizationQuickPicks(oystehr, true);
    expect(remove).not.toHaveBeenCalled();
    expect(stats).toEqual({ quickPicks: 3, deleted: 3, failed: 0 });
  });

  it('deletes every immunization quick pick, the removed ones included', async () => {
    const { oystehr, remove } = makeOystehr();
    const stats = await deleteImmunizationQuickPicks(oystehr, false);
    expect(remove.mock.calls.map(([request]) => request)).toEqual([
      { resourceType: 'ActivityDefinition', id: 'qp-1' },
      { resourceType: 'ActivityDefinition', id: 'qp-2' },
      { resourceType: 'ActivityDefinition', id: 'qp-3' },
    ]);
    expect(stats).toEqual({ quickPicks: 3, deleted: 3, failed: 0 });
  });

  it('counts a failed delete and carries on', async () => {
    const remove = vi.fn(async ({ id }: DeleteRequest): Promise<void> => {
      if (id === 'qp-2') throw new Error('boom');
    });
    const { oystehr } = makeOystehr(remove);
    const stats = await deleteImmunizationQuickPicks(oystehr, false);
    expect(remove).toHaveBeenCalledTimes(3);
    expect(stats).toEqual({ quickPicks: 3, deleted: 2, failed: 1 });
  });
});
