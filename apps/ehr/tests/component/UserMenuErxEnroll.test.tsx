import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { enqueueSnackbar } from 'notistack';
import { MemoryRouter } from 'react-router-dom';
import { RoleType } from 'utils/lib/types/api/user.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserMenu } from '../../src/components/navigation/UserMenu';
import { dataTestIds } from '../../src/constants/data-test-ids';

const mocks = vi.hoisted(() => ({
  surescripts: false,
  roles: [] as string[],
  checkPractitionerEnrollment: vi.fn(),
  enrollPractitioner: vi.fn(),
  listScheduleOwners: vi.fn(),
  listActiveLocations: vi.fn(),
  oldCheck: vi.fn(),
  oldEnroll: vi.fn(),
}));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));
vi.mock('../../src/constants/feature-flags', () => ({
  FEATURE_FLAGS: {
    get SURESCRIPTS_ERX_ENABLED() {
      return mocks.surescripts;
    },
    EMPLOYEE_CHAT_ENABLED: false,
  },
}));
vi.mock('src/api/api', () => ({
  checkPractitionerEnrollment: mocks.checkPractitionerEnrollment,
  enrollPractitioner: mocks.enrollPractitioner,
  listScheduleOwners: mocks.listScheduleOwners,
  listActiveLocations: mocks.listActiveLocations,
}));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {}, oystehr: {} }) }));
vi.mock('src/hooks/useAuthToken', () => ({ useAuthToken: () => 'user-token' }));
const user = {
  name: 'Ann Lee',
  email: 'ann@example.com',
  // A complete profile: the old enrollment needs every field.
  profileResource: {
    resourceType: 'Practitioner',
    id: 'practitioner-1',
    name: [{ given: ['Ann'], family: 'Lee' }],
    birthDate: '1980-01-01',
    telecom: [
      { system: 'phone', value: '5125550100' },
      { system: 'fax', value: '5125550101' },
    ],
    address: [{ line: ['1 Main St'], city: 'Austin', state: 'TX', postalCode: '78701' }],
    identifier: [{ system: 'http://hl7.org/fhir/sid/us-npi', value: '1234567893' }],
  },
  hasRole: (roles: string[]) => roles.some((role) => mocks.roles.includes(role)),
};
vi.mock('src/hooks/useEvolveUser', () => ({ default: () => user }));
vi.mock('src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useCheckPractitionerEnrollment: (options: { enabled: boolean }) => mocks.oldCheck(options),
  useEnrollPractitionerToERX: () => ({ mutateAsync: mocks.oldEnroll, isPending: false }),
  useConnectPractitionerToERX: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('src/components/CommandPaletteSearchButton', () => ({ CommandPaletteSearchButton: () => null }));
vi.mock('src/features/employee-chat/EmployeeChatButton', () => ({ EmployeeChatButton: () => null }));
vi.mock('src/features/external-labs/components/unsolicited-results/UnsolicitedResultsIcon', () => ({
  UnsolicitedResultsIcon: () => null,
}));
vi.mock('src/features/notifications/ProviderNotifications', () => ({ ProviderNotifications: () => null }));
vi.mock('../../src/components/dialogs/PendingErxEnrollmentDialog', () => ({ PendingErxEnrollmentDialog: () => null }));

const openMenu = async (): Promise<ReturnType<typeof userEvent.setup>> => {
  const events = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>
    </QueryClientProvider>
  );
  await events.click(screen.getByTestId(dataTestIds.header.userName));
  await screen.findByText('My Profile');
  return events;
};

// Review item 100: with the eRx v4 flag on, the user menu enrolls a provider in eRx v4 before their first visit, with
// the eRx (Surescripts) page's location rule. Only providers see it, as before; with the flag off nothing changes.
describe('User menu: Enroll in eRX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.oldCheck.mockReturnValue({
      data: { identityVerified: false },
      isFetched: true,
      refetch: vi.fn().mockResolvedValue({ data: { registered: true, confirmed: false } }),
    });
    mocks.checkPractitionerEnrollment.mockResolvedValue({ registered: false });
    mocks.enrollPractitioner.mockResolvedValue({ registered: true });
    mocks.listScheduleOwners.mockResolvedValue({
      list: [
        {
          owner: { id: 'practitioner-1' },
          schedules: [{ locationId: 'location-2', locationName: 'Westside', active: true }],
        },
      ],
    });
    mocks.listActiveLocations.mockResolvedValue({
      locations: [
        { id: 'location-1', name: 'Downtown' },
        { id: 'location-2', name: 'Westside' },
      ],
    });
  });

  describe('flag on', () => {
    beforeEach(() => {
      mocks.surescripts = true;
    });

    it('enrolls a provider who isn’t registered in eRx v4, at their schedule’s location', async () => {
      mocks.roles = [RoleType.Provider];
      const events = await openMenu();
      expect(mocks.oldCheck).toHaveBeenCalledWith({ enabled: false });
      await events.click(await screen.findByText('Enroll in eRX'));
      await waitFor(() =>
        expect(mocks.enrollPractitioner).toHaveBeenCalledWith('user-token', 'practitioner-1', 'location-2')
      );
      expect(mocks.checkPractitionerEnrollment).toHaveBeenCalledWith('user-token', 'practitioner-1');
      expect(mocks.oldEnroll).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(enqueueSnackbar).toHaveBeenCalledWith('Enrolled in Surescripts', { variant: 'success' })
      );
    });

    it('shows the eRx service’s reason when enrollment fails', async () => {
      mocks.roles = [RoleType.Provider];
      mocks.enrollPractitioner.mockRejectedValue(new Error('Practitioner NPI is missing'));
      const events = await openMenu();
      await events.click(await screen.findByText('Enroll in eRX'));
      await waitFor(() =>
        expect(enqueueSnackbar).toHaveBeenCalledWith('Practitioner NPI is missing', { variant: 'error' })
      );
    });

    // Audit r5 flag 5: eRx v4's refusal for a profile with no first or last name, in plain words, with no record id.
    it('says in plain words when eRx v4 finds no first or last name', async () => {
      const { enrollPractitioner } = await vi.importActual<typeof import('src/api/api')>('src/api/api');
      mocks.enrollPractitioner.mockImplementation(enrollPractitioner);
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response(JSON.stringify({ message: 'Practitioner 1f3c-77 must have a first and last name' }), {
              status: 400,
            })
        )
      );
      mocks.roles = [RoleType.Provider];
      const events = await openMenu();
      await events.click(await screen.findByText('Enroll in eRX'));
      await waitFor(() =>
        expect(enqueueSnackbar).toHaveBeenCalledWith(
          'Your profile is missing a first or last name. Ask an administrator to add it.',
          { variant: 'error' }
        )
      );
      vi.unstubAllGlobals();
    });

    it('hides it once the provider is registered in eRx v4', async () => {
      mocks.roles = [RoleType.Provider];
      mocks.checkPractitionerEnrollment.mockResolvedValue({ registered: true });
      await openMenu();
      await waitFor(() => expect(mocks.checkPractitionerEnrollment).toHaveBeenCalled());
      expect(screen.queryByText('Enroll in eRX')).not.toBeInTheDocument();
    });

    it('hides it from anyone who isn’t a provider, and doesn’t check their enrollment', async () => {
      mocks.roles = [RoleType.Staff, RoleType.Administrator];
      await openMenu();
      expect(screen.queryByText('Enroll in eRX')).not.toBeInTheDocument();
      expect(mocks.checkPractitionerEnrollment).not.toHaveBeenCalled();
    });
  });

  describe('flag off', () => {
    beforeEach(() => {
      mocks.surescripts = false;
    });

    it('enrolls a provider with the old enrollment, and never calls eRx v4', async () => {
      mocks.roles = [RoleType.Provider];
      const events = await openMenu();
      expect(mocks.oldCheck).toHaveBeenCalledWith({ enabled: true });
      await events.click(screen.getByText('Enroll in eRX'));
      await waitFor(() => expect(mocks.oldEnroll).toHaveBeenCalledWith('practitioner-1'));
      expect(mocks.checkPractitionerEnrollment).not.toHaveBeenCalled();
      expect(mocks.enrollPractitioner).not.toHaveBeenCalled();
    });

    it('hides it from anyone who isn’t a provider', async () => {
      mocks.roles = [RoleType.Staff];
      await openMenu();
      expect(screen.queryByText('Enroll in eRX')).not.toBeInTheDocument();
    });
  });
});
