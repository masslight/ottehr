import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { Encounter, Task } from 'fhir/r4b';
import { FreeTextNoteDTO, getSkipEmailTaskInput, getTaskResource, NOTE_TYPE, NoteDTO, TaskIndicator } from 'utils';

interface ChangedFields {
  addendumNote?: FreeTextNoteDTO;
  notes?: NoteDTO[];
}

const hasAddendumNoteChange = (changedFields: ChangedFields): boolean => {
  if (changedFields.addendumNote) return true;
  return !!changedFields.notes?.some((n) => n.type === NOTE_TYPE.ADDENDUM);
};

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
  if (hasAddendumNoteChange(changedFields) && encounter.status === 'finished' && appointmentId) {
    tasks.push({
      ...getTaskResource(TaskIndicator.visitNotePDFAndEmail, 'Regenerate visit note PDF', appointmentId, encounter.id),
      input: [getSkipEmailTaskInput()],
    });
  }

  return tasks;
}

export async function runChartDataPostChangeTasks(
  oystehr: Oystehr,
  addendumNote: FreeTextNoteDTO | undefined,
  notes: NoteDTO[] | undefined,
  encounter: Encounter,
  appointmentId: string | undefined
): Promise<void> {
  const postChangeTasks = getChartDataPostChangeTasks({ addendumNote, notes }, encounter, appointmentId);
  if (postChangeTasks.length === 0) return;

  const results = await Promise.allSettled(postChangeTasks.map((task) => oystehr.fhir.create(task)));
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  for (const failure of failures) {
    console.error('Failed to create post-change task; primary chart-data operation succeeded:', failure.reason);
    captureException(failure.reason);
  }
}
