import { Encounter, Task } from 'fhir/r4b';
import { getTaskResource, TaskIndicator } from 'utils';

interface ChangedFields {
  addendumNote?: unknown;
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
  if (changedFields.addendumNote !== undefined && encounter.status === 'finished' && appointmentId) {
    tasks.push(
      getTaskResource(TaskIndicator.visitNotePDFAndEmail, 'Regenerate visit note PDF', appointmentId, encounter.id)
    );
  }

  return tasks;
}
