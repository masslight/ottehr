import { Appointment, Encounter } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { APPOINTMENT_LOCKED_META_TAG, ENCOUNTER_LOCKED_META_TAG } from './constants';
import { buildFollowupEncounterType, FollowupSubtype } from './encounter';
import { isVisitChartLocked } from './visit-lock';

const appointment = (locked: boolean): Appointment => ({
  resourceType: 'Appointment',
  id: 'appt-1',
  status: 'fulfilled',
  participant: [],
  ...(locked ? { meta: { tag: [APPOINTMENT_LOCKED_META_TAG] } } : {}),
});

const encounter = (options: { subtype?: FollowupSubtype; locked?: boolean } = {}): Encounter => ({
  resourceType: 'Encounter',
  id: 'enc-1',
  status: 'finished',
  class: { code: 'AMB' },
  ...(options.subtype ? { type: buildFollowupEncounterType(options.subtype) } : {}),
  ...(options.locked ? { meta: { tag: [ENCOUNTER_LOCKED_META_TAG] } } : {}),
});

describe('isVisitChartLocked', () => {
  it('reads a main visit lock from its Appointment', () => {
    expect(isVisitChartLocked(encounter(), appointment(true))).toBe(true);
    expect(isVisitChartLocked(encounter({ locked: true }), appointment(false))).toBe(false);
  });

  it.each<FollowupSubtype>(['annotation', 'free-form'])('reads a %s follow-up lock from its Encounter', (subtype) => {
    expect(isVisitChartLocked(encounter({ subtype, locked: true }), appointment(false))).toBe(true);
    expect(isVisitChartLocked(encounter({ subtype }), appointment(true))).toBe(false);
    expect(isVisitChartLocked(encounter({ subtype, locked: true }), undefined)).toBe(true);
  });

  it('reads a scheduled follow-up lock from its Appointment', () => {
    expect(isVisitChartLocked(encounter({ subtype: 'scheduled' }), appointment(true))).toBe(true);
    expect(isVisitChartLocked(encounter({ subtype: 'scheduled', locked: true }), appointment(false))).toBe(false);
  });

  it('falls back to the Appointment when the encounter is missing', () => {
    expect(isVisitChartLocked(undefined, appointment(true))).toBe(true);
    expect(isVisitChartLocked(undefined, undefined)).toBe(false);
  });

  it('is unlocked when a main visit has no Appointment', () => {
    expect(isVisitChartLocked(encounter(), undefined)).toBe(false);
  });
});
