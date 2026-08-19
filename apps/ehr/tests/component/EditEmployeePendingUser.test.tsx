import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { RoleType } from 'utils/lib/types/api/user.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// A user who signed up but was never set up as an employee has a Patient profile instead of a
// Practitioner one, and holds no roles. The list reports them as NEEDS REVIEW and links here; this
// page is where they get resolved — either finish setting them up, or delete the account. Neither
// works if the page treats "no roles" as "deactivated", which is what this suite guards.

const mockGetUserDetails = vi.fn<(...args: any[]) => Promise<any>>();
const mockDeleteUser = vi.fn<(...args: any[]) => Promise<any>>();

vi.mock('src/api/api', async (importOriginal) => ({
  ...((await importOriginal()) as any),
  getUserDetails: (...args: any[]) => mockGetUserDetails(...args),
  deleteUser: (...args: any[]) => mockDeleteUser(...args),
}));
vi.mock('../../src/api/api', async (importOriginal) => ({
  ...((await importOriginal()) as any),
  getUserDetails: (...args: any[]) => mockGetUserDetails(...args),
  deleteUser: (...args: any[]) => mockDeleteUser(...args),
}));

vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehr: {}, oystehrZambda: {} as any }) }));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehr: {}, oystehrZambda: {} as any }) }));

vi.mock('src/hooks/useEvolveUser', () => ({ default: () => ({ id: 'admin-1', hasRole: () => true }) }));
vi.mock('../../src/hooks/useEvolveUser', () => ({ default: () => ({ id: 'admin-1', hasRole: () => true }) }));

vi.mock('src/layout/PageContainer', () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock('../../src/layout/PageContainer', () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock('src/components/schedule/PractitionerRoleList', () => ({ default: () => null }));
vi.mock('../../src/components/schedule/PractitionerRoleList', () => ({ default: () => null }));

const mockEnqueueSnackbar = vi.fn();
vi.mock('notistack', async () => {
  const actual = (await vi.importActual('notistack')) as any;
  return { ...actual, enqueueSnackbar: (...args: any[]) => mockEnqueueSnackbar(...args) };
});

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = (await vi.importActual('react-router-dom')) as any;
  return { ...actual, useParams: () => ({ id: 'u-review' }), useNavigate: () => mockNavigate };
});

import { dataTestIds } from '../../src/constants/data-test-ids';
import EditEmployeePage from '../../src/pages/EditEmployee';

/** Signed up, never set up: Patient profile, no Practitioner, no roles. */
const PENDING_USER = {
  id: 'u-review',
  name: 'pending@x.com',
  email: 'pending@x.com',
  profile: 'Patient/abc',
  profileResource: undefined,
  roles: [],
};

const SET_UP_USER = {
  id: 'u-review',
  name: 'Jane Doe',
  email: 'jdoe@example.com',
  profile: 'Practitioner/prac-1',
  profileResource: { id: 'prac-1', resourceType: 'Practitioner' },
  roles: [{ id: 'role-provider', name: RoleType.Provider }],
};

const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })}
  >
    <MemoryRouter initialEntries={['/admin/employee/u-review']}>{children}</MemoryRouter>
  </QueryClientProvider>
);

describe('EditEmployeePage for a user who was never set up', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserDetails.mockResolvedValue({ message: 'ok', user: PENDING_USER, seenPatientRecently: false });
  });

  it('offers Delete rather than Deactivate, since there is no access to revoke', async () => {
    render(<EditEmployeePage />, { wrapper });

    expect(await screen.findByTestId(dataTestIds.employeesPage.deleteUserButton)).toBeInTheDocument();
    expect(screen.queryByTestId(dataTestIds.employeesPage.deactivateUserButton)).not.toBeInTheDocument();
  });

  it('flags the user as needing review, and does not mislabel them as Deactivated', async () => {
    render(<EditEmployeePage />, { wrapper });

    expect(await screen.findByTestId(dataTestIds.employeesPage.needsReviewChip)).toBeInTheDocument();
    // The list's Status column calls these users Active; holding no roles is "not set up yet", not
    // "deactivated", and the two pages must not disagree.
    expect(screen.queryByText('Deactivated')).not.toBeInTheDocument();
  });

  it('leaves the form editable so the missing role can actually be assigned', async () => {
    render(<EditEmployeePage />, { wrapper });

    // The whole point of linking here: fill in the details, tick a role, save. A disabled submit
    // would make the row a dead end again.
    const submit = await screen.findByTestId(dataTestIds.employeesPage.submitButton);
    expect(submit).toBeEnabled();
    expect(screen.getByTestId(dataTestIds.employeesPage.firstName).querySelector('input')).toBeEnabled();
    expect(
      screen.getByTestId(dataTestIds.employeesPage.roleRow(RoleType.Provider)).querySelector('input')
    ).toBeEnabled();
  });

  it('deletes the account and returns to the list once confirmed', async () => {
    const user = userEvent.setup();
    mockDeleteUser.mockResolvedValue({ message: 'ok' });

    render(<EditEmployeePage />, { wrapper });

    await user.click(await screen.findByTestId(dataTestIds.employeesPage.deleteUserButton));
    await user.click(await screen.findByTestId(dataTestIds.dialog.proceedButton));

    await waitFor(() => expect(mockDeleteUser).toHaveBeenCalledWith(expect.anything(), { userId: 'u-review' }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/admin/employees'));
  });

  it('shows Deactivate, not Delete, once the user has been set up', async () => {
    mockGetUserDetails.mockResolvedValue({ message: 'ok', user: SET_UP_USER, seenPatientRecently: false });

    render(<EditEmployeePage />, { wrapper });

    expect(await screen.findByTestId(dataTestIds.employeesPage.deactivateUserButton)).toBeInTheDocument();
    expect(screen.queryByTestId(dataTestIds.employeesPage.deleteUserButton)).not.toBeInTheDocument();
    expect(screen.queryByTestId(dataTestIds.employeesPage.needsReviewChip)).not.toBeInTheDocument();
  });
});
