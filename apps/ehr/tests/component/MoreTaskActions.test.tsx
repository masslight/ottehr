import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Task as FhirTask } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { MoreTaskActions } from 'src/features/tasks/components/MoreTaskActions';
import { GET_TASKS_KEY } from 'src/features/visits/in-person/hooks/useTasks';
import { MANUAL_TASK, Task } from 'utils/lib/types/data/tasks/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get, transaction, clients } = vi.hoisted(() => {
  const get = vi.fn();
  const transaction = vi.fn();
  return { get, transaction, clients: { oystehr: { fhir: { get, transaction } } } };
});

vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => clients }));
vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

const ASSIGNEE = { id: 'pr-1', name: 'Brooks, Samantha', date: '2026-10-11T11:30:00.000Z' };
const RETURN_TO_PENDING = 'Return to “Pending”';
const RETURN_TO_IN_PROGRESS = 'Return to “In Progress”';

const storedTask = (overrides: Partial<FhirTask> = {}): FhirTask => ({
  resourceType: 'Task',
  id: 'task-1',
  status: 'completed',
  intent: 'order',
  meta: { versionId: '1' },
  groupIdentifier: { value: MANUAL_TASK.category.other },
  owner: { reference: `Practitioner/${ASSIGNEE.id}`, display: ASSIGNEE.name },
  ...overrides,
});

const makeTask = (overrides: Partial<Task>): Task => ({
  id: 'task-1',
  category: MANUAL_TASK.category.other,
  createdDate: '2026-10-01T10:00:00.000Z',
  title: 'Call the patient',
  subtitle: '',
  status: 'completed',
  completable: true,
  reopenable: true,
  ...overrides,
});

const renderActions = (task: Task): { queryClient: QueryClient; container: HTMLElement } => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { container } = render(
    <QueryClientProvider client={queryClient}>
      <MoreTaskActions task={task} currentUser={undefined} />
    </QueryClientProvider>
  );
  return { queryClient, container };
};

const openMenu = async (task: Task): Promise<{ queryClient: QueryClient }> => {
  const rendered = renderActions(task);
  await userEvent.setup().click(screen.getByRole('button'));
  return rendered;
};

const menuItem = (name: string): HTMLElement => screen.getByRole('button', { name });

describe('MoreTaskActions on a completed task', () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue(storedTask());
    transaction.mockReset().mockResolvedValue({});
    vi.mocked(enqueueSnackbar).mockClear();
  });

  it('offers both returns for an assigned task', async () => {
    await openMenu(makeTask({ assignee: ASSIGNEE }));

    expect(menuItem(RETURN_TO_PENDING)).toBeInTheDocument();
    expect(menuItem(RETURN_TO_IN_PROGRESS)).toBeInTheDocument();
  });

  it('offers only Pending for an unassigned task', async () => {
    await openMenu(makeTask({ assignee: undefined }));

    expect(menuItem(RETURN_TO_PENDING)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: RETURN_TO_IN_PROGRESS })).toBeNull();
  });

  it('offers no actions for a task that cannot be reopened', () => {
    const { container } = renderActions(makeTask({ reopenable: false, assignee: ASSIGNEE }));

    expect(container).toBeEmptyDOMElement();
  });

  it('keeps the assignment actions, not the return actions, for an open task', async () => {
    await openMenu(makeTask({ status: 'in-progress', assignee: ASSIGNEE }));

    expect(menuItem('Unassign')).toBeInTheDocument();
    expect(menuItem('Assign to someone else')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: RETURN_TO_PENDING })).toBeNull();
  });

  it('confirms a successful return, closes the menu and refreshes the task list', async () => {
    const { queryClient } = await openMenu(makeTask({ assignee: ASSIGNEE }));
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    await userEvent.setup().click(menuItem(RETURN_TO_IN_PROGRESS));

    await waitFor(() => expect(screen.queryByRole('button', { name: RETURN_TO_PENDING })).toBeNull());
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(enqueueSnackbar).toHaveBeenCalledWith('Task returned to In Progress.', { variant: 'success' });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: [GET_TASKS_KEY], exact: false });
  });

  it('shows why a return failed, keeps the menu open and refreshes the stale list', async () => {
    get.mockResolvedValue(storedTask({ status: 'ready', owner: undefined }));
    const { queryClient } = await openMenu(makeTask({ assignee: ASSIGNEE }));
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    await userEvent.setup().click(menuItem(RETURN_TO_IN_PROGRESS));

    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.stringMatching(/changed by someone else/), {
        variant: 'error',
      })
    );
    expect(transaction).not.toHaveBeenCalled();
    expect(enqueueSnackbar).not.toHaveBeenCalledWith(expect.anything(), { variant: 'success' });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: [GET_TASKS_KEY], exact: false });
    await waitFor(() => expect(menuItem(RETURN_TO_PENDING)).not.toHaveAttribute('aria-disabled'));
    expect(menuItem(RETURN_TO_IN_PROGRESS)).not.toHaveAttribute('aria-disabled');

    await userEvent.setup().click(menuItem(RETURN_TO_PENDING));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });

  it('starts one request when a second click lands before the pending state renders', async () => {
    transaction.mockReturnValue(new Promise(() => undefined));
    await openMenu(makeTask({ assignee: ASSIGNEE }));
    const pending = menuItem(RETURN_TO_PENDING);
    const inProgress = menuItem(RETURN_TO_IN_PROGRESS);

    fireEvent.click(pending);
    fireEvent.click(inProgress);

    await waitFor(() => expect(transaction).toHaveBeenCalledTimes(1));
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('sends one request however often the returns are clicked while it is in flight', async () => {
    let finishWrite: (value: unknown) => void = () => undefined;
    transaction.mockReturnValue(new Promise((resolve) => (finishWrite = resolve)));
    await openMenu(makeTask({ assignee: ASSIGNEE }));

    fireEvent.click(menuItem(RETURN_TO_PENDING));
    await waitFor(() => expect(transaction).toHaveBeenCalledTimes(1));
    expect(menuItem(RETURN_TO_PENDING)).toHaveAttribute('aria-disabled', 'true');
    expect(menuItem(RETURN_TO_IN_PROGRESS)).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(menuItem(RETURN_TO_PENDING));
    fireEvent.click(menuItem(RETURN_TO_IN_PROGRESS));

    finishWrite({});
    await waitFor(() => expect(screen.queryByRole('button', { name: RETURN_TO_PENDING })).toBeNull());
    expect(get).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
