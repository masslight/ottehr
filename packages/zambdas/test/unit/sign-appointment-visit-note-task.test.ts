import { TASK_INPUT_TYPE_CODES, TASK_INPUT_TYPE_SYSTEM, TaskIndicator } from 'utils';
import { describe, expect, it } from 'vitest';
import { getVisitNoteTask } from '../../src/ehr/sign-appointment/index';

const PATIENT_NAME = 'Jane Doe';
const APPOINTMENT_ID = 'appt-111';

describe('getVisitNoteTask', () => {
  it('builds a visitNotePDFAndEmail task focused on the appointment', () => {
    const task = getVisitNoteTask(PATIENT_NAME, APPOINTMENT_ID, false);

    expect(task.resourceType).toBe('Task');
    expect(task.code?.coding?.[0].system).toBe(TaskIndicator.visitNotePDFAndEmail.system);
    expect(task.code?.coding?.[0].code).toBe(TaskIndicator.visitNotePDFAndEmail.code);
    expect(task.focus?.reference).toBe(`Appointment/${APPOINTMENT_ID}`);
  });

  describe('when this is not a supervisor approval', () => {
    it('uses the "Create visit note" description and carries no SKIP_EMAIL input, so the email is sent', () => {
      const task = getVisitNoteTask(PATIENT_NAME, APPOINTMENT_ID, false);

      expect(task.description).toBe(`Create visit note for ${PATIENT_NAME}`);
      expect(task.input).toBeUndefined();
    });
  });

  describe('when this is a supervisor approval', () => {
    it('uses the "Regenerate visit note" description', () => {
      const task = getVisitNoteTask(PATIENT_NAME, APPOINTMENT_ID, true);

      expect(task.description).toBe(`Regenerate visit note for ${PATIENT_NAME}`);
    });

    it('carries a SKIP_EMAIL input so the subscription handler regenerates the PDF but skips the email', () => {
      const task = getVisitNoteTask(PATIENT_NAME, APPOINTMENT_ID, true);

      expect(task.input).toHaveLength(1);
      const input = task.input![0];
      expect(input.type.coding?.[0].system).toBe(TASK_INPUT_TYPE_SYSTEM);
      expect(input.type.coding?.[0].code).toBe(TASK_INPUT_TYPE_CODES.SKIP_EMAIL);
      expect(input.valueString).toBe('true');
    });
  });
});
