import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { updateNote } from 'src/api/api';
import { NoteItem } from 'src/features/patient-notes/components/NoteItem';
import { NoteDTO } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('src/api/api', () => ({ updateNote: vi.fn(), deleteNote: vi.fn() }));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {} }) }));
vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

const PATIENT_ID = 'patient-1';

const note = (overrides: Partial<NoteDTO> = {}): NoteDTO => ({
  resourceId: 'note-1',
  patientId: PATIENT_ID,
  text: 'Prefers morning calls',
  authorId: 'practitioner-author',
  authorName: 'Jane Smith',
  sent: '2026-01-01T12:00:00.000Z',
  lastUpdated: '2026-03-05T12:00:00.000Z',
  edited: false,
  editorNames: [],
  ...overrides,
});

const renderNote = (dto: NoteDTO): void => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NoteItem note={dto} target={{ patientId: PATIENT_ID }} />
    </QueryClientProvider>
  );
};

describe('NoteItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dates a note by when it was written and credits its author, not its last editor', () => {
    renderNote(note({ edited: true, editorNames: ['Lina Grace', 'Sam Lee'] }));

    const byline = screen.getByText(/by Jane Smith/);
    expect(byline).toHaveTextContent(/^01\/01\/2026 .* by Jane Smith, edited by Lina Grace, Sam Lee$/);
    expect(byline).not.toHaveTextContent('03/05/2026');
  });

  it('marks a note only its author edited as "(edited)"', () => {
    renderNote(note({ edited: true }));

    expect(screen.getByText(/by Jane Smith/)).toHaveTextContent(/by Jane Smith \(edited\)$/);
  });

  it("won't save an edit that leaves the text as it was", async () => {
    vi.mocked(updateNote).mockResolvedValue({ note: note({ text: 'Prefers evening calls' }) });
    renderNote(note());

    await userEvent.click(screen.getByRole('button', { name: 'edit note' }));
    const dialog = screen.getByRole('dialog');
    const save = within(dialog).getByRole('button', { name: 'Save' });
    const field = within(dialog).getByLabelText('Patient Note');
    expect(save).toBeDisabled();
    await userEvent.type(field, '  ');
    expect(save).toBeDisabled();

    await userEvent.clear(field);
    await userEvent.type(field, 'Prefers evening calls');
    await userEvent.click(save);

    expect(updateNote).toHaveBeenCalledWith(expect.anything(), {
      note: { resourceId: 'note-1', patientId: PATIENT_ID, text: 'Prefers evening calls' },
    });
  });
});
