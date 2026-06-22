import { Encounter } from 'fhir/r4b';
import {
  CODE_SYSTEM_ACT_CODE_V3,
  NOTE_TYPE,
  NoteDTO,
  TASK_INPUT_TYPE_CODES,
  TASK_INPUT_TYPE_SYSTEM,
  TaskIndicator,
} from 'utils';
import { describe, expect, it } from 'vitest';
import { getChartDataPostChangeTasks } from '../../src/shared/chart-data/post-change-tasks';

type ChangedFields = Parameters<typeof getChartDataPostChangeTasks>[0];

const APPOINTMENT_ID = 'appt-111';
const ENCOUNTER_ID = 'enc-222';

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

const addendumNote = { text: 'Patient tolerated procedure well.' };

describe('getChartDataPostChangeTasks', () => {
  describe('visitNotePDFAndEmail task', () => {
    it('returns a Task when addendumNote is set on a finished encounter with an appointmentId', () => {
      const tasks = getChartDataPostChangeTasks({ addendumNote }, finishedEncounter, APPOINTMENT_ID);

      expect(tasks).toHaveLength(1);
      const task = tasks[0];
      expect(task.resourceType).toBe('Task');
      expect(task.code?.coding?.[0].system).toBe(TaskIndicator.visitNotePDFAndEmail.system);
      expect(task.code?.coding?.[0].code).toBe(TaskIndicator.visitNotePDFAndEmail.code);
    });

    it('carries a SKIP_EMAIL input so the subscription handler does not send an email', () => {
      const tasks = getChartDataPostChangeTasks({ addendumNote }, finishedEncounter, APPOINTMENT_ID);
      const task = tasks[0];

      expect(task.input).toHaveLength(1);
      const input = task.input![0];
      expect(input.type.coding?.[0].system).toBe(TASK_INPUT_TYPE_SYSTEM);
      expect(input.type.coding?.[0].code).toBe(TASK_INPUT_TYPE_CODES.SKIP_EMAIL);
      expect(input.valueString).toBe('true');
    });

    it('sets focus to the correct Appointment reference', () => {
      const tasks = getChartDataPostChangeTasks({ addendumNote }, finishedEncounter, APPOINTMENT_ID);
      expect(tasks[0].focus?.reference).toBe(`Appointment/${APPOINTMENT_ID}`);
    });

    it('sets encounter to the correct Encounter reference', () => {
      const tasks = getChartDataPostChangeTasks({ addendumNote }, finishedEncounter, APPOINTMENT_ID);
      expect(tasks[0].encounter?.reference).toBe(`Encounter/${ENCOUNTER_ID}`);
    });

    it('returns no tasks when addendumNote is undefined', () => {
      const tasks = getChartDataPostChangeTasks({ addendumNote: undefined }, finishedEncounter, APPOINTMENT_ID);
      expect(tasks).toHaveLength(0);
    });

    it('returns no tasks when addendumNote is null (e.g. from unvalidated JSON body)', () => {
      const tasks = getChartDataPostChangeTasks(
        { addendumNote: null } as unknown as ChangedFields,
        finishedEncounter,
        APPOINTMENT_ID
      );
      expect(tasks).toHaveLength(0);
    });

    it('returns no tasks when encounter status is not finished', () => {
      const tasks = getChartDataPostChangeTasks({ addendumNote }, inProgressEncounter, APPOINTMENT_ID);
      expect(tasks).toHaveLength(0);
    });

    it('returns no tasks when appointmentId is undefined', () => {
      const tasks = getChartDataPostChangeTasks({ addendumNote }, finishedEncounter, undefined);
      expect(tasks).toHaveLength(0);
    });
  });

  it('returns an empty array when no changed fields are set', () => {
    const tasks = getChartDataPostChangeTasks({}, finishedEncounter, APPOINTMENT_ID);
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
      const tasks = getChartDataPostChangeTasks({ notes: [addendumNoteEntry] }, finishedEncounter, APPOINTMENT_ID);
      expect(tasks).toHaveLength(1);
    });

    it('ignores non-addendum note types', () => {
      const intakeNote: NoteDTO = { ...addendumNoteEntry, type: NOTE_TYPE.INTAKE };
      const tasks = getChartDataPostChangeTasks({ notes: [intakeNote] }, finishedEncounter, APPOINTMENT_ID);
      expect(tasks).toHaveLength(0);
    });

    it('still skips regeneration on in-progress encounters', () => {
      const tasks = getChartDataPostChangeTasks({ notes: [addendumNoteEntry] }, inProgressEncounter, APPOINTMENT_ID);
      expect(tasks).toHaveLength(0);
    });
  });
});
