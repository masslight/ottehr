import { SearchParam } from '@oystehr/sdk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Location, Task as FhirTask } from 'fhir/r4b';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Tasks } from 'src/features/tasks/pages/Tasks';
import { TASK_CATEGORY_IDENTIFIER, TASK_LOCATION_SYSTEM } from 'utils/lib/fhir/constants';
import { LAB_ORDER_TASK } from 'utils/lib/types/data/labs/labs.constants';
import { FAX_TASK, MANUAL_TASK } from 'utils/lib/types/data/tasks/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { search, clients } = vi.hoisted(() => {
  const search = vi.fn(async (_input: { resourceType: string; params: SearchParam[] }) => ({
    unbundle: () => [],
    total: 0,
  }));
  // One stable client object, like the real hook: effects keyed on `oystehr` would otherwise re-run every render.
  return { search, clients: { oystehr: { fhir: { search } }, oystehrZambda: {} } };
});

const LOCATIONS: Location[] = [
  { resourceType: 'Location', id: 'loc-a', name: 'Alpha Clinic' },
  { resourceType: 'Location', id: 'loc-b', name: 'Bravo Clinic' },
  { resourceType: 'Location', id: 'loc-c', name: 'Charlie Clinic' },
];

vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => clients }));
const myTask = (id: string, location: Location): FhirTask => ({
  resourceType: 'Task',
  id,
  status: 'in-progress',
  intent: 'order',
  owner: { reference: 'Practitioner/me' },
  meta: { tag: [{ code: 'task' }, { system: TASK_LOCATION_SYSTEM, code: location.id, display: location.name }] },
});
const MY_ACTIVE_TASKS: FhirTask[] = [
  myTask('t-1', LOCATIONS[1]),
  myTask('t-2', LOCATIONS[1]),
  myTask('t-3', LOCATIONS[2]),
];

vi.mock('utils/lib/fhir/getAllFhirSearchPages', () => ({
  getAllFhirSearchPages: async ({ resourceType }: { resourceType: string }) =>
    ({ Location: LOCATIONS, Task: MY_ACTIVE_TASKS })[resourceType] ?? [],
}));
vi.mock('src/api/api', () => ({ getNotes: vi.fn(async () => ({ notes: [], hasMore: false })) }));
vi.mock('src/hooks/useEvolveUser', () => ({ default: () => ({ profile: 'Practitioner/me' }) }));
vi.mock('src/layout/PageContainer', () => ({ default: ({ children }: { children: JSX.Element }) => children }));
vi.mock('src/components/input/EmployeeSelectInput', () => ({ EmployeeSelectInput: () => null }));
vi.mock('src/features/tasks/components/CreateTaskDialog', () => ({ CreateTaskDialog: () => null }));
vi.mock('src/features/tasks/components/MoreTaskActions', () => ({ MoreTaskActions: () => null }));
vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

let currentSearch = new URLSearchParams();
const UrlProbe = (): null => {
  currentSearch = new URLSearchParams(useLocation().search);
  return null;
};

const renderBoard = (url: string): void => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
        <Tasks />
        <UrlProbe />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const taskSearchParams = (): SearchParam[][] =>
  search.mock.calls
    .map(([input]) => input)
    .filter((input) => input.resourceType === 'Task')
    .map((i) => i.params);

/**
 * Codes of the latest Task search's `name` param in `system` (every task search also has `_tag=task`, in no
 * system), sorted since their order is not significant.
 */
const latestTokenCodes = (name: string, system: string): string[] | undefined => {
  const prefix = `${system}|`;
  const value = taskSearchParams()
    .flat()
    .filter((param) => param.name === name && String(param.value).startsWith(prefix))
    .at(-1)?.value;
  if (value == null) return undefined;
  return String(value)
    .split(',')
    .map((token) => {
      expect(token.startsWith(prefix)).toBe(true);
      return token.slice(prefix.length);
    })
    .sort();
};

const selectOption = async (field: string, option: string): Promise<void> => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: field }));
  await user.click(await screen.findByRole('option', { name: option }));
};

describe('Tasks board: category and location filters', () => {
  beforeEach(() => {
    search.mockClear();
    localStorage.clear();
  });

  it('restores several categories and locations from the URL and matches tasks in any of them', async () => {
    renderBoard(
      `/tasks?category=${LAB_ORDER_TASK.category},${MANUAL_TASK.category.externalLab},${FAX_TASK.category}` +
        '&location=loc-a,loc-b'
    );

    expect(await screen.findByRole('button', { name: 'External Lab' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fax' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Alpha Clinic' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bravo Clinic' })).toBeInTheDocument();

    await waitFor(() =>
      expect(latestTokenCodes('group-identifier', TASK_CATEGORY_IDENTIFIER)).toEqual(
        [LAB_ORDER_TASK.category, MANUAL_TASK.category.externalLab, FAX_TASK.category].sort()
      )
    );
    expect(latestTokenCodes('_tag', TASK_LOCATION_SYSTEM)).toEqual(['loc-a', 'loc-b']);
    // Location-agnostic tasks (e.g. inbound faxes) still come from their own search.
    expect(taskSearchParams().some((params) => params.some((param) => param.name === '_tag:not'))).toBe(true);
  });

  it('adds a category to the ones already selected', async () => {
    renderBoard(`/tasks?category=${FAX_TASK.category}`);
    expect(await screen.findByRole('button', { name: 'Fax' })).toBeInTheDocument();

    await selectOption('Category', 'Billing');

    await waitFor(() =>
      expect(currentSearch.get('category')).toBe(`${FAX_TASK.category},${MANUAL_TASK.category.billing}`)
    );
    expect(screen.getByRole('button', { name: 'Fax' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Billing' })).toBeInTheDocument();
    await waitFor(() =>
      expect(latestTokenCodes('group-identifier', TASK_CATEGORY_IDENTIFIER)).toEqual(
        [FAX_TASK.category, MANUAL_TASK.category.billing].sort()
      )
    );
  });

  it('adds a location to the ones already selected', async () => {
    renderBoard('/tasks?location=loc-a');
    expect(await screen.findByRole('button', { name: 'Alpha Clinic' })).toBeInTheDocument();

    await selectOption('Location', 'Charlie Clinic');

    await waitFor(() => expect(currentSearch.get('location')).toBe('loc-a,loc-c'));
    await waitFor(() => expect(latestTokenCodes('_tag', TASK_LOCATION_SYSTEM)).toEqual(['loc-a', 'loc-c']));
  });

  it('remembers the selections for the next visit', async () => {
    renderBoard('/tasks?location=loc-a');
    expect(await screen.findByRole('button', { name: 'Alpha Clinic' })).toBeInTheDocument();

    await selectOption('Location', 'Bravo Clinic');

    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('tasks.filters') ?? '{}').location).toEqual(['loc-a', 'loc-b'])
    );
  });
});

describe('Tasks board: my tasks in other locations', () => {
  beforeEach(() => {
    search.mockClear();
    localStorage.clear();
  });

  it('lists the other locations that have tasks assigned to me', async () => {
    renderBoard('/tasks?location=loc-b');

    expect(await screen.findByText(/You have tasks in locations:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Charlie Clinic - 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bravo Clinic - 2' })).not.toBeInTheDocument();
  });

  it('opens my active tasks in the location I pick', async () => {
    renderBoard('/tasks?location=loc-b&category=' + FAX_TASK.category);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Charlie Clinic - 1' }));

    await waitFor(() => expect(currentSearch.get('location')).toBe('loc-c'));
    expect(currentSearch.get('assignedTo')).toBe('me');
    expect(currentSearch.get('status')).toBe('ready,in-progress');
    expect(currentSearch.get('category')).toBeNull();
    expect(JSON.parse(localStorage.getItem('tasks.filters') ?? '{}')).toEqual({
      location: ['loc-c'],
      assignedTo: 'me',
      status: ['ready', 'in-progress'],
    });
    expect(await screen.findByRole('button', { name: 'Charlie Clinic' })).toBeInTheDocument();
  });
});
