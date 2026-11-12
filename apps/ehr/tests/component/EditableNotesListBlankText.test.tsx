import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditableNotesList } from 'src/features/visits/shared/components/generic-notes-list/components/EditableNotesList';
import { EditNoteModal } from 'src/features/visits/shared/components/generic-notes-list/components/EditNoteModal';
import { EditableNote, NoteLocales } from 'src/features/visits/shared/components/generic-notes-list/types';
import { NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handleSave = vi.fn(async () => undefined);

vi.mock('src/features/visits/shared/components/generic-notes-list/hooks/useNoteHandlers', () => ({
  useNoteHandlers: () => ({
    entities: [],
    isLoading: false,
    handleSave,
    handleEdit: vi.fn(),
    handleDelete: vi.fn(),
  }),
}));

vi.mock('src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
}));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

const locales: NoteLocales = {
  entityLabel: 'note',
  editModalTitle: 'Edit note',
  editModalPlaceholder: 'Note',
  getAddButtonText: () => 'Add',
  getMoreButtonText: () => 'More',
  getDeleteModalTitle: () => 'Delete',
  getDeleteModalContent: () => 'Delete?',
  getKeepButtonText: () => 'Keep',
  getDeleteButtonText: () => 'Delete',
  getLeaveButtonText: () => 'Cancel',
  getSaveButtonText: () => 'Save',
  getErrorMessage: () => 'Error',
  getGenericErrorMessage: () => 'Error',
};

const entity: EditableNote = {
  resourceId: 'comm-1',
  type: NOTE_TYPE.SCREENING,
  text: 'Patient reports dizziness',
  authorId: 'prac-1',
  authorName: 'Dr. Smith',
  lastUpdated: '2026-11-01T10:00:00.000Z',
  encounterId: 'enc-1',
  patientId: 'pat-1',
};

const renderList = (): void => {
  render(
    <EditableNotesList
      currentEncounterId="enc-1"
      encounterId="enc-1"
      appointmentId="appt-1"
      patientId="pat-1"
      apiConfig={{ type: NOTE_TYPE.SCREENING }}
      locales={locales}
      addNoteButtonDataTestId="add-note"
    />
  );
};

const noteInput = (): HTMLElement => screen.getByRole('textbox', { name: 'Enter note...' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EditableNotesList - blank note', () => {
  it.each([' ', '   ', '\n'])('keeps Add disabled for the whitespace-only note %j', (text) => {
    renderList();
    fireEvent.change(noteInput(), { target: { value: text } });
    expect(screen.getByTestId('add-note')).toBeDisabled();
  });

  it('does not save a whitespace-only note on Enter', async () => {
    renderList();
    fireEvent.change(noteInput(), { target: { value: '  \n ' } });
    fireEvent.keyDown(noteInput(), { key: 'Enter' });
    expect(handleSave).not.toHaveBeenCalled();
  });

  it('saves a note with surrounding spaces exactly as typed', async () => {
    renderList();
    await userEvent.type(noteInput(), '  dizzy  ');
    expect(noteInput()).toHaveValue('  dizzy  ');
    await userEvent.click(screen.getByTestId('add-note'));
    await waitFor(() => expect(handleSave).toHaveBeenCalledWith('  dizzy  '));
  });
});

describe('EditNoteModal - blank note', () => {
  const renderModal = (): ReturnType<typeof vi.fn> => {
    const onEdit = vi.fn(async () => undefined);
    render(<EditNoteModal onClose={vi.fn()} entity={entity} onEdit={onEdit} locales={locales} />);
    return onEdit;
  };

  it.each([' ', '\n \n'])('disables Save when the note is edited to %j', (text) => {
    renderModal();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('saves an edited note with surrounding spaces exactly as typed', async () => {
    const onEdit = renderModal();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ' still dizzy ' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onEdit).toHaveBeenCalledWith(entity, ' still dizzy '));
  });
});
