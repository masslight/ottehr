import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Operation } from 'fast-json-patch';
import { Task as FhirTask } from 'fhir/r4b';
import { MoreTaskActions } from 'src/features/tasks/components/MoreTaskActions';
import { PROVIDER_NOTIFICATION_TAG_SYSTEM } from 'utils/lib/types/api/practitioner.types';
import { Task } from 'utils/lib/types/data/tasks/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get, patch, clients } = vi.hoisted(() => {
  const get = vi.fn();
  const patch = vi.fn(async () => ({}));
  return { get, patch, clients: { oystehr: { fhir: { get, patch } } } };
});

vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => clients }));
vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

const ASSIGNEE = { id: 'pr-1', name: 'Brooks, Samantha', date: '2026-10-11T11:30:00.000Z' };

const makeTask = (overrides: Partial<Task>): Task => ({
  id: 'task-1',
  category: 'manual',
  createdDate: '2026-10-01T10:00:00.000Z',
  title: 'Call the patient',
  subtitle: '',
  status: 'completed',
  completable: true,
  ...overrides,
});

const openMenu = async (task: Task): Promise<ReturnType<typeof userEvent.setup>> => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MoreTaskActions task={task} currentUser={undefined} />
    </QueryClientProvider>
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button'));
  return user;
};

const patchedOperations = (): Operation[] => {
  expect(patch).toHaveBeenCalledTimes(1);
  return (patch.mock.calls[0] as unknown as [{ id: string; operations: Operation[] }])[0].operations;
};

describe('MoreTaskActions on a completed task', () => {
  beforeEach(() => {
    get.mockReset();
    patch.mockClear();
  });

  it('returns an assigned task to Pending unassigned', async () => {
    const fhirTask: FhirTask = {
      resourceType: 'Task',
      id: 'task-1',
      status: 'completed',
      intent: 'order',
      owner: { reference: `Practitioner/${ASSIGNEE.id}` },
      meta: { tag: [{ code: 'task' }, { system: PROVIDER_NOTIFICATION_TAG_SYSTEM, code: 'task_assigned' }] },
    };
    get.mockResolvedValue(fhirTask);
    const user = await openMenu(makeTask({ assignee: ASSIGNEE }));

    await user.click(screen.getByRole('button', { name: 'Return to “Pending”' }));

    await waitFor(() =>
      expect(patchedOperations()).toEqual([
        { op: 'remove', path: '/owner' },
        { op: 'replace', path: '/status', value: 'ready' },
        { op: 'replace', path: '/meta/tag', value: [{ code: 'task' }] },
      ])
    );
  });

  it('returns an assigned task to In Progress keeping the assignee', async () => {
    const user = await openMenu(makeTask({ assignee: ASSIGNEE }));

    await user.click(screen.getByRole('button', { name: 'Return to “In Progress”' }));

    await waitFor(() =>
      expect(patchedOperations()).toEqual([{ op: 'replace', path: '/status', value: 'in-progress' }])
    );
  });

  it('offers only Pending for an unassigned task', async () => {
    const user = await openMenu(makeTask({ assignee: undefined }));

    expect(screen.queryByRole('button', { name: 'Return to “In Progress”' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Return to “Pending”' }));

    await waitFor(() => expect(patchedOperations()).toEqual([{ op: 'replace', path: '/status', value: 'ready' }]));
  });

  it('offers no actions for a task completed by its workflow', () => {
    const queryClient = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MoreTaskActions task={makeTask({ completable: false, assignee: ASSIGNEE })} currentUser={undefined} />
      </QueryClientProvider>
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('keeps the assignment actions, not the return actions, for an open task', async () => {
    await openMenu(makeTask({ status: 'in-progress', assignee: ASSIGNEE }));

    expect(screen.getByRole('button', { name: 'Unassign' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assign to someone else' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Return to “Pending”' })).toBeNull();
  });
});
