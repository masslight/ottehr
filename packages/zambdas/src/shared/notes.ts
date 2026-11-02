import { Communication, Practitioner } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { isNoteEdited } from 'utils/lib/helpers/visit-note/note-edit-detection.helper';
import { NoteDTO } from 'utils/lib/types/api/patient-notes/patient-notes.types';

export const PATIENT_NOTE_TAG = `${PRIVATE_EXTENSION_BASE_URL}/patient|patient-note`;
export const TASK_NOTE_TAG = `${PRIVATE_EXTENSION_BASE_URL}/task|task-note`;
export const TASK_NOTE_READ_BY_TAG_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/task-note-read-by`;
export const NOTE_EDITOR_EXTENSION_URL = `${PRIVATE_EXTENSION_BASE_URL}/note-editor`;

const hasTag = (resource: Communication, tag: string): boolean =>
  resource.meta?.tag?.some((coding) => `${coding.system}|${coding.code}` === tag) ?? false;

export const isTaskNote = (resource: Communication): boolean => hasTag(resource, TASK_NOTE_TAG);

export const isPatientOrTaskNote = (resource: Communication): boolean =>
  hasTag(resource, PATIENT_NOTE_TAG) || isTaskNote(resource);

export const getNoteTaskId = (resource: Communication): string | undefined =>
  resource.basedOn?.find((reference) => reference.reference?.startsWith('Task/'))?.reference?.split('/')[1];

export const isTaskNoteUnreadBy = (resource: Communication, practitionerId: string): boolean =>
  isTaskNote(resource) &&
  resource.sender?.reference !== `Practitioner/${practitionerId}` &&
  !resource.meta?.tag?.some((tag) => tag.system === TASK_NOTE_READ_BY_TAG_SYSTEM && tag.code === practitionerId);

export const getPractitionerName = (practitioner: Practitioner): string =>
  [practitioner.name?.[0]?.given?.join(' '), practitioner.name?.[0]?.family].filter(Boolean).join(' ');

export const toNoteDto = (resource: Communication, callerId?: string): NoteDTO => {
  const authorId = resource.sender?.reference?.split('/')[1] ?? '';
  const editors = (resource.extension ?? []).filter((ext) => ext.url === NOTE_EDITOR_EXTENSION_URL);
  return {
    resourceId: resource.id,
    patientId: resource.subject?.reference?.split('/')[1] ?? '',
    taskId: getNoteTaskId(resource),
    text: resource.payload?.[0]?.contentString ?? '',
    authorId,
    authorName: resource.sender?.display ?? '',
    sent: resource.sent,
    lastUpdated: resource.meta?.lastUpdated ?? '',
    edited: editors.length > 0 || (!isTaskNote(resource) && isNoteEdited(resource.sent, resource.meta?.lastUpdated)),
    editorNames: editors
      .filter((ext) => ext.valueReference?.reference !== `Practitioner/${authorId}`)
      .map((ext) => ext.valueReference?.display ?? ''),
    isUnread: !!callerId && isTaskNoteUnreadBy(resource, callerId),
  };
};
