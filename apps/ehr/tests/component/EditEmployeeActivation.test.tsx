import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { UserActivationZambdaOutput } from 'utils/lib/types/api/user-activation.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Deactivating a user also unenrolls their Practitioner from eRx, and that step is allowed to fail
// without failing the deactivation (the zambda returns `erxUnenrollment: 'failed'` with a 200). The
// page copy promises the prescriber enrollment is removed, so a 'failed' outcome must not be
// reported to the operator as a plain success.

const mockGetUserDetails = vi.fn<(...args: any[]) => Promise<any>>();
const mockUserActivation = vi.fn<(...args: any[]) => Promise<UserActivationZambdaOutput>>();

// Both specifier forms are mocked because the page imports these relatively while the rest of the
// app imports them through the `src/...` alias — same convention as Employees.test.tsx.
vi.mock('src/api/api', async (importOriginal) => ({
  ...((await importOriginal()) as any),
  getUserDetails: (...args: any[]) => mockGetUserDetails(...args),
  userActivation: (...args: any[]) => mockUserActivation(...args),
}));
vi.mock('../../src/api/api', async (importOriginal) => ({
  ...((await importOriginal()) as any),
  getUserDetails: (...args: any[]) => mockGetUserDetails(...args),
  userActivation: (...args: any[]) => mockUserActivation(...args),
}));

vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehr: {}, oystehrZambda: {} as any }) }));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehr: {}, oystehrZambda: {} as any }) }));

// The page shell and the sibling cards are irrelevant to the activation flow and drag in the
// sidebar / schedule / form stacks, so they're stubbed down to nothing.
vi.mock('src/layout/PageContainer', () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock('../../src/layout/PageContainer', () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock('src/components/EmployeeInformation', () => ({ default: () => null }));
vi.mock('../../src/components/EmployeeInformation', () => ({ default: () => null }));
vi.mock('src/components/schedule/PractitionerRoleList', () => ({ default: () => null }));
vi.mock('../../src/components/schedule/PractitionerRoleList', () => ({ default: () => null }));
vi.mock('src/components/CustomBreadcrumbs', () => ({ default: () => null }));
vi.mock('../../src/components/CustomBreadcrumbs', () => ({ default: () => null }));

const mockEnqueueSnackbar = vi.fn();
vi.mock('notistack', async () => {
  const actual = (await vi.importActual('notistack')) as any;
  return { ...actual, enqueueSnackbar: (...args: any[]) => mockEnqueueSnackbar(...args) };
});

vi.mock('react-router-dom', async () => {
  const actual = (await vi.importActual('react-router-dom')) as any;
  return { ...actual, useParams: () => ({ id: 'user-1' }) };
});

import { dataTestIds } from '../../src/constants/data-test-ids';
import EditEmployeePage from '../../src/pages/EditEmployee';

const ACTIVE_USER = {
  id: 'user-1',
  name: 'Jane Doe',
  email: 'jdoe@example.com',
  profile: 'Practitioner/prac-1',
  profileResource: { id: 'prac-1', resourceType: 'Practitioner' },
  roles: [{ id: 'role-provider', name: 'Provider' }],
};

const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
  <QueryClientProvider
    client={
      new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
      })
    }
  >
    <MemoryRouter initialEntries={['/admin/employee/user-1']}>{children}</MemoryRouter>
  </QueryClientProvider>
);

const clickDeactivate = async (): Promise<void> => {
  const button = await screen.findByTestId(dataTestIds.employeesPage.deactivateUserButton);
  await waitFor(() => expect(button).toHaveTextContent('Deactivate'));
  await userEvent.click(button);
};

describe('EditEmployeePage activation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserDetails.mockResolvedValue({ message: 'ok', user: ACTIVE_USER });
  });

  it('reports a plain success when the eRx unenrollment went through', async () => {
    mockUserActivation.mockResolvedValue({ message: 'User successfully deactivated.', erxUnenrollment: 'unenrolled' });

    render(<EditEmployeePage />, { wrapper });
    await clickDeactivate();

    await waitFor(() =>
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith('User was deactivated successfully', { variant: 'success' })
    );
    expect(mockEnqueueSnackbar).toHaveBeenCalledTimes(1);
  });

  it.each(['not-enrolled', 'not-configured', 'no-practitioner'] as const)(
    'reports a plain success for the non-failure outcome %s',
    async (erxUnenrollment) => {
      mockUserActivation.mockResolvedValue({ message: 'User successfully deactivated.', erxUnenrollment });

      render(<EditEmployeePage />, { wrapper });
      await clickDeactivate();

      await waitFor(() =>
        expect(mockEnqueueSnackbar).toHaveBeenCalledWith('User was deactivated successfully', { variant: 'success' })
      );
    }
  );

  it('warns the operator, and does not claim success, when the eRx unenrollment failed', async () => {
    mockUserActivation.mockResolvedValue({ message: 'User successfully deactivated.', erxUnenrollment: 'failed' });

    render(<EditEmployeePage />, { wrapper });
    await clickDeactivate();

    await waitFor(() => expect(mockEnqueueSnackbar).toHaveBeenCalled());
    const [message, options] = mockEnqueueSnackbar.mock.calls[0];
    // Both halves of the outcome have to be in the message: access was revoked, eRx was not.
    expect(message).toContain('User was deactivated');
    expect(message).toContain('eRx prescriber enrollment could not be removed');
    // Persisted rather than auto-hidden — this one needs follow-up.
    expect(options).toMatchObject({ variant: 'warning', persist: true });
    // No competing success toast.
    expect(mockEnqueueSnackbar).toHaveBeenCalledTimes(1);
    expect(mockEnqueueSnackbar).not.toHaveBeenCalledWith(
      expect.stringContaining('successfully'),
      expect.objectContaining({ variant: 'success' })
    );
  });

  it('still reports failure the usual way when the deactivation itself fails', async () => {
    mockUserActivation.mockRejectedValue(new Error('boom'));

    render(<EditEmployeePage />, { wrapper });
    await clickDeactivate();

    await waitFor(() =>
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Failed to deactivate user. Please try again', {
        variant: 'error',
      })
    );
  });
});
