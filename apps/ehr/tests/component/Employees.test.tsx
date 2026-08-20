import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { EmployeeDetails, GetEmployeesResponse } from 'utils/lib/types/api/get-employees/get-employees.types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetEmployees = vi.fn<(...args: any[]) => Promise<GetEmployeesResponse>>();
const mockUpdateUser = vi.fn<(...args: any[]) => Promise<{ message: string }>>();
const mockDeleteUser = vi.fn<(...args: any[]) => Promise<{ message: string }>>();

vi.mock('src/api/api', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    getEmployees: (...args: any[]) => mockGetEmployees(...args),
    updateUser: (...args: any[]) => mockUpdateUser(...args),
    deleteUser: (...args: any[]) => mockDeleteUser(...args),
  };
});

vi.mock('../../src/api/api', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    getEmployees: (...args: any[]) => mockGetEmployees(...args),
    updateUser: (...args: any[]) => mockUpdateUser(...args),
    deleteUser: (...args: any[]) => mockDeleteUser(...args),
  };
});

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehr: null,
    oystehrZambda: {} as any,
  }),
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehr: null,
    oystehrZambda: {} as any,
  }),
}));

const mockHasRole = vi.fn(() => true);

vi.mock('src/hooks/useEvolveUser', () => ({
  default: () => ({ id: 'admin-1', hasRole: mockHasRole }),
}));

vi.mock('../../src/hooks/useEvolveUser', () => ({
  default: () => ({ id: 'admin-1', hasRole: mockHasRole }),
}));

vi.mock('notistack', async () => {
  const actual = (await vi.importActual('notistack')) as any;
  return {
    ...actual,
    enqueueSnackbar: vi.fn(),
  };
});

import { dataTestIds } from '../../src/constants/data-test-ids';
import EmployeesPage, { DEFAULT_ROLE_FILTER } from '../../src/pages/Employees';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEmployee(overrides: Partial<EmployeeDetails> = {}): EmployeeDetails {
  return {
    id: 'user-1',
    profile: 'Practitioner/prac-1',
    name: 'jdoe@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jdoe@example.com',
    phoneNumber: '',
    status: 'Active',
    lastLogin: '',
    licenses: [],
    seenPatientRecently: false,
    gettingAlerts: false,
    roles: [RoleType.Staff],
    needsReview: false,
    ...overrides,
  };
}

/** A self-registered user with no role yet — the shape the Needs Review flow exists to resolve. */
function makePendingEmployee(overrides: Partial<EmployeeDetails> = {}): EmployeeDetails {
  return makeEmployee({
    id: 'u-review',
    firstName: '',
    lastName: '',
    name: 'pending@x.com',
    email: 'pending@x.com',
    profile: 'Patient/abc',
    roles: [],
    needsReview: true,
    ...overrides,
  });
}

const createWrapper = (initialPath = '/admin/employees') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EmployeesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasRole.mockReturnValue(true);
  });

  it('renders normally (no chip) when no users need review', async () => {
    mockGetEmployees.mockResolvedValue({
      message: 'ok',
      employees: [
        makeEmployee({ id: 'u1', firstName: 'Alice', lastName: 'Adams', email: 'alice@x.com' }),
        makeEmployee({ id: 'u2', firstName: 'Bob', lastName: 'Brown', email: 'bob@x.com' }),
      ],
    });

    render(<EmployeesPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Adams, Alice')).toBeInTheDocument());
    expect(screen.queryByTestId(dataTestIds.employeesPage.needsReviewChip)).not.toBeInTheDocument();
  });

  it('sorts needsReview rows to the top and shows the Needs Review chip', async () => {
    mockGetEmployees.mockResolvedValue({
      message: 'ok',
      employees: [
        makeEmployee({ id: 'u1', firstName: 'Alice', lastName: 'Adams', email: 'alice@x.com' }),
        makePendingEmployee(),
        makeEmployee({ id: 'u2', firstName: 'Bob', lastName: 'Brown', email: 'bob@x.com' }),
      ],
    });

    render(<EmployeesPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByTestId(dataTestIds.employeesPage.needsReviewChip)).toBeInTheDocument());

    const table = screen.getByTestId(dataTestIds.employeesPage.table);
    const bodyRows = within(table).getAllByRole('row').slice(1); // skip header
    expect(bodyRows[0]).toHaveTextContent('pending@x.com');
    expect(within(bodyRows[0]).getByTestId(dataTestIds.employeesPage.needsReviewChip)).toBeInTheDocument();

    // Normal rows stay unchanged (no chip)
    expect(within(bodyRows[1]).queryByTestId(dataTestIds.employeesPage.needsReviewChip)).not.toBeInTheDocument();
    expect(within(bodyRows[2]).queryByTestId(dataTestIds.employeesPage.needsReviewChip)).not.toBeInTheDocument();
  });

  it('links a pending user to their record like any other row', async () => {
    mockGetEmployees.mockResolvedValue({
      message: 'ok',
      employees: [makePendingEmployee()],
    });

    // Pending users used to be unlinked, with inline Assign Role / Delete buttons in an Actions
    // column instead. Both are resolved on the record page now, so the row must be reachable.
    render(<EmployeesPage />, { wrapper: createWrapper() });

    const link = await screen.findByRole('link', { name: 'pending@x.com' });
    expect(link).toHaveAttribute('href', '/admin/employee/u-review');
  });

  it('accents the pending row so it reads as needing attention without an Actions column', async () => {
    mockGetEmployees.mockResolvedValue({
      message: 'ok',
      employees: [makePendingEmployee(), makeEmployee({ id: 'u1', firstName: 'Alice', lastName: 'Adams' })],
    });

    render(<EmployeesPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByTestId(dataTestIds.employeesPage.needsReviewChip)).toBeInTheDocument());

    const table = screen.getByTestId(dataTestIds.employeesPage.table);
    expect(within(table).queryByText('Actions')).not.toBeInTheDocument();

    const pendingRow = screen.getByTestId(dataTestIds.employeesPage.employeeRow('u-review'));
    const normalRow = screen.getByTestId(dataTestIds.employeesPage.employeeRow('u1'));
    // jsdom doesn't resolve MUI's generated classes into computed styles, so compare the emotion
    // class lists: the accent must be something the pending row has and the ordinary row doesn't.
    expect(pendingRow.className).not.toEqual(normalRow.className);
  });

  it('hides Customer Support by default but keeps every other role', async () => {
    mockGetEmployees.mockResolvedValue({
      message: 'ok',
      employees: [
        makeEmployee({ id: 'u-prov', firstName: 'Pat', lastName: 'Provider', roles: [RoleType.Provider] }),
        makeEmployee({ id: 'u-staff', firstName: 'Sam', lastName: 'Staffer', roles: [RoleType.Staff] }),
        makeEmployee({ id: 'u-cs', firstName: 'Casey', lastName: 'Support', roles: [RoleType.CustomerSupport] }),
      ],
    });

    render(<EmployeesPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Provider, Pat')).toBeInTheDocument());
    expect(screen.getByText('Staffer, Sam')).toBeInTheDocument();
    expect(screen.queryByText('Support, Casey')).not.toBeInTheDocument();
    expect(DEFAULT_ROLE_FILTER).not.toContain(RoleType.CustomerSupport);
  });

  it('treats an empty role selection as no filter, still without surfacing Customer Support', async () => {
    mockGetEmployees.mockResolvedValue({
      message: 'ok',
      employees: [
        makeEmployee({ id: 'u-prov', firstName: 'Pat', lastName: 'Provider', roles: [RoleType.Provider] }),
        makeEmployee({ id: 'u-staff', firstName: 'Sam', lastName: 'Staffer', roles: [RoleType.Staff] }),
        makeEmployee({ id: 'u-cs', firstName: 'Casey', lastName: 'Support', roles: [RoleType.CustomerSupport] }),
      ],
    });

    // `roles=` is the user having unticked every box, which reads as "no filter" rather than
    // "no results" — but Customer Support is an internal support account, not a practice role, so
    // widening the filter must not put it in front of a customer.
    render(<EmployeesPage />, { wrapper: createWrapper('/admin/employees?roles=') });

    await waitFor(() => expect(screen.getByText('Provider, Pat')).toBeInTheDocument());
    expect(screen.getByText('Staffer, Sam')).toBeInTheDocument();
    expect(screen.queryByText('Support, Casey')).not.toBeInTheDocument();
  });

  it('surfaces Customer Support only when it is ticked by name', async () => {
    mockGetEmployees.mockResolvedValue({
      message: 'ok',
      employees: [
        makeEmployee({ id: 'u-staff', firstName: 'Sam', lastName: 'Staffer', roles: [RoleType.Staff] }),
        makeEmployee({ id: 'u-cs', firstName: 'Casey', lastName: 'Support', roles: [RoleType.CustomerSupport] }),
      ],
    });

    render(<EmployeesPage />, { wrapper: createWrapper(`/admin/employees?roles=${RoleType.CustomerSupport}`) });

    await waitFor(() => expect(screen.getByText('Support, Casey')).toBeInTheDocument());
    expect(screen.queryByText('Staffer, Sam')).not.toBeInTheDocument();
  });

  it('does not offer Customer Support as a filter option', async () => {
    const user = userEvent.setup();
    mockGetEmployees.mockResolvedValue({ message: 'ok', employees: [makeEmployee()] });

    render(<EmployeesPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByTestId(dataTestIds.employeesPage.table)).toBeInTheDocument());
    await user.click(screen.getByRole('combobox', { name: /role/i }));

    expect(await screen.findByRole('option', { name: 'Provider' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Customer Support' })).not.toBeInTheDocument();
  });

  it('renders the Customer Support option when it is already selected, so it can be unticked', async () => {
    const user = userEvent.setup();
    mockGetEmployees.mockResolvedValue({ message: 'ok', employees: [makeEmployee()] });

    render(<EmployeesPage />, { wrapper: createWrapper(`/admin/employees?roles=${RoleType.CustomerSupport}`) });

    await waitFor(() => expect(screen.getByTestId(dataTestIds.employeesPage.table)).toBeInTheDocument());
    await user.click(screen.getByRole('combobox', { name: /role/i }));

    expect(await screen.findByRole('option', { name: 'Customer Support' })).toBeInTheDocument();
  });

  it('reads the role filter from the URL', async () => {
    mockGetEmployees.mockResolvedValue({
      message: 'ok',
      employees: [
        makeEmployee({ id: 'u-prov', firstName: 'Pat', lastName: 'Provider', roles: [RoleType.Provider] }),
        makeEmployee({ id: 'u-staff', firstName: 'Sam', lastName: 'Staffer', roles: [RoleType.Staff] }),
      ],
    });

    render(<EmployeesPage />, { wrapper: createWrapper(`/admin/employees?roles=${RoleType.Provider}`) });

    await waitFor(() => expect(screen.getByText('Provider, Pat')).toBeInTheDocument());
    expect(screen.queryByText('Staffer, Sam')).not.toBeInTheDocument();
  });

  it('shows every role a user holds in the Role column', async () => {
    mockGetEmployees.mockResolvedValue({
      message: 'ok',
      employees: [
        makeEmployee({
          id: 'u-multi',
          firstName: 'Morgan',
          lastName: 'Multi',
          roles: [RoleType.Provider, RoleType.Manager],
        }),
      ],
    });

    render(<EmployeesPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Multi, Morgan')).toBeInTheDocument());
    expect(screen.getByTestId(dataTestIds.employeesPage.roleCell)).toHaveTextContent('Provider, Manager');
  });

  it('keeps needsReview users visible even though they hold no role yet', async () => {
    mockGetEmployees.mockResolvedValue({
      message: 'ok',
      employees: [makePendingEmployee()],
    });

    // Filtered to Provider only — a roleless user matches nothing, but hiding the rows an admin has
    // to act on would put the review queue out of reach.
    render(<EmployeesPage />, { wrapper: createWrapper(`/admin/employees?roles=${RoleType.Provider}`) });

    await waitFor(() => expect(screen.getByTestId(dataTestIds.employeesPage.needsReviewChip)).toBeInTheDocument());

    const table = screen.getByTestId(dataTestIds.employeesPage.table);
    const bodyRows = within(table).getAllByRole('row').slice(1); // skip header
    expect(bodyRows).toHaveLength(1);
    expect(bodyRows[0]).toHaveTextContent('pending@x.com');
  });

  it('only offers the State filter when a state-licensed role is selected', async () => {
    mockGetEmployees.mockResolvedValue({ message: 'ok', employees: [makeEmployee()] });

    const { unmount } = render(<EmployeesPage />, {
      wrapper: createWrapper(`/admin/employees?roles=${RoleType.Staff}`),
    });
    await waitFor(() => expect(screen.getByTestId(dataTestIds.employeesPage.table)).toBeInTheDocument());
    expect(screen.queryByTestId(dataTestIds.employeesPage.stateFilter)).not.toBeInTheDocument();
    unmount();

    render(<EmployeesPage />, { wrapper: createWrapper(`/admin/employees?roles=${RoleType.Provider}`) });
    await waitFor(() => expect(screen.getByTestId(dataTestIds.employeesPage.stateFilter)).toBeInTheDocument());
  });

  it('filters by license state once the State filter is in play', async () => {
    mockGetEmployees.mockResolvedValue({
      message: 'ok',
      employees: [
        makeEmployee({
          id: 'u-tx',
          firstName: 'Tess',
          lastName: 'Texan',
          roles: [RoleType.Provider],
          licenses: [{ state: 'TX', code: 'MD', active: true }],
        }),
        makeEmployee({
          id: 'u-ca',
          firstName: 'Cal',
          lastName: 'Californian',
          roles: [RoleType.Provider],
          licenses: [{ state: 'CA', code: 'MD', active: true }],
        }),
      ],
    });

    render(<EmployeesPage />, { wrapper: createWrapper(`/admin/employees?roles=${RoleType.Provider}&state=TX`) });

    await waitFor(() => expect(screen.getByText('Texan, Tess')).toBeInTheDocument());
    expect(screen.queryByText('Californian, Cal')).not.toBeInTheDocument();
  });
});
