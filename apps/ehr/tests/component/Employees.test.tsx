import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { EmployeeDetails, GetEmployeesResponse, RoleType } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetEmployees = vi.fn<(...args: any[]) => Promise<GetEmployeesResponse>>();
const mockUpdateUser = vi.fn<(...args: any[]) => Promise<{ message: string }>>();

vi.mock('src/api/api', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    getEmployees: (...args: any[]) => mockGetEmployees(...args),
    updateUser: (...args: any[]) => mockUpdateUser(...args),
  };
});

vi.mock('../../src/api/api', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    getEmployees: (...args: any[]) => mockGetEmployees(...args),
    updateUser: (...args: any[]) => mockUpdateUser(...args),
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
import { AdminPage } from '../../src/pages/AdminPage';
import EmployeesPage, { EmployeeTypes } from '../../src/pages/Employees';

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
    isProvider: false,
    isCustomerSupport: false,
    needsReview: false,
    ...overrides,
  };
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

  it('renders normally (no chip, no action buttons) when no users need review', async () => {
    mockGetEmployees.mockResolvedValue({
      message: 'ok',
      employees: [
        makeEmployee({ id: 'u1', firstName: 'Alice', lastName: 'Adams', email: 'alice@x.com' }),
        makeEmployee({ id: 'u2', firstName: 'Bob', lastName: 'Brown', email: 'bob@x.com' }),
      ],
    });

    render(<EmployeesPage employeeType={EmployeeTypes.employees} />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Adams, Alice')).toBeInTheDocument());
    expect(screen.queryByTestId(dataTestIds.employeesPage.needsReviewChip)).not.toBeInTheDocument();
    expect(screen.queryByTestId(dataTestIds.employeesPage.assignRoleButton)).not.toBeInTheDocument();
    expect(screen.queryByTestId(dataTestIds.employeesPage.quickDeactivateButton)).not.toBeInTheDocument();
  });

  it('sorts needsReview rows to the top and shows the Needs Review chip', async () => {
    mockGetEmployees.mockResolvedValue({
      message: 'ok',
      employees: [
        makeEmployee({ id: 'u1', firstName: 'Alice', lastName: 'Adams', email: 'alice@x.com' }),
        makeEmployee({
          id: 'u-review',
          firstName: '',
          lastName: '',
          name: 'pending@x.com',
          email: 'pending@x.com',
          profile: 'Patient/abc',
          needsReview: true,
        }),
        makeEmployee({ id: 'u2', firstName: 'Bob', lastName: 'Brown', email: 'bob@x.com' }),
      ],
    });

    render(<EmployeesPage employeeType={EmployeeTypes.employees} />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByTestId(dataTestIds.employeesPage.needsReviewChip)).toBeInTheDocument());

    const table = screen.getByTestId(dataTestIds.employeesPage.table);
    const bodyRows = within(table).getAllByRole('row').slice(1); // skip header
    expect(bodyRows[0]).toHaveTextContent('pending@x.com');
    expect(within(bodyRows[0]).getByTestId(dataTestIds.employeesPage.needsReviewChip)).toBeInTheDocument();

    // Normal rows stay unchanged (no chip)
    expect(within(bodyRows[1]).queryByTestId(dataTestIds.employeesPage.needsReviewChip)).not.toBeInTheDocument();
    expect(within(bodyRows[2]).queryByTestId(dataTestIds.employeesPage.needsReviewChip)).not.toBeInTheDocument();
  });

  it('assigning a role calls updateUser with the chosen role', async () => {
    const user = userEvent.setup();
    mockUpdateUser.mockResolvedValue({ message: 'ok' });
    mockGetEmployees.mockResolvedValue({
      message: 'ok',
      employees: [
        makeEmployee({
          id: 'u-review',
          firstName: '',
          lastName: '',
          name: 'pending@x.com',
          email: 'pending@x.com',
          profile: 'Patient/abc',
          needsReview: true,
        }),
      ],
    });

    render(<EmployeesPage employeeType={EmployeeTypes.employees} />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByTestId(dataTestIds.employeesPage.assignRoleButton)).toBeInTheDocument());
    await user.click(screen.getByTestId(dataTestIds.employeesPage.assignRoleButton));

    // Open the select and pick Staff
    await user.click(screen.getByRole('combobox', { name: /role/i }));
    await user.click(await screen.findByRole('option', { name: 'Staff' }));

    await user.click(screen.getByTestId(dataTestIds.dialog.proceedButton));

    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledTimes(1));
    expect(mockUpdateUser).toHaveBeenCalledWith(expect.anything(), {
      userId: 'u-review',
      selectedRoles: [RoleType.Staff],
    });
  });

  it('deactivating calls updateUser with Inactive role', async () => {
    const user = userEvent.setup();
    mockUpdateUser.mockResolvedValue({ message: 'ok' });
    mockGetEmployees.mockResolvedValue({
      message: 'ok',
      employees: [
        makeEmployee({
          id: 'u-review',
          firstName: '',
          lastName: '',
          name: 'pending@x.com',
          email: 'pending@x.com',
          profile: 'Patient/abc',
          needsReview: true,
        }),
      ],
    });

    render(<EmployeesPage employeeType={EmployeeTypes.employees} />, { wrapper: createWrapper() });

    await waitFor(() =>
      expect(screen.getByTestId(dataTestIds.employeesPage.quickDeactivateButton)).toBeInTheDocument()
    );
    await user.click(screen.getByTestId(dataTestIds.employeesPage.quickDeactivateButton));
    await user.click(await screen.findByTestId(dataTestIds.dialog.proceedButton));

    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledTimes(1));
    expect(mockUpdateUser).toHaveBeenCalledWith(expect.anything(), {
      userId: 'u-review',
      selectedRoles: [RoleType.Inactive],
    });
  });

  it('Providers tab excludes needsReview users', async () => {
    mockGetEmployees.mockResolvedValue({
      message: 'ok',
      employees: [
        makeEmployee({
          id: 'u-review',
          firstName: '',
          lastName: '',
          name: 'pending@x.com',
          email: 'pending@x.com',
          profile: 'Patient/abc',
          needsReview: true,
          isProvider: false,
        }),
        makeEmployee({
          id: 'u-prov',
          firstName: 'Pat',
          lastName: 'Provider',
          email: 'pat@x.com',
          isProvider: true,
        }),
      ],
    });

    render(<EmployeesPage employeeType={EmployeeTypes.providers} />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Provider, Pat')).toBeInTheDocument());
    expect(screen.queryByText('pending@x.com')).not.toBeInTheDocument();
    expect(screen.queryByTestId(dataTestIds.employeesPage.needsReviewChip)).not.toBeInTheDocument();
  });
});

describe('AdminPage Employees-tab badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasRole.mockReturnValue(true);
  });

  const renderAdminPage = (path = '/admin/employees'): ReturnType<typeof render> =>
    render(
      <Routes>
        <Route path="/admin/:adminTab" element={<AdminPage />} />
      </Routes>,
      { wrapper: createWrapper(path) }
    );

  it('shows a visible dot on the Employees tab when any users need review', async () => {
    mockGetEmployees.mockResolvedValue({
      message: 'ok',
      employees: [
        makeEmployee({ id: 'u-n1', needsReview: false }),
        makeEmployee({ id: 'u-r1', needsReview: true, profile: 'Patient/a' }),
        makeEmployee({ id: 'u-r2', needsReview: true, profile: 'Patient/b' }),
      ],
    });

    renderAdminPage();

    await waitFor(() => {
      const badge = screen.getByTestId(dataTestIds.employeesPage.needsReviewBadge);
      const badgeContent = badge.querySelector('.MuiBadge-badge');
      expect(badgeContent).not.toBeNull();
      expect(badgeContent?.className).not.toMatch(/MuiBadge-invisible/);
    });
  });

  it('hides the badge dot when there are zero pending-review users', async () => {
    mockGetEmployees.mockResolvedValue({
      message: 'ok',
      employees: [makeEmployee({ id: 'u-n1', needsReview: false })],
    });

    renderAdminPage();

    await waitFor(() => expect(screen.getByTestId(dataTestIds.employeesPage.needsReviewBadge)).toBeInTheDocument());
    const badge = screen.getByTestId(dataTestIds.employeesPage.needsReviewBadge);
    const badgeContent = badge.querySelector('.MuiBadge-badge');
    expect(badgeContent?.className).toMatch(/MuiBadge-invisible/);
  });
});
