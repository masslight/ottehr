import { Communication, Extension, Practitioner } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { isNoteEdited } from 'utils/lib/helpers/visit-note/note-edit-detection.helper';
import { PatientNoteDTO } from 'utils/lib/types/api/patient-notes/patient-notes.types';

// Patient notes and task notes (packages/zambdas/src/ehr/patient-notes): Communications told apart by tag. A task
// note points at its task through basedOn (Oystehr can't search Communication by `about`).
export const PATIENT_NOTE_TAG = `${PRIVATE_EXTENSION_BASE_URL}/patient|patient-note`;
export const TASK_NOTE_TAG = `${PRIVATE_EXTENSION_BASE_URL}/task|task-note`;
// One tag per reader of a task note, coded with the reader's Practitioner id.
export const TASK_NOTE_READ_BY_TAG_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/task-note-read-by`;
// One extension per editor (the author too, when they edit), in the order they first edited.
export const NOTE_EDITOR_EXTENSION_URL = `${PRIVATE_EXTENSION_BASE_URL}/note-editor`;

const hasTag = (resource: Communication, tag: string): boolean =>
  resource.meta?.tag?.some((coding) => `${coding.system}|${coding.code}` === tag) ?? false;

export const isTaskNote = (resource: Communication): boolean => hasTag(resource, TASK_NOTE_TAG);

export const isPatientOrTaskNote = (resource: Communication): boolean =>
  hasTag(resource, PATIENT_NOTE_TAG) || isTaskNote(resource);

export const getNoteTaskId = (resource: Communication): string | undefined =>
  resource.basedOn?.find((reference) => reference.reference?.startsWith('Task/'))?.reference?.split('/')[1];

/** "Given Family", skipping missing parts (getFullName prints "undefined" for them). */
export const getPractitionerName = (practitioner: Practitioner): string =>
  [practitioner.name?.[0]?.given?.join(' '), practitioner.name?.[0]?.family].filter(Boolean).join(' ');

export const withEditor = (resource: Communication, editorId: string, editorName: string): Extension[] => {
  const extensions = resource.extension ?? [];
  const reference = `Practitioner/${editorId}`;
  if (extensions.some((ext) => ext.url === NOTE_EDITOR_EXTENSION_URL && ext.valueReference?.reference === reference))
    return extensions;
  return [...extensions, { url: NOTE_EDITOR_EXTENSION_URL, valueReference: { reference, display: editorName } }];
};

export const toNoteDto = (resource: Communication, callerId?: string): PatientNoteDTO => {
  const authorId = resource.sender?.reference?.split('/')[1] ?? '';
  const editors = (resource.extension ?? []).filter((ext) => ext.url === NOTE_EDITOR_EXTENSION_URL);
  const taskNote = isTaskNote(resource);
  const readByCaller = resource.meta?.tag?.some(
    (tag) => tag.system === TASK_NOTE_READ_BY_TAG_SYSTEM && tag.code === callerId
  );
  return {
    resourceId: resource.id,
    patientId: resource.subject?.reference?.split('/')[1] ?? '',
    taskId: getNoteTaskId(resource),
    text: resource.payload?.[0]?.contentString ?? '',
    authorId,
    authorName: resource.sender?.display ?? '',
    sent: resource.sent,
    lastUpdated: resource.meta?.lastUpdated ?? '',
    // Read tags bump lastUpdated, so task notes go by the editor list only. Patient notes edited before editors
    // were recorded still show "(edited)" from the lastUpdated drift.
    edited: editors.length > 0 || (!taskNote && isNoteEdited(resource.sent, resource.meta?.lastUpdated)),
    editorNames: editors
      .filter((ext) => ext.valueReference?.reference !== `Practitioner/${authorId}`)
      .map((ext) => ext.valueReference?.display ?? ''),
    isUnread: taskNote && !!callerId && authorId !== callerId && !readByCaller,
  };
};
