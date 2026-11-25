import Oystehr from '@oystehr/sdk';
import { ActivityDefinition } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QUICK_PICK_CONFIG_EXTENSION_URL } from '../../src/ehr/shared/quick-pick-helpers';

const { getAllFhirSearchPages } = vi.hoisted(() => ({ getAllFhirSearchPages: vi.fn() }));
vi.mock('utils/lib/fhir/getAllFhirSearchPages', () => ({ getAllFhirSearchPages }));

import { deleteImmunizationQuickPicks } from '../../src/scripts/delete-immunization-quick-picks.helpers';

const quickPick = (
  id: string,
  vaccine?: { id: string; name: string },
  status: ActivityDefinition['status'] = 'active'
): ActivityDefinition => ({
  resourceType: 'ActivityDefinition',
  id,
  status,
  title: `Quick pick ${id}`,
  extension: [{ url: QUICK_PICK_CONFIG_EXTENSION_URL, valueString: JSON.stringify({ vaccine, dose: '0.5' }) }],
});

const LEGACY = quickPick('legacy', { id: 'config-medication-tdap', name: 'Tdap (Adacel/Boostrix)' });
const LEGACY_REMOVED = quickPick('legacy-removed', { id: 'config-medication-td', name: 'Td' }, 'retired');
const ON_CVX = quickPick('on-cvx', { id: '115', name: 'Tdap' });
const NO_VACCINE = quickPick('no-vaccine');

const mockOystehr = (): { oystehr: Oystehr; del: ReturnType<typeof vi.fn> } => {
  const del = vi.fn().mockResolvedValue(undefined);
  return { oystehr: { fhir: { delete: del } } as unknown as Oystehr, del };
};

describe('deleteImmunizationQuickPicks', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getAllFhirSearchPages.mockResolvedValue([LEGACY, ON_CVX, LEGACY_REMOVED, NO_VACCINE]);
  });

  it('searches only immunization quick picks, removed ones included', async () => {
    await deleteImmunizationQuickPicks(mockOystehr().oystehr, true);

    expect(getAllFhirSearchPages).toHaveBeenCalledWith(
      {
        resourceType: 'ActivityDefinition',
        params: [
          { name: '_tag', value: 'https://fhir.ottehr.com/CodeSystem/quick-pick-category|immunization-quick-pick' },
        ],
      },
      expect.anything()
    );
  });

  it('deletes nothing on a dry run', async () => {
    const { oystehr, del } = mockOystehr();

    expect(await deleteImmunizationQuickPicks(oystehr, true)).toEqual({
      found: 4,
      kept: 2,
      unreadable: 0,
      deleted: 0,
      failed: 0,
    });
    expect(del).not.toHaveBeenCalled();
  });

  it('deletes the quick picks saved against a vaccine that is not in the CVX list', async () => {
    const { oystehr, del } = mockOystehr();

    expect(await deleteImmunizationQuickPicks(oystehr, false)).toEqual({
      found: 4,
      kept: 2,
      unreadable: 0,
      deleted: 2,
      failed: 0,
    });
    expect(del.mock.calls).toEqual([
      [{ resourceType: 'ActivityDefinition', id: 'legacy' }],
      [{ resourceType: 'ActivityDefinition', id: 'legacy-removed' }],
    ]);
  });

  it('leaves a quick pick whose config cannot be read and counts it as unreadable', async () => {
    const { oystehr, del } = mockOystehr();
    getAllFhirSearchPages.mockResolvedValue([
      { ...LEGACY, id: 'broken', extension: [{ url: QUICK_PICK_CONFIG_EXTENSION_URL, valueString: '{' }] },
      LEGACY,
    ]);

    expect(await deleteImmunizationQuickPicks(oystehr, false)).toEqual({
      found: 2,
      kept: 0,
      unreadable: 1,
      deleted: 1,
      failed: 0,
    });
    expect(del.mock.calls).toEqual([[{ resourceType: 'ActivityDefinition', id: 'legacy' }]]);
  });

  it('counts the quick picks that fail to delete', async () => {
    const { oystehr, del } = mockOystehr();
    del.mockRejectedValueOnce(new Error('boom'));

    expect(await deleteImmunizationQuickPicks(oystehr, false)).toEqual({
      found: 4,
      kept: 2,
      unreadable: 0,
      deleted: 1,
      failed: 1,
    });
  });
});
