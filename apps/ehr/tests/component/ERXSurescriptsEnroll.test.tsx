import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { RoleType } from 'utils/lib/types/api/user.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ERXSurescriptsBody } from '../../src/features/visits/in-person/components/erx/ERXSurescriptsBody';

const mocks = vi.hoisted(() => ({
  roles: [] as string[],
  checkPractitionerEnrollment: vi.fn(),
  erxSavedForm: vi.fn(),
}));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));
vi.mock('src/api/api', () => ({
  checkPractitionerEnrollment: (...args: unknown[]) => mocks.checkPractitionerEnrollment(...args),
  erxSavedForm: (...args: unknown[]) => mocks.erxSavedForm(...args),
}));
vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ encounter: { resourceType: 'Encounter', id: 'encounter-1' } }),
}));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {} }) }));
vi.mock('src/hooks/useAuthToken', () => ({ useAuthToken: () => 'user-token' }));
vi.mock('src/hooks/useEvolveUser', () => ({
  default: () => ({
    profileResource: { resourceType: 'Practitioner', id: 'practitioner-1' },
    hasRole: (roles: string[]) => roles.some((role) => mocks.roles.includes(role)),
  }),
}));
vi.mock('../../src/features/visits/shared/components/PageTitle', () => ({ PageTitle: () => null }));
vi.mock('../../src/features/visits/in-person/components/erx/OrderPrescriptionForm', () => ({
  OrderPrescriptionForm: ({ notEnrolled, saved }: { notEnrolled?: boolean; saved?: { savedBy?: string } | null }) => (
    <div data-testid="order-form">
      {notEnrolled ? 'form: not enrolled' : 'form: enrolled'}
      {saved && `, saved by ${saved.savedBy}`}
    </div>
  ),
}));
vi.mock('../../src/features/visits/in-person/components/erx/PrescriptionTable', () => ({
  PrescriptionTable: () => <div>Ordered prescriptions</div>,
}));

const renderBody = (): void => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ERXSurescriptsBody />
    </QueryClientProvider>
  );
};

// Review item 100: only a provider enrolls in eRx v4, on this page as in the user menu.
describe('eRx (Surescripts) page: Enroll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.checkPractitionerEnrollment.mockResolvedValue({ registered: false });
    mocks.erxSavedForm.mockResolvedValue({ saved: null });
  });

  it('offers Enroll to a provider who isn’t registered', async () => {
    mocks.roles = [RoleType.Provider];
    renderBody();
    expect(await screen.findByText('You are not enrolled in Surescripts e-prescribing.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enroll' })).toBeInTheDocument();
  });

  it('doesn’t offer Enroll to anyone who isn’t a provider', async () => {
    mocks.roles = [RoleType.Staff, RoleType.Administrator];
    renderBody();
    expect(await screen.findByText('You are not enrolled in Surescripts e-prescribing.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enroll' })).not.toBeInTheDocument();
  });

  // Review item 109: eRx v4 answers the check with 403 for a role it gives no eRx access, which isn't an outage.
  it('reads eRx v4’s 403 on the check as not enrolled', async () => {
    const { checkPractitionerEnrollment } = await vi.importActual<typeof import('src/api/api')>('src/api/api');
    mocks.checkPractitionerEnrollment.mockImplementation(checkPractitionerEnrollment);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: 'Forbidden', code: '4031' }), { status: 403 }))
    );
    mocks.roles = [RoleType.Staff];
    renderBody();
    expect(await screen.findByText('You are not enrolled in Surescripts e-prescribing.')).toBeInTheDocument();
    expect(screen.queryByText(/Unable to check your Surescripts registration/)).not.toBeInTheDocument();
  });
});

// Requirement 53a: someone not enrolled fills in the form for a provider to send, still without the table.
describe('eRx (Surescripts) page: saving for the provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.roles = [RoleType.Staff];
    mocks.erxSavedForm.mockResolvedValue({ saved: null });
  });

  it('shows the order form to someone not enrolled, to save, without the table', async () => {
    mocks.checkPractitionerEnrollment.mockResolvedValue({ registered: false });
    renderBody();
    expect(await screen.findByText('form: not enrolled')).toBeInTheDocument();
    expect(screen.getByText('You are not enrolled in Surescripts e-prescribing.')).toBeInTheDocument();
    expect(screen.queryByText('Ordered prescriptions')).not.toBeInTheDocument();
  });

  it('shows an enrolled prescriber the form and the table', async () => {
    mocks.checkPractitionerEnrollment.mockResolvedValue({ registered: true });
    renderBody();
    expect(await screen.findByText('form: enrolled')).toBeInTheDocument();
    expect(screen.getByText('Ordered prescriptions')).toBeInTheDocument();
  });

  it("opens the form with the visit's saved form, loaded by the visit only", async () => {
    mocks.checkPractitionerEnrollment.mockResolvedValue({ registered: true });
    mocks.erxSavedForm.mockResolvedValue({
      saved: { form: { pharmacy: null, lines: [] }, savedBy: 'Jamie Rivera', savedAt: '2026-11-18T17:31:00Z' },
    });
    renderBody();
    expect(await screen.findByText('form: enrolled, saved by Jamie Rivera')).toBeInTheDocument();
    expect(mocks.erxSavedForm).toHaveBeenCalledWith(expect.anything(), { action: 'get', encounterId: 'encounter-1' });
  });
});
