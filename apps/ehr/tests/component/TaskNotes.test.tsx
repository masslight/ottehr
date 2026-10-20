import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { enqueueSnackbar } from 'notistack';
import { MemoryRouter } from 'react-router-dom';
import { createPatientNote, getPatientNotes, markTaskNotesRead } from 'src/api/api';
import { Tasks } from 'src/features/tasks/pages/Tasks';
import {
  GetPatientNotesInput,
  PatientNoteDTO,
  SavePatientNoteOutput,
} from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { Task } from 'utils/lib/types/data/tasks/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ME = 'practitioner-me';
const OTHER = 'practitioner-other';

let tasks: Task[] = [];
let notes: PatientNoteDTO[] = [];

vi.mock('src/api/api', () => ({
  getPatientNotes: vi.fn(async (_client: unknown, { taskIds }: GetPatientNotesInput) => ({
    notes: notes.filter((note) => note.taskId && taskIds?.includes(note.taskId)),
    hasMore: false,
  })),
  createPatientNote: vi.fn(),
  markTaskNotesRead: vi.fn(),
  updatePatientNote: vi.fn(),
  deletePatientNote: vi.fn(),
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

const note = (taskId: string, overrides: Partial<PatientNoteDTO> = {}): PatientNoteDTO => ({
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

const renderBoard = (): void => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/tasks?status=ready,in-progress,completed']}>
        <Tasks />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const title = (taskId: string): HTMLElement => screen.getByRole('button', { name: `Task ${taskId}` });

const hasUnreadDot = (taskId: string): boolean =>
  within(title(taskId).closest('tr')!).queryByRole('img', { name: 'Unread notes' }) !== null;

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
    // A legacy task with no creator or assignee: writing a note is what makes someone involved.
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
  });

  it("opens a task's notes, completed ones too, and marks them read only when some are unread", async () => {
    tasks = [task('open', { assignee: assignedTo(ME) }), task('done', { status: 'completed' })];
    notes = [note('open'), note('done', { isUnread: false })];
    renderBoard();
    await waitFor(() => expect(hasUnreadDot('open')).toBe(true));

    await userEvent.click(title('open'));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Task Notes')).toBeInTheDocument();
    expect(await within(dialog).findByText('About open')).toBeInTheDocument();
    expect(markTaskNotesRead).toHaveBeenCalledTimes(1);
    expect(markTaskNotesRead).toHaveBeenCalledWith(expect.anything(), { taskId: 'open' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await userEvent.click(title('done'));

    expect(await within(await screen.findByRole('dialog')).findByText('About done')).toBeInTheDocument();
    expect(markTaskNotesRead).toHaveBeenCalledTimes(1);
  });

  it('closes the dialog and confirms with the text once a note is added', async () => {
    tasks = [task('open', { assignee: assignedTo(ME) })];
    vi.mocked(createPatientNote).mockResolvedValue({ note: note('open', { authorId: ME, isUnread: false }) });
    renderBoard();
    await waitFor(() => expect(getPatientNotes).toHaveBeenCalled());

    await userEvent.click(title('open'));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Enter task note...'), '  Called the payer  ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save Task Note' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(createPatientNote).toHaveBeenCalledWith(expect.anything(), {
      note: { taskId: 'open', text: 'Called the payer' },
    });
    expect(enqueueSnackbar).toHaveBeenCalledWith('Note created: Called the payer', { variant: 'success' });
  });

  it("leaves another task's notes open when an earlier save finishes after the user moved on", async () => {
    tasks = [task('first', { assignee: assignedTo(ME) }), task('second', { assignee: assignedTo(ME) })];
    let finishSave: (output: SavePatientNoteOutput) => void = () => undefined;
    vi.mocked(createPatientNote).mockReturnValue(new Promise((resolve) => (finishSave = resolve)));
    renderBoard();
    await waitFor(() => expect(getPatientNotes).toHaveBeenCalled());

    await userEvent.click(title('first'));
    const firstDialog = await screen.findByRole('dialog');
    await userEvent.type(within(firstDialog).getByLabelText('Enter task note...'), 'Called the payer');
    await userEvent.click(within(firstDialog).getByRole('button', { name: 'Save Task Note' }));
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
