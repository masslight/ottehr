import { Appointment, Encounter } from 'fhir/r4b';
import { APPOINTMENT_LOCKED_META_TAG, ENCOUNTER_LOCKED_META_TAG } from 'utils/lib/fhir/constants';
import { buildFollowupEncounterType, FollowupSubtype } from 'utils/lib/fhir/encounter';
import { CODE_SYSTEM_ACT_CODE_V3 } from 'utils/lib/helpers/rcm/constants';
import { NOTE_TYPE, NoteDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { TASK_INPUT_TYPE_CODES, TASK_INPUT_TYPE_SYSTEM, TaskIndicator } from 'utils/lib/types/common';
import { describe, expect, it } from 'vitest';
import { getChartDataPostChangeTasks } from '../../src/shared/chart-data/post-change-tasks';

type ChangedFields = Parameters<typeof getChartDataPostChangeTasks>[0];

const APPOINTMENT_ID = 'appt-111';
const ENCOUNTER_ID = 'enc-222';
const FOLLOWUP_ENCOUNTER_ID = 'enc-333';

const lockedAppointment: Appointment = {
  resourceType: 'Appointment',
  id: APPOINTMENT_ID,
  status: 'fulfilled',
  participant: [],
  meta: { tag: [APPOINTMENT_LOCKED_META_TAG] },
};

const unlockedAppointment: Appointment = { ...lockedAppointment, meta: { tag: [] } };

const finishedEncounter: Encounter = {
  resourceType: 'Encounter',
  id: ENCOUNTER_ID,
  status: 'finished',
  class: { system: CODE_SYSTEM_ACT_CODE_V3, code: 'AMB' },
};

const inProgressEncounter: Encounter = {
  ...finishedEncounter,
  status: 'in-progress',
};

const finishedFollowupEncounter = (subtype: FollowupSubtype, locked: boolean): Encounter => ({
  ...finishedEncounter,
  id: FOLLOWUP_ENCOUNTER_ID,
  type: buildFollowupEncounterType(subtype),
  appointment: [{ reference: `Appointment/${APPOINTMENT_ID}` }],
  ...(subtype === 'annotation' ? { partOf: { reference: `Encounter/${ENCOUNTER_ID}` } } : {}),
  ...(locked ? { meta: { tag: [ENCOUNTER_LOCKED_META_TAG] } } : {}),
});

const addendumNote = { text: 'Patient tolerated procedure well.' };

describe('getChartDataPostChangeTasks', () => {
  describe('visitNotePDFAndEmail task', () => {
    it('returns a Task when addendumNote is set on a finished, locked visit', () => {
      const tasks = getChartDataPostChangeTasks({ addendumNote }, finishedEncounter, lockedAppointment);

      expect(tasks).toHaveLength(1);
      const task = tasks[0];
      expect(task.resourceType).toBe('Task');
      expect(task.code?.coding?.[0].system).toBe(TaskIndicator.visitNotePDFAndEmail.system);
      expect(task.code?.coding?.[0].code).toBe(TaskIndicator.visitNotePDFAndEmail.code);
    });

    it('carries a SKIP_EMAIL input so the subscription handler does not send an email', () => {
      const tasks = getChartDataPostChangeTasks({ addendumNote }, finishedEncounter, lockedAppointment);
      const task = tasks[0];

      expect(task.input).toHaveLength(1);
      const input = task.input![0];
      expect(input.type.coding?.[0].system).toBe(TASK_INPUT_TYPE_SYSTEM);
      expect(input.type.coding?.[0].code).toBe(TASK_INPUT_TYPE_CODES.SKIP_EMAIL);
      expect(input.valueString).toBe('true');
    });

    it('sets focus to the correct Appointment reference', () => {
      const tasks = getChartDataPostChangeTasks({ addendumNote }, finishedEncounter, lockedAppointment);
      expect(tasks[0].focus?.reference).toBe(`Appointment/${APPOINTMENT_ID}`);
    });

    it('sets encounter to the correct Encounter reference', () => {
      const tasks = getChartDataPostChangeTasks({ addendumNote }, finishedEncounter, lockedAppointment);
      expect(tasks[0].encounter?.reference).toBe(`Encounter/${ENCOUNTER_ID}`);
    });

    it('returns no tasks when addendumNote is undefined', () => {
      const tasks = getChartDataPostChangeTasks({ addendumNote: undefined }, finishedEncounter, lockedAppointment);
      expect(tasks).toHaveLength(0);
    });

    it('returns no tasks when addendumNote is null (e.g. from unvalidated JSON body)', () => {
      const tasks = getChartDataPostChangeTasks(
        { addendumNote: null } as unknown as ChangedFields,
        finishedEncounter,
        lockedAppointment
      );
      expect(tasks).toHaveLength(0);
    });

    it('returns no tasks when encounter status is not finished', () => {
      const tasks = getChartDataPostChangeTasks({ addendumNote }, inProgressEncounter, lockedAppointment);
      expect(tasks).toHaveLength(0);
    });

    it('returns no tasks when the appointment is missing', () => {
      const tasks = getChartDataPostChangeTasks({ addendumNote }, finishedEncounter, undefined);
      expect(tasks).toHaveLength(0);
    });

    it('returns no tasks when a signed visit has been unlocked', () => {
      const tasks = getChartDataPostChangeTasks({ addendumNote }, finishedEncounter, unlockedAppointment);
      expect(tasks).toHaveLength(0);
    });
  });

  describe('annotation follow-up', () => {
    it('regenerates the follow-up note when the follow-up encounter is locked', () => {
      const tasks = getChartDataPostChangeTasks(
        { addendumNote },
        finishedFollowupEncounter('annotation', true),
        unlockedAppointment
      );
      expect(tasks).toHaveLength(1);
      expect(tasks[0].encounter?.reference).toBe(`Encounter/${FOLLOWUP_ENCOUNTER_ID}`);
    });

    it('returns no tasks when the follow-up is unlocked even though the parent visit is locked', () => {
      const tasks = getChartDataPostChangeTasks(
        { addendumNote },
        finishedFollowupEncounter('annotation', false),
        lockedAppointment
      );
      expect(tasks).toHaveLength(0);
    });
  });

  describe('scheduled follow-up', () => {
    it('regenerates the note when its own appointment is locked', () => {
      const tasks = getChartDataPostChangeTasks(
        { addendumNote },
        finishedFollowupEncounter('scheduled', false),
        lockedAppointment
      );
      expect(tasks).toHaveLength(1);
    });

    it('returns no tasks when its appointment is unlocked', () => {
      const tasks = getChartDataPostChangeTasks(
        { addendumNote },
        finishedFollowupEncounter('scheduled', true),
        unlockedAppointment
      );
      expect(tasks).toHaveLength(0);
    });
  });

  it('returns an empty array when no changed fields are set', () => {
    const tasks = getChartDataPostChangeTasks({}, finishedEncounter, lockedAppointment);
    expect(tasks).toHaveLength(0);
  });

  describe('addendum notes (NoteDTO[])', () => {
    const addendumNoteEntry: NoteDTO = {
      type: NOTE_TYPE.ADDENDUM,
      text: 'Late-arriving lab review',
      authorId: 'prac-1',
      authorName: 'Dr. Smith',
      patientId: 'pat-1',
      encounterId: ENCOUNTER_ID,
    };

    it('returns a regenerate task when an addendum-type note is included', () => {
      const tasks = getChartDataPostChangeTasks({ notes: [addendumNoteEntry] }, finishedEncounter, lockedAppointment);
      expect(tasks).toHaveLength(1);
    });

    it('ignores non-addendum note types', () => {
      const intakeNote: NoteDTO = { ...addendumNoteEntry, type: NOTE_TYPE.INTAKE };
      const tasks = getChartDataPostChangeTasks({ notes: [intakeNote] }, finishedEncounter, lockedAppointment);
      expect(tasks).toHaveLength(0);
    });

    it('still skips regeneration on in-progress encounters', () => {
      const tasks = getChartDataPostChangeTasks({ notes: [addendumNoteEntry] }, inProgressEncounter, lockedAppointment);
      expect(tasks).toHaveLength(0);
    });

    it('skips regeneration on an unlocked visit', () => {
      const tasks = getChartDataPostChangeTasks({ notes: [addendumNoteEntry] }, finishedEncounter, unlockedAppointment);
      expect(tasks).toHaveLength(0);
    });
  });
});
