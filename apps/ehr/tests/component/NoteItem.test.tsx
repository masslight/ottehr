import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { deleteNote, getNotes, updateNote } from 'src/api/api';
import { NoteItem } from 'src/features/patient-notes/components/NoteItem';
import { NotesList } from 'src/features/patient-notes/components/NotesList';
import { NoteDTO } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('src/api/api', () => ({ getNotes: vi.fn(), updateNote: vi.fn(), deleteNote: vi.fn() }));
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

  it('shows the original author and creation date without an edit marker for an unedited note', () => {
    renderNote(note());

    expect(screen.getByText(/by Jane Smith/)).toHaveTextContent(/^01\/01\/2026 .* by Jane Smith$/);
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

  it('uses the existing timestamp and author ID fallbacks for legacy notes without newer metadata', () => {
    renderNote(note({ sent: undefined, authorName: '', editorNames: undefined, edited: true }));

    expect(screen.getByText(/by practitioner-author/)).toHaveTextContent(
      /^03\/05\/2026 .* by practitioner-author \(edited\)$/
    );
  });

  it('refetches attribution after an edit and keeps it when the patient notes list is reloaded', async () => {
    const original = note();
    const saved = note({ text: 'Prefers evening calls', edited: true, editorNames: ['Lina Grace'] });
    vi.mocked(getNotes).mockResolvedValue({ notes: [original], hasMore: false });
    vi.mocked(updateNote).mockResolvedValue({ note: saved });
    const renderList = (): ReturnType<typeof render> =>
      render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <NotesList target={{ patientId: PATIENT_ID }} />
        </QueryClientProvider>
      );
    const list = renderList();
    await screen.findByText(original.text);

    await userEvent.click(screen.getByRole('button', { name: 'edit note' }));
    const dialog = screen.getByRole('dialog');
    const field = within(dialog).getByLabelText('Patient Note');
    await userEvent.clear(field);
    await userEvent.type(field, saved.text);
    vi.mocked(getNotes).mockResolvedValue({ notes: [saved], hasMore: false });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await screen.findByText(saved.text);
    expect(screen.getByText(/by Jane Smith/)).toHaveTextContent(
      /^01\/01\/2026 .* by Jane Smith, edited by Lina Grace$/
    );
    expect(updateNote).toHaveBeenCalledWith(expect.anything(), {
      note: { resourceId: original.resourceId, patientId: PATIENT_ID, text: saved.text },
    });
    expect(getNotes).toHaveBeenCalledTimes(2);

    list.unmount();
    renderList();

    await screen.findByText(saved.text);
    expect(screen.getByText(/by Jane Smith/)).toHaveTextContent(
      /^01\/01\/2026 .* by Jane Smith, edited by Lina Grace$/
    );
    expect(getNotes).toHaveBeenCalledTimes(3);
  });

  it('still deletes an edited note through the existing confirmation workflow', async () => {
    vi.mocked(deleteNote).mockResolvedValue(undefined);
    renderNote(note({ edited: true, editorNames: ['Lina Grace'] }));

    await userEvent.click(screen.getByRole('button', { name: 'delete note' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete patient note')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(deleteNote).toHaveBeenCalledWith(expect.anything(), { resourceId: 'note-1' });
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
