import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { RoleType, User } from 'utils/lib/types/api/user.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The role checkboxes only render AVAILABLE_EMPLOYEE_ROLES, but the form submits whatever roles the
// user already held. Anything not shown is therefore invisible state being round-tripped, and it has
// to be handled deliberately: non-employee roles must be dropped, real-but-unlisted roles must not.

const mockUpdateUser = vi.fn<(...args: any[]) => Promise<any>>();

vi.mock('src/api/api', async (importOriginal) => ({
  ...((await importOriginal()) as any),
  updateUser: (...args: any[]) => mockUpdateUser(...args),
}));
vi.mock('../../src/api/api', async (importOriginal) => ({
  ...((await importOriginal()) as any),
  updateUser: (...args: any[]) => mockUpdateUser(...args),
}));

vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehr: {}, oystehrZambda: {} as any }) }));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehr: {}, oystehrZambda: {} as any }) }));

vi.mock('src/hooks/useEvolveUser', () => ({ default: () => ({ id: 'admin-1', hasRole: () => true }) }));
vi.mock('../../src/hooks/useEvolveUser', () => ({ default: () => ({ id: 'admin-1', hasRole: () => true }) }));

vi.mock('notistack', async () => {
  const actual = (await vi.importActual('notistack')) as any;
  return { ...actual, enqueueSnackbar: vi.fn() };
});

import EmployeeInformationForm from '../../src/components/EmployeeInformation';
import { dataTestIds } from '../../src/constants/data-test-ids';

const makeUser = (roles: { id: string; name: string }[]): User =>
  ({
    id: 'u-1',
    name: 'pending@x.com',
    email: 'pending@x.com',
    profile: 'Patient/abc',
    roles,
  }) as unknown as User;

const renderForm = (user: User): void => {
  const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );

  render(
    <EmployeeInformationForm
      submitLabel="Save changes"
      existingUser={user}
      isActive={true}
      licenses={[]}
      seenPatientRecently={false}
      getUserAndUpdatePage={async () => undefined}
    />,
    { wrapper }
  );
};

const saveWithNames = async (): Promise<void> => {
  const user = userEvent.setup();
  await user.type(screen.getByTestId(dataTestIds.employeesPage.firstName).querySelector('input')!, 'Jane');
  await user.type(screen.getByTestId(dataTestIds.employeesPage.lastName).querySelector('input')!, 'Doe');
  await user.click(screen.getByTestId(dataTestIds.employeesPage.submitButton));
};

describe('EmployeeInformationForm role submission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateUser.mockResolvedValue({ message: 'ok' });
  });

  it('drops the Patient role when converting a self-registered user to staff', async () => {
    const user = userEvent.setup();
    renderForm(makeUser([{ id: 'r-patient', name: 'Patient' }]));

    await user.click(screen.getByTestId(dataTestIds.employeesPage.roleRow(RoleType.Clinician)).querySelector('input')!);
    await saveWithNames();

    // Submitting 'Patient' failed validation outright: it isn't an employee role, and this is the
    // moment it should fall away — the zambda deletes the orphaned Patient resource too.
    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledTimes(1));
    expect(mockUpdateUser.mock.calls[0][1].selectedRoles).toEqual([RoleType.Clinician]);
  });

  it('keeps every role the user already held when an unrelated field is edited', async () => {
    // Deliberately not Provider: that makes NPI a required input, so an empty one blocks submission
    // and the test would be measuring NPI validation rather than role handling.
    renderForm(
      makeUser([
        { id: 'r-manager', name: RoleType.Manager },
        { id: 'r-staff', name: RoleType.Staff },
      ])
    );

    await saveWithNames();

    // The filter guarding against `Patient` must not become a filter that quietly drops roles: the
    // form submits the full role set on every save, so editing a name would otherwise demote someone.
    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledTimes(1));
    expect(mockUpdateUser.mock.calls[0][1].selectedRoles).toEqual(
      expect.arrayContaining([RoleType.Manager, RoleType.Staff])
    );
  });

  it('passes the Inactive role through rather than reactivating someone as a side effect', async () => {
    renderForm(
      makeUser([
        { id: 'r-staff', name: RoleType.Staff },
        { id: 'r-inactive', name: RoleType.Inactive },
      ])
    );

    await saveWithNames();

    // Inactive is a real role with no checkbox. Whether saving a deactivated user reactivates them
    // is the zambda's call — the form shouldn't decide it by silently dropping the role here.
    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledTimes(1));
    expect(mockUpdateUser.mock.calls[0][1].selectedRoles).toContain(RoleType.Inactive);
  });
});
