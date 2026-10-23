import Oystehr from '@oystehr/sdk';
import { Communication, FhirResource, Practitioner, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { getPatchBinary, getPatchOperationForNewMetaTag } from 'utils/lib/fhir/resourcePatch';
import { GetPatientNotesOutput, SavePatientNoteOutput } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { TASK_NOTE_NOTIFIED_TAG_CODE, TASK_NOTE_NOTIFIED_TAG_SYSTEM } from 'utils/lib/types/api/practitioner.types';
import { MANUAL_TASK } from 'utils/lib/types/data/tasks/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getRecentTaskNotes } from '../../src/cron/notifications-updater';
import { NOTE_EDITOR_EXTENSION_URL, TASK_NOTE_READ_BY_TAG_SYSTEM, TASK_NOTE_TAG } from '../../src/shared/notes';
import { createTask } from '../../src/shared/tasks';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// A task with an earlier note by a colleague and a new one by the caller, written through the notes zambdas, then the
// cron's note search over them. Everything created is removed afterwards.
describe('task notes integration', () => {
  const [TASK_NOTE_SYSTEM, TASK_NOTE_CODE] = TASK_NOTE_TAG.split('|');
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let callerId: string;
  let colleague: Practitioner;
  let task: Task;
  let colleagueNote: Communication;
  let callerNoteId: string | undefined;

  const tagged = <T extends FhirResource>(resource: T, processId: string): T =>
    addProcessIdMetaTagToResource(resource, processId) as T;
  const getNotes = async (): Promise<GetPatientNotesOutput> =>
    (await oystehrZambdas.zambda.execute({ id: 'get-patient-notes', taskIds: [task.id] }))
      .output as GetPatientNotesOutput;
  const readNote = (id: string): Promise<Communication> =>
    oystehrAdmin.fhir.get<Communication>({ resourceType: 'Communication', id });

  beforeAll(async () => {
    const setup = await setupIntegrationTest('task-notes.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    [, callerId] = setup.testUserM2MProfile.split('/');
    colleague = await oystehrAdmin.fhir.create<Practitioner>(
      tagged({ resourceType: 'Practitioner', name: [{ given: ['Lina'], family: 'Grace' }] }, setup.processId)
    );
    task = await oystehrAdmin.fhir.create<Task>(
      tagged(createTask({ category: MANUAL_TASK.category.patientFollowUp, title: 'Task notes test' }), setup.processId)
    );
    // Written before the cron's window, so its search can only reach it through the task.
    colleagueNote = await oystehrAdmin.fhir.create<Communication>(
      tagged(
        {
          resourceType: 'Communication',
          status: 'completed',
          meta: { tag: [{ system: TASK_NOTE_SYSTEM, code: TASK_NOTE_CODE }] },
          basedOn: [{ reference: `Task/${task.id}` }],
          sender: { reference: `Practitioner/${colleague.id}`, display: 'Lina Grace' },
          sent: DateTime.utc().minus({ hours: 2 }).toISO()!,
          payload: [{ contentString: 'Left a voicemail' }],
        },
        setup.processId
      )
    );
  }, 60_000);

  afterAll(async () => {
    for (const del of [
      () => (callerNoteId ? oystehrAdmin.fhir.delete({ resourceType: 'Communication', id: callerNoteId }) : undefined),
      () => oystehrAdmin.fhir.delete({ resourceType: 'Communication', id: colleagueNote.id! }),
      () => oystehrAdmin.fhir.delete({ resourceType: 'Task', id: task.id! }),
      () => oystehrAdmin.fhir.delete({ resourceType: 'Practitioner', id: colleague.id! }),
    ]) {
      try {
        await del();
      } catch {
        // best-effort
      }
    }
    await cleanup();
  });

  it("lists the task's notes newest first, unread only where someone else wrote them", async () => {
    const created = await oystehrZambdas.zambda.execute({
      id: 'create-patient-note',
      note: { taskId: task.id, text: 'Payer called back' },
    });
    callerNoteId = (created.output as SavePatientNoteOutput).note.resourceId;

    const { notes } = await getNotes();

    expect(notes.map((note) => [note.resourceId, note.authorId, note.isUnread])).toEqual([
      [callerNoteId, callerId, false],
      [colleagueNote.id, colleague.id, true],
    ]);
  });

  it("marks the caller's unread notes read by adding their tag to what is there", async () => {
    const marked = await oystehrZambdas.zambda.execute({ id: 'mark-task-notes-read', taskId: task.id });

    expect(marked.output).toEqual({ marked: 1 });
    expect((await readNote(colleagueNote.id!)).meta?.tag).toEqual([
      ...(colleagueNote.meta?.tag ?? []),
      { system: TASK_NOTE_READ_BY_TAG_SYSTEM, code: callerId },
    ]);
    expect((await getNotes()).notes.map((note) => note.isUnread)).toEqual([false, false]);
    expect((await oystehrZambdas.zambda.execute({ id: 'mark-task-notes-read', taskId: task.id })).output).toEqual({
      marked: 0,
    });
  });

  it('keeps the author, the time written and the tags when someone else edits, listing them once', async () => {
    const edit = (text: string): Promise<unknown> =>
      oystehrZambdas.zambda.execute({
        id: 'update-patient-note',
        note: { resourceId: colleagueNote.id, taskId: task.id, text },
      });
    const before = await readNote(colleagueNote.id!);

    await edit('Left a voicemail, will call back Friday');
    await edit('Left a voicemail, will call back Monday');

    const after = await readNote(colleagueNote.id!);
    expect(after).toMatchObject({
      sender: before.sender,
      sent: before.sent,
      meta: { tag: before.meta?.tag },
      payload: [{ contentString: 'Left a voicemail, will call back Monday' }],
    });
    expect(after.extension?.filter((ext) => ext.url === NOTE_EDITOR_EXTENSION_URL)).toEqual([
      expect.objectContaining({ valueReference: expect.objectContaining({ reference: `Practitioner/${callerId}` }) }),
    ]);
  });

  it("finds a new note with its task and the task's earlier notes, and leaves it out once marked notified", async () => {
    const windowStart = DateTime.utc().minus({ hours: 1 });
    const recent = await getRecentTaskNotes(oystehrAdmin, windowStart);

    expect(recent.newNotes.map((note) => note.id)).toContain(callerNoteId);
    expect(recent.newNotes.map((note) => note.id)).not.toContain(colleagueNote.id);
    expect(recent.tasksById.get(task.id!)?.id).toBe(task.id);
    expect(recent.notesByTaskId.get(task.id!)?.map((note) => note.id)).toEqual(
      expect.arrayContaining([callerNoteId, colleagueNote.id])
    );

    // The cron's own marker, written the way the cron writes it.
    const callerNote = await readNote(callerNoteId!);
    await oystehrAdmin.fhir.transaction({
      requests: [
        getPatchBinary({
          resourceId: callerNoteId!,
          resourceType: 'Communication',
          patchOperations: [
            getPatchOperationForNewMetaTag(callerNote, {
              system: TASK_NOTE_NOTIFIED_TAG_SYSTEM,
              code: TASK_NOTE_NOTIFIED_TAG_CODE,
            }),
          ],
        }),
      ],
    });

    const next = await getRecentTaskNotes(oystehrAdmin, windowStart);
    expect(next.newNotes.map((note) => note.id)).not.toContain(callerNoteId);
    expect((await readNote(callerNoteId!)).meta?.tag).toEqual(
      expect.arrayContaining([{ system: TASK_NOTE_SYSTEM, code: TASK_NOTE_CODE }])
    );
  });
});
