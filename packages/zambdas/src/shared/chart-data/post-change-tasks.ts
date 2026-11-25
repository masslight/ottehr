import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/node-core/light';
import { Appointment, Encounter, Task } from 'fhir/r4b';
import { getSkipEmailTaskInput, getTaskResource } from 'utils/lib/fhir/helpers';
import { isVisitChartLocked } from 'utils/lib/fhir/visit-lock';
import { FreeTextNoteDTO, NOTE_TYPE, NoteDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { TaskIndicator } from 'utils/lib/types/common';

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
  appointment: Appointment | undefined
): Task[] {
  const tasks: Task[] = [];

  // The SKIP_EMAIL input tells the subscription handler to skip the patient completion email
  // (this is a re-generation, not the initial post-signing send).
  if (
    hasAddendumNoteChange(changedFields) &&
    encounter.status === 'finished' &&
    appointment?.id &&
    isVisitChartLocked(encounter, appointment)
  ) {
    tasks.push({
      ...getTaskResource(TaskIndicator.visitNotePDFAndEmail, 'Regenerate visit note PDF', appointment.id, encounter.id),
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
  appointment: Appointment | undefined
): Promise<void> {
  const postChangeTasks = getChartDataPostChangeTasks({ addendumNote, notes }, encounter, appointment);
  if (postChangeTasks.length === 0) return;

  const results = await Promise.allSettled(postChangeTasks.map((task) => oystehr.fhir.create(task)));
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  for (const failure of failures) {
    console.error('Failed to create post-change task; primary chart-data operation succeeded:', failure.reason);
    captureException(failure.reason);
  }
}
