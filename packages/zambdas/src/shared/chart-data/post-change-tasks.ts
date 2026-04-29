import { Encounter, Task } from 'fhir/r4b';
import { FreeTextNoteDTO, getTaskResource, TASK_INPUT_TYPE_CODES, TASK_INPUT_TYPE_SYSTEM, TaskIndicator } from 'utils';

interface ChangedFields {
  addendumNote?: FreeTextNoteDTO;
}

/**
 * Returns the Tasks that should be created after chart data is saved or deleted.
 * Both save-chart-data and delete-chart-data call this after committing their transaction.
 *
 * To add a new post-change side effect, add a block here — no changes to the callers needed.
 */
export function getChartDataPostChangeTasks(
  changedFields: ChangedFields,
  encounter: Encounter,
  appointmentId: string | undefined
): Task[] {
  const tasks: Task[] = [];

  // Regenerate the visit note PDF when the addendum changes on an already-signed visit.
  // The SKIP_EMAIL input tells the subscription handler to skip the patient completion email
  // (this is a re-generation, not the initial post-signing send).
  if (changedFields.addendumNote !== undefined && encounter.status === 'finished' && appointmentId) {
    tasks.push({
      ...getTaskResource(TaskIndicator.visitNotePDFAndEmail, 'Regenerate visit note PDF', appointmentId, encounter.id),
      input: [
        {
          type: {
            coding: [{ system: TASK_INPUT_TYPE_SYSTEM, code: TASK_INPUT_TYPE_CODES.SKIP_EMAIL }],
          },
          valueString: 'true',
        },
      ],
    });
  }

  return tasks;
}
