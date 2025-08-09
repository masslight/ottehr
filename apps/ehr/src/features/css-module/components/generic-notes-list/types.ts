import { ChartDataFields, NOTE_TYPE, NoteDTO, SearchParams } from 'utils';

export interface CustomizableNotesConfig {
  separateEncounterNotes?: boolean; // notes from another encounters should be shown by "show more" button
}

export interface GenericNotesConfig extends CustomizableNotesConfig {
  apiConfig: NoteApiConfig;
  locales: NoteLocales;
}

export interface NoteApiConfig {
  fieldName: Extract<keyof ChartDataFields, 'notes'>;
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
  encounterId: string;
  patientId: string;
  apiConfig: NoteApiConfig;
  locales: NoteLocales;
}) => {
  entities: EditableNote[];
  isLoading: boolean;
  handleSave: ReturnType<UseSaveNote>;
  handleEdit: ReturnType<UseEditNote>;
  handleDelete: ReturnType<UseDeleteNote>;
};

export type UseSaveNote = (props: {
  encounterId: string;
  patientId: string;
  apiConfig: NoteApiConfig;
}) => (text: string) => Promise<void>;

export type UseDeleteNote = (props: {
  encounterId: string;
  apiConfig: NoteApiConfig;
  locales: NoteLocales;
}) => (entity: EditableNote) => Promise<void>;

export type UseEditNote = (props: {
  encounterId: string;
  apiConfig: NoteApiConfig;
}) => (entity: EditableNote, newText: string) => Promise<void>;
