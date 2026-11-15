import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { RoleType } from 'utils/lib/types/api/user.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ERXSurescriptsBody } from '../../src/features/visits/in-person/components/erx/ERXSurescriptsBody';

const mocks = vi.hoisted(() => ({ roles: [] as string[], checkPractitionerEnrollment: vi.fn() }));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));
vi.mock('src/api/api', () => ({ checkPractitionerEnrollment: mocks.checkPractitionerEnrollment }));
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
  OrderPrescriptionForm: () => null,
}));
vi.mock('../../src/features/visits/in-person/components/erx/PrescriptionTable', () => ({
  PrescriptionTable: () => null,
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
    mocks.checkPractitionerEnrollment.mockResolvedValue({ registered: false });
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
});
