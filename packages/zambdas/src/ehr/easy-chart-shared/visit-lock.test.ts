import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter } from 'fhir/r4b';
import { EASY_CHART_VISIT_LOCKED_MESSAGE } from 'utils/lib/easy-chart/access';
import { APPOINTMENT_LOCKED_META_TAG, ENCOUNTER_LOCKED_META_TAG } from 'utils/lib/fhir/constants';
import { FOLLOWUP_SYSTEMS } from 'utils/lib/fhir/encounter';
import { describe, expect, it } from 'vitest';
import { assertVisitIsEditable, isVisitLocked } from './visit-lock';

/** An Oystehr client whose Encounter search returns exactly these resources. */
const oystehrReturning = (...resources: (Encounter | Appointment)[]): Oystehr =>
  ({ fhir: { search: async () => ({ unbundle: () => resources }) } }) as unknown as Oystehr;

const appointment = (locked: boolean): Appointment => ({
  resourceType: 'Appointment',
  id: 'appt-1',
  status: 'fulfilled',
  participant: [],
  ...(locked ? { meta: { tag: [APPOINTMENT_LOCKED_META_TAG] } } : {}),
});

const encounter = (options: { followup?: boolean; locked?: boolean } = {}): Encounter => ({
  resourceType: 'Encounter',
  id: 'enc-1',
  status: 'in-progress',
  class: { code: 'AMB' },
  ...(options.followup
    ? { type: [{ coding: [{ system: FOLLOWUP_SYSTEMS.type.url, code: FOLLOWUP_SYSTEMS.type.code }] }] }
    : {}),
  ...(options.locked ? { meta: { tag: [ENCOUNTER_LOCKED_META_TAG] } } : {}),
});

describe('isVisitLocked', () => {
  it('reads a regular visit lock from its Appointment', async () => {
    expect(await isVisitLocked(oystehrReturning(encounter(), appointment(true)), 'enc-1')).toBe(true);
    expect(await isVisitLocked(oystehrReturning(encounter(), appointment(false)), 'enc-1')).toBe(false);
  });

  it('ignores an Encounter lock tag on a regular visit, as the EHR does', async () => {
    expect(await isVisitLocked(oystehrReturning(encounter({ locked: true }), appointment(false)), 'enc-1')).toBe(false);
  });

  it('reads an annotation follow-up lock from its Encounter', async () => {
    expect(await isVisitLocked(oystehrReturning(encounter({ followup: true, locked: true })), 'enc-1')).toBe(true);
    expect(await isVisitLocked(oystehrReturning(encounter({ followup: true })), 'enc-1')).toBe(false);
  });

  it('refuses an unknown encounter', async () => {
    await expect(isVisitLocked(oystehrReturning(), 'enc-1')).rejects.toMatchObject({
      message: 'The visit could not be found',
    });
  });
});

describe('assertVisitIsEditable', () => {
  it('throws for a locked visit and passes an open one', async () => {
    await expect(
      assertVisitIsEditable(oystehrReturning(encounter(), appointment(true)), 'enc-1', 'test')
    ).rejects.toMatchObject({ message: EASY_CHART_VISIT_LOCKED_MESSAGE });
    await expect(
      assertVisitIsEditable(oystehrReturning(encounter(), appointment(false)), 'enc-1', 'test')
    ).resolves.toBeUndefined();
  });
});
