import { QueryClient, QueryClientProvider, QueryKey } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { enqueueSnackbar } from 'notistack';
import { MemoryRouter } from 'react-router-dom';
import { createNote, getNotes, markTaskNotesRead } from 'src/api/api';
import { invalidateNotes } from 'src/features/patient-notes/hooks/useNotes';
import { Tasks } from 'src/features/tasks/pages/Tasks';
import {
  GetNotesInput,
  MarkTaskNotesReadInput,
  NoteDTO,
  SaveNoteOutput,
} from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { Task } from 'utils/lib/types/data/tasks/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ME = 'practitioner-me';
const OTHER = 'practitioner-other';

let tasks: Task[] = [];
let notes: NoteDTO[] = [];

vi.mock('src/api/api', () => ({
  getNotes: vi.fn(async (_client: unknown, { taskIds }: GetNotesInput) => ({
    notes: notes.filter((note) => note.taskId && taskIds?.includes(note.taskId)),
    hasMore: false,
  })),
  createNote: vi.fn(),
  markTaskNotesRead: vi.fn(async (_client: unknown, { taskId, noteIds }: MarkTaskNotesReadInput) => {
    notes = notes.map((note) =>
      note.taskId === taskId && note.resourceId && noteIds.includes(note.resourceId)
        ? { ...note, isUnread: false }
        : note
    );
  }),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
}));

vi.mock('src/features/visits/in-person/hooks/useTasks', () => ({
  useGetTasks: () => ({ data: { tasks, total: tasks.length }, isLoading: false, isFetching: false }),
  useCompleteTask: () => ({ mutateAsync: vi.fn() }),
  formatDate: (date: string) => date,
  TASKS_PAGE_SIZE: 20,
  OPEN_DOSESPOT: 'Open DoseSpot',
  VIEW_FAX: 'View',
}));

vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehr: {}, oystehrZambda: {} }) }));
vi.mock('src/hooks/useEvolveUser', () => ({ default: () => ({ profile: `Practitioner/${ME}` }) }));
vi.mock('src/layout/PageContainer', () => ({ default: ({ children }: { children: JSX.Element }) => children }));
vi.mock('src/components/input/EmployeeSelectInput', () => ({ EmployeeSelectInput: () => null }));
vi.mock('src/components/input/LocationSelectInput', () => ({ LocationSelectInput: () => null }));
vi.mock('src/components/input/SelectInput', () => ({ SelectInput: () => null }));
vi.mock('src/features/tasks/components/CreateTaskDialog', () => ({ CreateTaskDialog: () => null }));
vi.mock('src/features/tasks/components/MoreTaskActions', () => ({ MoreTaskActions: () => null }));
vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

const task = (id: string, overrides: Partial<Task> = {}): Task => ({
  id,
  category: 'manual',
  createdDate: '2026-10-01T10:00:00.000Z',
  title: `Task ${id}`,
  subtitle: '',
  status: 'ready',
  completable: true,
  ...overrides,
});

const assignedTo = (id: string): Task['assignee'] => ({ id, name: id, date: '2026-10-01T10:00:00.000Z' });

const note = (taskId: string, overrides: Partial<NoteDTO> = {}): NoteDTO => ({
  resourceId: `${taskId}-note`,
  patientId: '',
  taskId,
  text: `About ${taskId}`,
  authorId: OTHER,
  authorName: 'Lina Grace',
  sent: '2026-10-01T11:00:00.000Z',
  lastUpdated: '2026-10-01T11:00:00.000Z',
  edited: false,
  editorNames: [],
  isUnread: true,
  ...overrides,
});

const renderBoard = (): QueryClient => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/tasks?status=ready,in-progress,completed']}>
        <Tasks />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return queryClient;
};

const title = (taskId: string): HTMLElement => screen.getByRole('button', { name: `Task ${taskId}` });

const row = (taskId: string): HTMLElement => title(taskId).closest('tr')!;

const notesButton = (taskId: string): HTMLElement =>
  within(row(taskId)).getByRole('button', { name: /^Internal Notes/ });

const hasUnreadDot = (taskId: string): boolean =>
  within(row(taskId)).queryByRole('button', { name: 'Internal Notes, unread' }) !== null;

describe('Tasks board: task notes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tasks = [];
    notes = [];
  });

  it('shows the unread dot only to people involved in the task', async () => {
    tasks = [
      task('assigned', { assignee: assignedTo(ME) }),
      task('created', { createdById: ME }),
      task('discussed'),
      task('uninvolved', { assignee: assignedTo(OTHER) }),
      task('caught-up', { assignee: assignedTo(ME) }),
    ];
    notes = [
      note('assigned'),
      note('created'),
      note('discussed'),
      note('discussed', { resourceId: 'mine', authorId: ME, isUnread: false }),
      note('uninvolved'),
      note('caught-up', { isUnread: false }),
    ];

    renderBoard();

    await waitFor(() => expect(hasUnreadDot('assigned')).toBe(true));
    expect(hasUnreadDot('created')).toBe(true);
    expect(hasUnreadDot('discussed')).toBe(true);
    expect(hasUnreadDot('uninvolved')).toBe(false);
    expect(hasUnreadDot('caught-up')).toBe(false);
  });

  it('previews every note, newest first and scrollable, on hover without marking them read', async () => {
    tasks = [task('long', { assignee: assignedTo(ME) })];
    notes = [
      note('long', { resourceId: 'newest', text: 'Newest', editorNames: ['Jane Smith'], edited: true }),
      note('long', { resourceId: 'oldest', text: 'Oldest', sent: '2026-10-01T09:00:00.000Z' }),
    ];
    renderBoard();
    await waitFor(() => expect(hasUnreadDot('long')).toBe(true));

    await userEvent.hover(title('long'));

    const preview = await screen.findByRole('tooltip');
    const texts = within(preview)
      .getAllByText(/^(Newest|Oldest)$/)
      .map((element) => element.textContent);
    expect(texts).toEqual(['Newest', 'Oldest']);
    expect(within(preview).getByText(/by Lina Grace, edited by Jane Smith$/)).toBeInTheDocument();
    let scroller = within(preview).getByText('Newest').parentElement;
    while (scroller && getComputedStyle(scroller).overflowY !== 'auto') scroller = scroller.parentElement;
    expect(scroller).not.toBeNull();
    expect(markTaskNotesRead).not.toHaveBeenCalled();
    expect(hasUnreadDot('long')).toBe(true);

    await userEvent.unhover(title('long'));
    await userEvent.hover(notesButton('long'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Internal Notes');
    expect(markTaskNotesRead).not.toHaveBeenCalled();
  });

  it("opens a task's notes, completed ones too, and marks them read only when some are unread", async () => {
    tasks = [task('open', { assignee: assignedTo(ME) }), task('done', { status: 'completed' })];
    notes = [note('open'), note('done', { isUnread: false })];
    renderBoard();
    await waitFor(() => expect(hasUnreadDot('open')).toBe(true));

    await userEvent.click(notesButton('open'));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Internal Notes')).toBeInTheDocument();
    expect(await within(dialog).findByText('About open')).toBeInTheDocument();
    expect(markTaskNotesRead).toHaveBeenCalledTimes(1);
    expect(markTaskNotesRead).toHaveBeenCalledWith(expect.anything(), { taskId: 'open', noteIds: ['open-note'] });

    await userEvent.click(within(dialog).getByRole('button', { name: 'close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await userEvent.click(notesButton('done'));

    expect(await within(await screen.findByRole('dialog')).findByText('About done')).toBeInTheDocument();
    expect(markTaskNotesRead).toHaveBeenCalledTimes(1);
  });

  it('marks the notes read when they are opened before the board has loaded them', async () => {
    tasks = [task('open', { assignee: assignedTo(ME) }), task('other')];
    notes = [note('open')];
    vi.mocked(getNotes).mockImplementationOnce(() => new Promise(() => undefined));
    renderBoard();
    expect(getNotes).toHaveBeenCalledWith(expect.anything(), { taskIds: ['open', 'other'] });

    await userEvent.click(title('open'));

    expect(await within(await screen.findByRole('dialog')).findByText('About open')).toBeInTheDocument();
    await waitFor(() =>
      expect(markTaskNotesRead).toHaveBeenCalledWith(expect.anything(), { taskId: 'open', noteIds: ['open-note'] })
    );
  });

  it('marks a note read that arrived after the board last loaded', async () => {
    tasks = [task('open', { assignee: assignedTo(ME) })];
    notes = [note('open', { isUnread: false })];
    renderBoard();
    await userEvent.hover(title('open'));
    expect(await within(await screen.findByRole('tooltip')).findByText('About open')).toBeInTheDocument();
    await userEvent.unhover(title('open'));
    expect(hasUnreadDot('open')).toBe(false);
    notes = [note('open', { resourceId: 'newer', text: 'Payer called back' }), ...notes];

    await userEvent.click(title('open'));

    expect(await within(await screen.findByRole('dialog')).findByText('Payer called back')).toBeInTheDocument();
    await waitFor(() =>
      expect(markTaskNotesRead).toHaveBeenCalledWith(expect.anything(), { taskId: 'open', noteIds: ['newer'] })
    );
  });

  it('marks newly displayed notes read after the discussion refreshes', async () => {
    tasks = [task('open', { assignee: assignedTo(ME) })];
    notes = [note('open')];
    const queryClient = renderBoard();
    await userEvent.click(title('open'));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('About open');
    await waitFor(() =>
      expect(queryClient.getQueryData(['patient-notes', { taskId: 'open' }])).toMatchObject({
        pages: [{ notes: [{ resourceId: 'open-note', isUnread: false }] }],
      })
    );

    notes = [note('open', { resourceId: 'newer', text: 'Payer called back' }), ...notes];
    await act(() => queryClient.refetchQueries({ queryKey: ['patient-notes', { taskId: 'open' }] }));

    expect(await within(dialog).findByText('Payer called back')).toBeInTheDocument();
    await waitFor(() => expect(markTaskNotesRead).toHaveBeenCalledTimes(2));
    expect(markTaskNotesRead).toHaveBeenLastCalledWith(expect.anything(), { taskId: 'open', noteIds: ['newer'] });
    await userEvent.click(within(dialog).getByRole('button', { name: 'close' }));
    await waitFor(() => expect(hasUnreadDot('open')).toBe(false));
  });

  it('leaves notes arriving after the dialog loads unread until they are displayed', async () => {
    tasks = [task('open', { assignee: assignedTo(ME) })];
    notes = [note('open')];
    vi.mocked(markTaskNotesRead).mockImplementationOnce(async (_client, { noteIds }) => {
      notes = [note('open', { resourceId: 'unseen', text: 'Unseen follow-up' }), ...notes].map((note) =>
        note.resourceId && noteIds.includes(note.resourceId) ? { ...note, isUnread: false } : note
      );
    });
    renderBoard();
    await userEvent.click(title('open'));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('About open');

    await waitFor(() => expect(markTaskNotesRead).toHaveBeenCalledTimes(1));
    expect(markTaskNotesRead).toHaveBeenCalledWith(expect.anything(), { taskId: 'open', noteIds: ['open-note'] });
    await waitFor(() => expect(notes.find((note) => note.resourceId === 'unseen')?.isUnread).toBe(true));
    expect(within(dialog).queryByText('Unseen follow-up')).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'close' }));
    expect(hasUnreadDot('open')).toBe(true);
  });

  it('does not mark the same notes twice while an earlier request is pending', async () => {
    tasks = [task('open', { assignee: assignedTo(ME) })];
    notes = [note('open')];
    let finishMarkRead = (): void => undefined;
    vi.mocked(markTaskNotesRead).mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishMarkRead = resolve))
    );
    const queryClient = renderBoard();
    await userEvent.click(title('open'));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('About open');
    await waitFor(() => expect(markTaskNotesRead).toHaveBeenCalledTimes(1));

    notes = [note('open', { resourceId: 'newer', text: 'Payer called back' }), ...notes];
    await act(() => queryClient.refetchQueries({ queryKey: ['patient-notes', { taskId: 'open' }] }));

    await within(dialog).findByText('Payer called back');
    await waitFor(() => expect(markTaskNotesRead).toHaveBeenCalledTimes(2));
    expect(markTaskNotesRead).toHaveBeenLastCalledWith(expect.anything(), { taskId: 'open', noteIds: ['newer'] });
    await act(async () => finishMarkRead());
    expect(markTaskNotesRead).toHaveBeenCalledTimes(2);
  });

  it('clears the unread dot once the opened notes are marked read, marking them only once', async () => {
    tasks = [task('open', { assignee: assignedTo(ME) })];
    notes = [note('open')];
    renderBoard();
    await waitFor(() => expect(hasUnreadDot('open')).toBe(true));

    await userEvent.click(title('open'));
    await within(await screen.findByRole('dialog')).findByText('About open');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'close' }));

    await waitFor(() => expect(hasUnreadDot('open')).toBe(false));
    expect(markTaskNotesRead).toHaveBeenCalledTimes(1);

    const requestsBefore = vi.mocked(getNotes).mock.calls.length;
    await userEvent.click(title('open'));
    await waitFor(() => expect(getNotes).toHaveBeenCalledTimes(requestsBefore + 1));
    await within(await screen.findByRole('dialog')).findByText('About open');
    expect(markTaskNotesRead).toHaveBeenCalledTimes(1);
  });

  it('keeps the dot when marking fails, and tries again the next time the notes are opened', async () => {
    tasks = [task('open', { assignee: assignedTo(ME) })];
    notes = [note('open')];
    vi.mocked(markTaskNotesRead).mockRejectedValueOnce(new Error('Network error'));
    renderBoard();
    await waitFor(() => expect(hasUnreadDot('open')).toBe(true));

    await userEvent.click(title('open'));
    await within(await screen.findByRole('dialog')).findByText('About open');
    await waitFor(() => expect(markTaskNotesRead).toHaveBeenCalledTimes(1));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(hasUnreadDot('open')).toBe(true);

    await userEvent.click(title('open'));
    await waitFor(() => expect(markTaskNotesRead).toHaveBeenCalledTimes(2));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'close' }));
    await waitFor(() => expect(hasUnreadDot('open')).toBe(false));
  });

  it('closes the dialog and confirms with the text once a note is added', async () => {
    tasks = [task('open', { assignee: assignedTo(ME) })];
    vi.mocked(createNote).mockResolvedValue({ note: note('open', { authorId: ME, isUnread: false }) });
    renderBoard();
    await waitFor(() => expect(getNotes).toHaveBeenCalled());

    await userEvent.click(title('open'));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Add a Note'), '  Called the payer  ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add Note' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(createNote).toHaveBeenCalledWith(expect.anything(), {
      note: { taskId: 'open', text: 'Called the payer' },
    });
    expect(enqueueSnackbar).toHaveBeenCalledWith('Note created: Called the payer', { variant: 'success' });
  });

  it("leaves another task's notes open when an earlier save finishes after the user moved on", async () => {
    tasks = [task('first', { assignee: assignedTo(ME) }), task('second', { assignee: assignedTo(ME) })];
    let finishSave: (output: SaveNoteOutput) => void = () => undefined;
    vi.mocked(createNote).mockReturnValue(new Promise((resolve) => (finishSave = resolve)));
    renderBoard();
    await waitFor(() => expect(getNotes).toHaveBeenCalled());

    await userEvent.click(title('first'));
    const firstDialog = await screen.findByRole('dialog');
    await userEvent.type(within(firstDialog).getByLabelText('Add a Note'), 'Called the payer');
    await userEvent.click(within(firstDialog).getByRole('button', { name: 'Add Note' }));
    await userEvent.click(within(firstDialog).getByRole('button', { name: 'close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await userEvent.click(title('second'));
    await screen.findByRole('dialog');

    finishSave({ note: note('first', { authorId: ME, isUnread: false }) });

    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith('Note created: Called the payer', { variant: 'success' })
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('invalidateNotes', () => {
  const PATIENT_QUERIES: QueryKey[] = [
    ['patient-notes', { patientId: 'patient-1' }],
    ['patient-notes-count', { patientId: 'patient-1' }],
    ['patient-notes', { patientId: 'patient-2' }],
    ['patient-notes-count', { patientId: 'patient-2' }],
  ];
  const TASK_QUERIES: QueryKey[] = [
    ['patient-notes', { taskId: 'task-1' }],
    ['patient-notes', { taskId: 'task-2' }],
    ['patient-notes', 'tasks', ['task-1', 'task-2']],
    ['patient-notes', 'tasks', ['task-3']],
  ];

  const invalidatedBy = (target: Parameters<typeof invalidateNotes>[1]): QueryKey[] => {
    const queryClient = new QueryClient();
    for (const queryKey of [...PATIENT_QUERIES, ...TASK_QUERIES]) queryClient.setQueryData(queryKey, {});
    invalidateNotes(queryClient, target);
    return queryClient
      .getQueryCache()
      .getAll()
      .filter((query) => query.state.isInvalidated)
      .map((query) => query.queryKey);
  };

  it("refreshes a patient's notes and count, and no one else's", () => {
    expect(invalidatedBy({ patientId: 'patient-1' })).toEqual(PATIENT_QUERIES.slice(0, 2));
  });

  it("refreshes a task's notes and only the board pages that show it", () => {
    expect(invalidatedBy({ taskId: 'task-1' })).toEqual([TASK_QUERIES[0], TASK_QUERIES[2]]);
  });
});
