import { AllChartValues, NOTE_TYPE, NoteDTO, SearchParams } from 'utils';

export interface CustomizableNotesConfig {
  separateEncounterNotes?: boolean; // notes from another encounters should be shown by "show more" button
  // Addendum-style behaviors. All opt-in; default `false` preserves the existing notes UX.
  alwaysEditable?: boolean; // ignore appointment read-only state (addendum notes work after the progress note is locked)
  ownerOnly?: boolean; // only the original author sees edit/delete buttons
  showEditedMarker?: boolean; // append "(edited)" when the server flags the note as edited
  softDeleteWithTombstone?: boolean; // render "(time) (name) deleted the note" tombstone
}

export interface GenericNotesConfig extends CustomizableNotesConfig {
  apiConfig: NoteApiConfig;
  locales: NoteLocales;
}

export interface NoteApiConfig {
  fieldName: Extract<keyof AllChartValues, 'notes'>;
  type: NOTE_TYPE;
  searchParams: SearchParams;
}

export interface NoteLocales {
  entityLabel: string;
  editModalTitle: string;
  editModalPlaceholder: string;
  getAddButtonText: (isSaving: boolean) => string;
  getMoreButtonText: (isMoreEntitiesShown: boolean) => string;
  getDeleteModalTitle: (entityLabel: string) => string;
  getDeleteModalContent: (entityLabel: string) => string;
  getKeepButtonText: () => string;
  getDeleteButtonText: (isDeleting: boolean) => string;
  getLeaveButtonText: () => string;
  getSaveButtonText: (isSaving: boolean) => string;
  getErrorMessage: (action: string, entityLabel: string) => string;
  getGenericErrorMessage: () => string;
}

export interface GenericNoteListProps extends CustomizableNotesConfig {
  apiConfig: NoteApiConfig;
  locales: NoteLocales;
  addNoteButtonDataTestId?: string;
  noteLoadingIndicatorDataTestId?: string;
}

export interface EditableNotesListProps extends CustomizableNotesConfig {
  currentEncounterId: string;
  locales: NoteLocales;
  apiConfig: NoteApiConfig;
  encounterId: string;
  appointmentId: string;
  patientId: string;
  addNoteButtonDataTestId?: string;
  noteLoadingIndicatorDataTestId?: string;
}

export interface EditableNote extends NoteDTO {
  resourceId: string;
  text: string;
  authorId: string;
  authorName: string;
  lastUpdated: string;
  encounterId: string;
  patientId: string;
  type: NOTE_TYPE;
}

export type UseNoteHandlers = (props: {
  appointmentId: string;
  encounterId: string;
  patientId: string;
  apiConfig: NoteApiConfig;
  locales: NoteLocales;
  softDeleteWithTombstone?: boolean;
}) => {
  entities: EditableNote[];
  isLoading: boolean;
  handleSave: ReturnType<UseSaveNote>;
  handleEdit: ReturnType<UseEditNote>;
  handleDelete: ReturnType<UseDeleteNote>;
};

export type UseSaveNote = (props: {
  appointmentId: string;
  encounterId: string;
  patientId: string;
  apiConfig: NoteApiConfig;
}) => (text: string) => Promise<void>;

export type UseDeleteNote = (props: {
  appointmentId: string;
  apiConfig: NoteApiConfig;
  locales: NoteLocales;
}) => (entity: EditableNote) => Promise<void>;

export type UseEditNote = (props: {
  appointmentId: string;
  apiConfig: NoteApiConfig;
}) => (entity: EditableNote, newText: string) => Promise<void>;
