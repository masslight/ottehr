import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Location } from 'fhir/r4b';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL,
  SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { RoleType } from 'utils/lib/types/api/user.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Regression cover for the payment-tier fields on Location config.
//
// The Stripe field moved onto this page when the Payment Locations page was retired, but the save
// payload wasn't updated with it — so edits were dropped silently: a clean 200, every other field
// saved, and the backend never even saw the key. The old page's tests were deleted along with it,
// which is why nothing caught it. These pin the payload itself.

const mockUpdateLocation = vi.fn<(...args: any[]) => Promise<Location>>();
const mockGetLocation = vi.fn<(...args: any[]) => Promise<Location>>();

vi.mock('src/api/api', async (importOriginal) => ({
  ...((await importOriginal()) as any),
  updateLocation: (...args: any[]) => mockUpdateLocation(...args),
  getLocation: (...args: any[]) => mockGetLocation(...args),
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehr: {} as any, oystehrZambda: {} as any }),
}));

const mockHasRole = vi.fn<(roles: RoleType[]) => boolean>(() => true);
vi.mock('src/hooks/useEvolveUser', () => ({ default: () => ({ id: 'u-1', hasRole: mockHasRole }) }));
vi.mock('../../src/hooks/useEvolveUser', () => ({ default: () => ({ id: 'u-1', hasRole: mockHasRole }) }));

// Stripe Connect status / terminal readers do their own network work and aren't under test here.
vi.mock('src/features/locations/LocationPaymentsSection', () => ({ default: () => null }));

vi.mock('react-router-dom', async () => {
  const actual = (await vi.importActual('react-router-dom')) as any;
  return { ...actual, useParams: () => ({ 'location-id': 'loc-1' }), useNavigate: () => vi.fn() };
});

vi.mock('notistack', async () => {
  const actual = (await vi.importActual('notistack')) as any;
  return { ...actual, enqueueSnackbar: vi.fn() };
});

import LocationConfigPage from '../../src/features/locations/LocationConfigPage';

const EXISTING_STRIPE = 'acct_1AAAAAAAAAAAAAAA';
const EXISTING_ADVAPACS = '11111111-1111-1111-1111-111111111111';

const location: Location = {
  resourceType: 'Location',
  id: 'loc-1',
  name: 'Test Clinic',
  status: 'active',
  extension: [
    { url: SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL, valueString: EXISTING_STRIPE },
    { url: SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL, valueString: EXISTING_ADVAPACS },
  ],
};

const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })}
  >
    <MemoryRouter initialEntries={['/admin/locations/loc-1']}>{children}</MemoryRouter>
  </QueryClientProvider>
);

const stripeInput = (): HTMLInputElement => screen.getByLabelText(/Stripe Account ID/i) as HTMLInputElement;

const save = async (): Promise<Record<string, any>> => {
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(mockUpdateLocation).toHaveBeenCalledTimes(1));
  return mockUpdateLocation.mock.calls[0][0];
};

describe('LocationConfigPage payment fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasRole.mockReturnValue(true);
    mockGetLocation.mockResolvedValue(location);
    mockUpdateLocation.mockResolvedValue(location);
  });

  it('sends an edited Stripe account ID', async () => {
    render(<LocationConfigPage />, { wrapper });
    await waitFor(() => expect(stripeInput()).toHaveValue(EXISTING_STRIPE));

    await userEvent.clear(stripeInput());
    await userEvent.type(stripeInput(), 'acct_1BBBBBBBBBBBBBBB');

    expect(await save()).toMatchObject({ locationId: 'loc-1', stripeAccountId: 'acct_1BBBBBBBBBBBBBBB' });
  });

  it('sends the unchanged Stripe account ID rather than dropping it', async () => {
    // The payload is a full replacement, so omitting an untouched field is what silently reverted
    // edits before — the key has to be present on every save, not only when it changed.
    render(<LocationConfigPage />, { wrapper });
    await waitFor(() => expect(stripeInput()).toHaveValue(EXISTING_STRIPE));

    expect(await save()).toMatchObject({ stripeAccountId: EXISTING_STRIPE });
  });

  it('sends null when the Stripe account ID is cleared, so it can be unset', async () => {
    render(<LocationConfigPage />, { wrapper });
    await waitFor(() => expect(stripeInput()).toHaveValue(EXISTING_STRIPE));

    await userEvent.clear(stripeInput());

    expect(await save()).toMatchObject({ stripeAccountId: null });
  });

  it('still sends the advapacs ID alongside it', async () => {
    render(<LocationConfigPage />, { wrapper });
    await waitFor(() => expect(stripeInput()).toHaveValue(EXISTING_STRIPE));

    expect(await save()).toMatchObject({ advapacsLocationId: EXISTING_ADVAPACS });
  });

  it('omits both payment keys entirely for a caller who cannot edit them', async () => {
    // Not merely "does not change them": the zambda rejects the whole request when either key is
    // present without Customer Support, so sending them would break every save by other roles.
    mockHasRole.mockImplementation((roles: RoleType[]) => !roles.includes(RoleType.CustomerSupport));

    render(<LocationConfigPage />, { wrapper });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument());

    const payload = await save();
    expect(payload).not.toHaveProperty('stripeAccountId');
    expect(payload).not.toHaveProperty('advapacsLocationId');
  });
});
