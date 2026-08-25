import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { RoleType } from 'utils/lib/types/api/user.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// My Profile carries two unrelated things about the signed-in user behind tabs: their employee
// record (name, contact, credentials — written by update-user) and their notification preferences
// (written by the preferences mutation). Each tab keeps its own save, so neither can be committed
// as a side effect of the other.

const mockGetUserDetails = vi.fn<(...args: any[]) => Promise<any>>();

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
const SIGNED_IN_USER = {
  id: 'me-1',
  name: 'Jane Cooper',
  email: 'jane@example.com',
  profile: 'Practitioner/prac-1',
  profileResource: { id: 'prac-1', resourceType: 'Practitioner' },
  roles: [{ id: 'r-provider', name: RoleType.Provider }],
};
vi.mock('src/hooks/useEvolveUser', () => ({
  default: () => ({ ...SIGNED_IN_USER, hasRole: mockHasRole }),
}));
vi.mock('../../src/hooks/useEvolveUser', () => ({
  default: () => ({ ...SIGNED_IN_USER, hasRole: mockHasRole }),
}));

// The notification tab's own data sources; this suite is about the tab shell and the profile tab.
vi.mock('src/features/notifications/notifications.queries', () => ({
  useGetAllLocations: () => ({ data: [], isLoading: false }),
  useUpdateProviderNotificationPreferencesV2Mutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('src/features/notifications/NotificationSettingsTable', () => ({ default: () => null }));

vi.mock('src/layout/PageContainer', () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock('../../src/layout/PageContainer', () => ({ default: ({ children }: { children: ReactNode }) => children }));

vi.mock('notistack', async () => {
  const actual = (await vi.importActual('notistack')) as any;
  return { ...actual, enqueueSnackbar: vi.fn() };
});

import { dataTestIds } from '../../src/constants/data-test-ids';
import EmployeeProfilePage from '../../src/pages/EmployeeProfilePage';

const renderPage = (initialPath = '/profile'): void => {
  const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  render(<EmployeeProfilePage />, { wrapper });
};

describe('My Profile tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasRole.mockReturnValue(false);
    mockGetUserDetails.mockResolvedValue({ message: 'ok', user: SIGNED_IN_USER, seenPatientRecently: false });
  });

  it('opens on the Profile tab showing the signed-in user’s own record', async () => {
    renderPage();

    await waitFor(() => expect(mockGetUserDetails).toHaveBeenCalledWith(expect.anything(), { userId: 'me-1' }));
    expect(await screen.findByTestId(dataTestIds.employeesPage.informationForm)).toBeInTheDocument();
  });

  it('honours ?tab=notifications so the tab can be linked to', async () => {
    renderPage('/profile?tab=notifications');

    expect(await screen.findByText('Notification Settings', { selector: 'button' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.queryByTestId(dataTestIds.employeesPage.informationForm)).not.toBeInTheDocument();
  });

  it('switches between the two tabs', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByTestId(dataTestIds.employeesPage.informationForm);
    await user.click(screen.getByTestId(dataTestIds.myProfilePage.notificationsTab));

    await waitFor(() =>
      expect(screen.queryByTestId(dataTestIds.employeesPage.informationForm)).not.toBeInTheDocument()
    );

    await user.click(screen.getByTestId(dataTestIds.myProfilePage.profileTab));
    expect(await screen.findByTestId(dataTestIds.employeesPage.informationForm)).toBeInTheDocument();
  });

  it('shows roles, disabled, with the reason — a user can see their role but not grant themselves one', async () => {
    renderPage();

    await screen.findByTestId(dataTestIds.employeesPage.informationForm);
    expect(screen.getByTestId(dataTestIds.employeesPage.roleEditPermissionHint)).toHaveTextContent(
      'Only an administrator can update your role.'
    );
    expect(
      screen.getByTestId(dataTestIds.employeesPage.roleRow(RoleType.Administrator)).querySelector('input')
    ).toBeDisabled();
  });

  it('drops the hint for an admin, who can use the checkboxes on their own record', async () => {
    mockHasRole.mockReturnValue(true);
    renderPage();

    await screen.findByTestId(dataTestIds.employeesPage.informationForm);
    expect(screen.queryByTestId(dataTestIds.employeesPage.roleEditPermissionHint)).not.toBeInTheDocument();
  });
});
