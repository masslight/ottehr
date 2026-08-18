import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { RoleType } from 'utils/lib/types/api/user.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `/my-record` renders the same page as `/admin/employee/:id` with `self`, so the checks that matter
// are the ones that separate the two: whose record is loaded, and which admin-only surfaces are
// suppressed. Role assignment is not covered here — RoleSelection gates that on the caller's role
// independently of this flag, and the zambda refuses it regardless.

const mockGetUserDetails = vi.fn<(...args: any[]) => Promise<any>>();

// Both specifier forms are mocked because the page imports these relatively while the rest of the
// app imports them through the `src/...` alias — same convention as Employees.test.tsx.
vi.mock('src/api/api', async (importOriginal) => ({
  ...((await importOriginal()) as any),
  getUserDetails: (...args: any[]) => mockGetUserDetails(...args),
}));
vi.mock('../../src/api/api', async (importOriginal) => ({
  ...((await importOriginal()) as any),
  getUserDetails: (...args: any[]) => mockGetUserDetails(...args),
}));

vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehr: {}, oystehrZambda: {} as any }) }));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehr: {}, oystehrZambda: {} as any }) }));

const mockHasRole = vi.fn(() => false);
vi.mock('src/hooks/useEvolveUser', () => ({
  default: () => ({ id: 'signed-in-user', hasRole: mockHasRole }),
}));
vi.mock('../../src/hooks/useEvolveUser', () => ({
  default: () => ({ id: 'signed-in-user', hasRole: mockHasRole }),
}));

vi.mock('src/layout/PageContainer', () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock('../../src/layout/PageContainer', () => ({ default: ({ children }: { children: ReactNode }) => children }));
// The form and schedule card drag in heavy stacks; this suite is about the page shell.
vi.mock('src/components/EmployeeInformation', () => ({ default: () => null }));
vi.mock('../../src/components/EmployeeInformation', () => ({ default: () => null }));
vi.mock('src/components/schedule/PractitionerRoleList', () => ({
  default: () => <div data-testid="practitioner-role-list" />,
}));
vi.mock('../../src/components/schedule/PractitionerRoleList', () => ({
  default: () => <div data-testid="practitioner-role-list" />,
}));

// The admin route carries the user id as a param; `self` mode has to ignore it and use the signed-in
// user instead, so both cases resolve to the same record and only the flag differs.
vi.mock('react-router-dom', async () => {
  const actual = (await vi.importActual('react-router-dom')) as any;
  return { ...actual, useParams: () => ({ id: 'signed-in-user' }) };
});

import { dataTestIds } from '../../src/constants/data-test-ids';
import EditEmployeePage from '../../src/pages/EditEmployee';

const USER = {
  id: 'signed-in-user',
  name: 'Jane Doe',
  email: 'jdoe@example.com',
  profile: 'Practitioner/prac-1',
  profileResource: { id: 'prac-1', resourceType: 'Practitioner' },
  roles: [{ id: 'role-provider', name: RoleType.Provider }],
};

const makeWrapper =
  (initialPath: string) =>
  ({ children }: { children: ReactNode }): JSX.Element => (
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );

const wrapper = makeWrapper('/my-record');
const adminWrapper = makeWrapper('/admin/employee/signed-in-user');

describe('EditEmployeePage self-service mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasRole.mockReturnValue(false);
    mockGetUserDetails.mockResolvedValue({ message: 'ok', user: USER, seenPatientRecently: false });
  });

  it("loads the signed-in user's own record without an id in the URL", async () => {
    render(<EditEmployeePage self />, { wrapper });

    await waitFor(() => expect(mockGetUserDetails).toHaveBeenCalled());
    expect(mockGetUserDetails).toHaveBeenCalledWith(expect.anything(), { userId: 'signed-in-user' });
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
  });

  it('hides the admin-only surfaces a user must not have over their own account', async () => {
    render(<EditEmployeePage self />, { wrapper });

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
    // Deactivating yourself is nonsense, and schedule assignment is a scheduling-admin task.
    expect(screen.queryByTestId(dataTestIds.employeesPage.deactivateUserButton)).not.toBeInTheDocument();
    expect(screen.queryByTestId('practitioner-role-list')).not.toBeInTheDocument();
    // No breadcrumb back to an employee list this user cannot open.
    expect(screen.queryByText('Employees')).not.toBeInTheDocument();
  });

  it('offers a way back to notification settings, which live on the other self-service page', async () => {
    render(<EditEmployeePage self />, { wrapper });

    const link = await screen.findByRole('link', { name: /notification settings/i });
    expect(link).toHaveAttribute('href', '/profile');
  });

  it('keeps the admin-only surfaces when the same page is rendered without `self`', async () => {
    render(<EditEmployeePage />, { wrapper: adminWrapper });

    // Same mocks, same user, same page — the only difference is the flag, so anything that appears
    // here and not above is suppressed by `self` rather than by the test setup.
    expect(await screen.findByTestId(dataTestIds.employeesPage.deactivateUserButton)).toBeInTheDocument();
    expect(screen.getByTestId('practitioner-role-list')).toBeInTheDocument();
    expect(screen.getByText('Employees')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /notification settings/i })).not.toBeInTheDocument();
  });
});
