import { applyPatch, deepClone } from 'fast-json-patch';
import { Encounter } from 'fhir/r4b';
import { ENCOUNTER_LOCKED_META_TAG } from 'utils/lib/fhir/constants';
import { buildFollowupEncounterType } from 'utils/lib/fhir/encounter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCompletedFollowupEncounterPatchOps } from '../../src/ehr/sign-appointment/helpers';

const SIGNED_AT = '2026-11-11T15:30:00.000Z';

const followup = (overrides: Partial<Encounter> = {}): Encounter => ({
  resourceType: 'Encounter',
  id: 'followup-1',
  status: 'in-progress',
  class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'VR' },
  type: buildFollowupEncounterType('annotation'),
  partOf: { reference: 'Encounter/visit-1' },
  period: { start: '2026-11-10T09:00:00.000Z' },
  ...overrides,
});

const complete = (encounter: Encounter): Encounter =>
  applyPatch(deepClone(encounter), getCompletedFollowupEncounterPatchOps(encounter)).newDocument;

describe('getCompletedFollowupEncounterPatchOps', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(SIGNED_AT));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('finishes and locks the follow-up and closes its period at the signing time', () => {
    const completed = complete(followup());

    expect(completed.status).toBe('finished');
    expect(completed.period).toEqual({ start: '2026-11-10T09:00:00.000Z', end: SIGNED_AT });
    expect(completed.statusHistory?.at(-1)).toMatchObject({ status: 'finished', period: { start: SIGNED_AT } });
    expect(completed.meta?.tag).toContainEqual(ENCOUNTER_LOCKED_META_TAG);
  });

  it('moves the period end to the new signing time when an unlocked follow-up is signed again', () => {
    const completed = complete(
      followup({ status: 'finished', period: { start: '2026-11-10T09:00:00.000Z', end: '2026-11-10T10:00:00.000Z' } })
    );

    expect(completed.period).toEqual({ start: '2026-11-10T09:00:00.000Z', end: SIGNED_AT });
  });

  it('adds a period ending at the signing time to a follow-up that has none', () => {
    const completed = complete(followup({ period: undefined }));

    expect(completed.period).toEqual({ end: SIGNED_AT });
  });
});
