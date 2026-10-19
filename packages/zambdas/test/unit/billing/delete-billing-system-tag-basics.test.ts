import Oystehr from '@oystehr/sdk';
import { Basic } from 'fhir/r4b';
import {
  AUTO_ACCIDENT_TAG_NAME,
  HOLD_TAG_NAME,
  SECONDARY_SUBMISSION_CROSSOVER_TAG_NAME,
  SECONDARY_SUBMISSION_TAG_NAME,
} from 'utils/lib/types/data/billing/system-tags';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TAG_CODE_SYSTEM } from '../../../src/billing/shared';
import {
  deleteTagBasics,
  describeSystemTagBasicCleanupPlan,
  planSystemTagBasicCleanup,
} from '../../../src/scripts/delete-billing-system-tag-basics.helpers';

const tagBasic = (id: string, name: string): Basic => ({
  resourceType: 'Basic',
  id,
  code: {
    text: name,
    coding: [
      {
        system: TAG_CODE_SYSTEM,
        code: 'tag',
      },
    ],
  },
});

const deletedNames = (plan: ReturnType<typeof planSystemTagBasicCleanup>): string[] =>
  plan.deletions.map((ref) => ref.name);

describe('planSystemTagBasicCleanup', () => {
  it('deletes every stored definition of a system-managed tag', () => {
    const plan = planSystemTagBasicCleanup([
      tagBasic('aa-1', AUTO_ACCIDENT_TAG_NAME),
      tagBasic('aa-2', AUTO_ACCIDENT_TAG_NAME),
      tagBasic('aa-3', AUTO_ACCIDENT_TAG_NAME),
      tagBasic('hold-1', HOLD_TAG_NAME),
      tagBasic('ss-1', SECONDARY_SUBMISSION_TAG_NAME),
      tagBasic('cross-1', SECONDARY_SUBMISSION_CROSSOVER_TAG_NAME),
    ]);

    expect(plan.deletions.map((ref) => ref.id)).toEqual(['aa-1', 'aa-2', 'aa-3', 'hold-1', 'ss-1', 'cross-1']);
    expect(plan.deletionsByName.get(AUTO_ACCIDENT_TAG_NAME)).toBe(3);
    expect(plan.deletionsByName.get(HOLD_TAG_NAME)).toBe(1);
    expect(plan.userTagCount).toBe(0);
  });

  it('never deletes a user-created tag', () => {
    const plan = planSystemTagBasicCleanup([
      tagBasic('tag-1', 'customTag'),
      tagBasic('tag-2', 'submitted-via-claim.md'),
      tagBasic('hold-1', HOLD_TAG_NAME),
    ]);

    expect(deletedNames(plan)).toEqual([HOLD_TAG_NAME]);
    expect(plan.userTagCount).toBe(2);
    expect(plan.userDuplicates).toEqual([]);
  });

  it('reports duplicated user tags without deleting them', () => {
    const plan = planSystemTagBasicCleanup([
      tagBasic('tag-1', 'customTag'),
      tagBasic('tag-2', 'customTag'),
      tagBasic('tag-3', 'reviewed'),
    ]);

    expect(plan.deletions).toEqual([]);
    expect(plan.userDuplicates).toEqual([
      {
        name: 'customTag',
        ids: ['tag-1', 'tag-2'],
      },
    ]);
  });

  // A pre-rename "auto-accident" is an ordinary editable tag now and may still be on claims, so
  // deleting it is a human call rather than this script's.
  it('reports a name that only resembles a system-managed one instead of deleting it', () => {
    const plan = planSystemTagBasicCleanup([
      tagBasic('aa-old', 'auto-accident'),
      tagBasic('aa-1', AUTO_ACCIDENT_TAG_NAME),
    ]);

    expect(deletedNames(plan)).toEqual([AUTO_ACCIDENT_TAG_NAME]);
    expect(plan.nearMisses).toEqual([
      {
        id: 'aa-old',
        name: 'auto-accident',
      },
    ]);
    // A near miss is not counted as an ordinary user tag either — it needs review.
    expect(plan.userTagCount).toBe(0);
  });

  // Tag identity is the exact name, so a lowercase "hold" is an ordinary editable tag that may be
  // on claims — it gets reported for review, not deleted out from under whoever is using it.
  it('reports a case variant of a system name rather than deleting it', () => {
    const plan = planSystemTagBasicCleanup([tagBasic('hold-1', 'hold')]);

    expect(plan.deletions).toEqual([]);
    expect(plan.nearMisses.map((ref) => ref.name)).toEqual(['hold']);
  });

  it('skips definitions with no id or no name', () => {
    const noId: Basic = {
      resourceType: 'Basic',
      code: {
        text: HOLD_TAG_NAME,
      },
    };
    const noName: Basic = {
      resourceType: 'Basic',
      id: 'nameless',
      code: {
        coding: [
          {
            system: TAG_CODE_SYSTEM,
            code: 'tag',
          },
        ],
      },
    };

    const plan = planSystemTagBasicCleanup([noId, noName]);

    expect(plan.deletions).toEqual([]);
    expect(plan.userTagCount).toBe(0);
  });

  it('is a no-op for an environment already at baseline', () => {
    const plan = planSystemTagBasicCleanup([tagBasic('tag-1', 'customTag')]);

    expect(plan.deletions).toEqual([]);
    expect(describeSystemTagBasicCleanupPlan(plan)).toContain('already at baseline');
  });
});

describe('deleteTagBasics', () => {
  const transaction = vi.fn();
  const oystehr = {
    fhir: {
      transaction,
    },
  } as unknown as Oystehr;

  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockResolvedValue({ entry: [] });
  });

  it('deletes each definition by id in one transaction', async () => {
    const refs = [
      {
        id: 'aa-1',
        name: AUTO_ACCIDENT_TAG_NAME,
      },
      {
        id: 'hold-1',
        name: HOLD_TAG_NAME,
      },
    ];

    await expect(deleteTagBasics(oystehr, refs)).resolves.toBe(2);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction.mock.calls[0][0].requests).toEqual([
      {
        method: 'DELETE',
        url: 'Basic/aa-1',
      },
      {
        method: 'DELETE',
        url: 'Basic/hold-1',
      },
    ]);
  });

  it('chunks large deletions', async () => {
    const refs = Array.from({ length: 250 }, (_, i) => ({
      id: `tag-${i}`,
      name: HOLD_TAG_NAME,
    }));

    await expect(deleteTagBasics(oystehr, refs)).resolves.toBe(250);
    expect(transaction).toHaveBeenCalledTimes(3);
  });

  // One bad chunk must not abandon the rest of the cleanup; the caller reports the shortfall.
  it('continues past a failed chunk and reports the count actually deleted', async () => {
    const refs = Array.from({ length: 150 }, (_, i) => ({
      id: `tag-${i}`,
      name: HOLD_TAG_NAME,
    }));
    transaction.mockRejectedValueOnce(new Error('FHIR is down')).mockResolvedValue({ entry: [] });

    await expect(deleteTagBasics(oystehr, refs)).resolves.toBe(50);
    expect(transaction).toHaveBeenCalledTimes(2);
  });
});
