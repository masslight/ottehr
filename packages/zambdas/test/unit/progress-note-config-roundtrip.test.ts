import Oystehr from '@oystehr/sdk';
import { Basic } from 'fhir/r4b';
import {
  DEFAULT_PROGRESS_NOTE_CONFIG,
  PROGRESS_NOTE_CONFIG_VITALS_UNIT_INPUT_ORDER_EXTENSION_URL,
  ProgressNoteConfig,
} from 'utils';
import { describe, expect, test, vi } from 'vitest';
import { getProgressNoteConfigPayload, saveProgressNoteConfig } from '../../src/shared/progress-note-config';

const makeOystehr = (overrides: {
  search?: Basic[];
  existing?: Basic;
}): { oystehr: Oystehr; create: any; update: any } => {
  const create = vi.fn(async (resource: Basic) => resource);
  const update = vi.fn(async (resource: Basic) => resource);
  const results = overrides.existing ? [overrides.existing] : overrides.search ?? [];
  const oystehr = {
    fhir: {
      search: vi.fn(async () => ({ unbundle: () => results })),
      create,
      update,
    },
  } as unknown as Oystehr;
  return { oystehr, create, update };
};

const customConfig: ProgressNoteConfig = {
  mdmRequired: false,
  medicalDecisionDefaultText: 'Custom MDM text.',
  pcpNoTypeDispositionDefaultText: 'Custom PCP text.',
  anotherDispositionDefaultText: 'Custom transfer text.',
  edDispositionDefaultText: 'Custom ED text.',
  vitalsUnitInputOrder: 'imperial-metric',
};

describe('progress-note-config shared read/write', () => {
  test('save then read round-trips every field, including vitalsUnitInputOrder', async () => {
    const { oystehr: saveClient, create } = makeOystehr({ search: [] });
    await saveProgressNoteConfig(saveClient, customConfig);

    // The Basic that would have been persisted.
    const persisted = create.mock.calls[0][0] as Basic;

    const { oystehr: readClient } = makeOystehr({ search: [persisted] });
    const readBack = await getProgressNoteConfigPayload(readClient);

    expect(readBack).toEqual(customConfig);
  });

  test('read returns defaults (incl. vitalsUnitInputOrder) when no config Basic exists', async () => {
    const { oystehr } = makeOystehr({ search: [] });
    const result = await getProgressNoteConfigPayload(oystehr);
    expect(result).toEqual(DEFAULT_PROGRESS_NOTE_CONFIG);
  });

  test('read falls back to the default order when the stored value is not a valid option', async () => {
    const basic: Basic = {
      resourceType: 'Basic',
      code: {},
      extension: [{ url: PROGRESS_NOTE_CONFIG_VITALS_UNIT_INPUT_ORDER_EXTENSION_URL, valueString: 'sideways' }],
    };
    const { oystehr } = makeOystehr({ search: [basic] });
    const result = await getProgressNoteConfigPayload(oystehr);
    expect(result.vitalsUnitInputOrder).toBe(DEFAULT_PROGRESS_NOTE_CONFIG.vitalsUnitInputOrder);
  });

  test('save creates a new Basic with the vitals extension when none exists', async () => {
    const { oystehr, create, update } = makeOystehr({ search: [] });
    await saveProgressNoteConfig(oystehr, customConfig);

    expect(create).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
    const persisted = create.mock.calls[0][0] as Basic;
    expect(persisted.extension).toContainEqual({
      url: PROGRESS_NOTE_CONFIG_VITALS_UNIT_INPUT_ORDER_EXTENSION_URL,
      valueString: 'imperial-metric',
    });
  });

  test('save updates the existing Basic with optimistic locking instead of creating', async () => {
    const existing: Basic = {
      resourceType: 'Basic',
      id: 'config-1',
      code: {},
      meta: { versionId: '7' },
    };
    const { oystehr, create, update } = makeOystehr({ existing });
    await saveProgressNoteConfig(oystehr, customConfig);

    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toMatchObject({ id: 'config-1' });
    expect(update.mock.calls[0][1]).toEqual({ optimisticLockingVersionId: '7' });
  });
});
