import { Encounter } from 'fhir/r4b';
import { TaskIndicator } from 'utils';
import { describe, expect, it } from 'vitest';
import { getChartDataPostChangeTasks } from '../../src/shared/chart-data/post-change-tasks';

const APPOINTMENT_ID = 'appt-111';
const ENCOUNTER_ID = 'enc-222';

const finishedEncounter: Encounter = {
  resourceType: 'Encounter',
  id: ENCOUNTER_ID,
  status: 'finished',
  class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
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
});
