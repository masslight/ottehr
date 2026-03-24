import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Location } from 'fhir/r4b';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'loc-1' }),
  };
});

const mockPaymentLocationsData = vi.fn();
const mockStripeAccountInfoData = vi.fn();
const mockTerminalReadersData = vi.fn();
const mockSaveMutate = vi.fn();

vi.mock('src/rcm/state/payments/payments.queries', () => ({
  usePaymentLocationsQuery: () => mockPaymentLocationsData(),
  useStripeAccountInfoQuery: () => mockStripeAccountInfoData(),
  useTerminalReadersQuery: () => mockTerminalReadersData(),
  useSaveTerminalLocationMutation: () => ({
    mutate: mockSaveMutate,
    isPending: false,
  }),
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehr: null,
    oystehrZambda: null,
  }),
}));

import PaymentLocationDetailPage from '../../src/pages/PaymentLocationDetailPage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLocation(overrides?: Partial<Location>): Location {
  return {
    resourceType: 'Location',
    id: 'loc-1',
    status: 'active',
    name: 'Main Office',
    address: {
      line: ['123 Main St'],
      city: 'Springfield',
      state: 'IL',
      postalCode: '62701',
    },
    telecom: [
      { system: 'phone', value: '555-1234', use: 'work' },
      { system: 'email', value: 'info@clinic.com' },
    ],
    ...overrides,
  } as Location;
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PaymentLocationDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockStripeAccountInfoData.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });
    mockTerminalReadersData.mockReturnValue({
      data: undefined,
      isLoading: false,
    });
  });

  it('shows loading spinner while data is loading', () => {
    mockPaymentLocationsData.mockReturnValue({ data: undefined, isLoading: true });

    render(<PaymentLocationDetailPage />, { wrapper: createWrapper() });
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows "Location not found" when location id does not match', () => {
    mockPaymentLocationsData.mockReturnValue({
      data: [{ location: makeLocation({ id: 'other-loc' }), supportsVirtualVisits: false }],
      isLoading: false,
    });

    render(<PaymentLocationDetailPage />, { wrapper: createWrapper() });
    expect(screen.getByText('Location not found.')).toBeInTheDocument();
  });

  it('renders location name and address', () => {
    mockPaymentLocationsData.mockReturnValue({
      data: [{ location: makeLocation(), supportsVirtualVisits: false }],
      isLoading: false,
    });

    render(<PaymentLocationDetailPage />, { wrapper: createWrapper() });
    expect(screen.getByText('Main Office')).toBeInTheDocument();
    expect(screen.getByText('123 Main St')).toBeInTheDocument();
    expect(screen.getByText('Springfield, IL, 62701')).toBeInTheDocument();
  });

  it('renders telecom information', () => {
    mockPaymentLocationsData.mockReturnValue({
      data: [{ location: makeLocation(), supportsVirtualVisits: false }],
      isLoading: false,
    });

    render(<PaymentLocationDetailPage />, { wrapper: createWrapper() });
    expect(screen.getByText('555-1234')).toBeInTheDocument();
    expect(screen.getByText('info@clinic.com')).toBeInTheDocument();
  });

  it('shows "Virtual Visits Supported" chip when applicable', () => {
    mockPaymentLocationsData.mockReturnValue({
      data: [{ location: makeLocation(), supportsVirtualVisits: true }],
      isLoading: false,
    });

    render(<PaymentLocationDetailPage />, { wrapper: createWrapper() });
    expect(screen.getByText('Virtual Visits Supported')).toBeInTheDocument();
  });

  it('does not show virtual visits chip when not supported', () => {
    mockPaymentLocationsData.mockReturnValue({
      data: [{ location: makeLocation(), supportsVirtualVisits: false }],
      isLoading: false,
    });

    render(<PaymentLocationDetailPage />, { wrapper: createWrapper() });
    expect(screen.queryByText('Virtual Visits Supported')).not.toBeInTheDocument();
  });

  it('renders "No address on file" when location has no address', () => {
    const loc = makeLocation({ address: undefined, telecom: undefined });
    mockPaymentLocationsData.mockReturnValue({
      data: [{ location: loc, supportsVirtualVisits: false }],
      isLoading: false,
    });

    render(<PaymentLocationDetailPage />, { wrapper: createWrapper() });
    expect(screen.getByText('No address on file')).toBeInTheDocument();
    expect(screen.getByText('No telecom on file')).toBeInTheDocument();
  });

  it('navigates back when "Back to Locations" is clicked', async () => {
    const user = userEvent.setup();
    mockPaymentLocationsData.mockReturnValue({
      data: [{ location: makeLocation(), supportsVirtualVisits: false }],
      isLoading: false,
    });

    render(<PaymentLocationDetailPage />, { wrapper: createWrapper() });
    const backButton = screen.getByRole('button', { name: /back to locations/i });
    await user.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith('/admin/billing/payment-locations');
  });

  it('shows Stripe Connect section with invalid format chip for bad account ID', () => {
    const loc = makeLocation({
      extension: [{ url: 'https://fhir.ottehr.com/Extension/stripe-account-id', valueString: 'bad_id' }],
    });
    mockPaymentLocationsData.mockReturnValue({
      data: [{ location: loc, supportsVirtualVisits: false }],
      isLoading: false,
    });

    render(<PaymentLocationDetailPage />, { wrapper: createWrapper() });
    expect(screen.getByText('Invalid Account ID Format')).toBeInTheDocument();
  });

  it('shows Stripe Account Connected chip when valid account data is loaded', () => {
    const loc = makeLocation({
      extension: [{ url: 'https://fhir.ottehr.com/Extension/stripe-account-id', valueString: 'acct_1234567890ab' }],
    });
    mockPaymentLocationsData.mockReturnValue({
      data: [{ location: loc, supportsVirtualVisits: false }],
      isLoading: false,
    });
    mockStripeAccountInfoData.mockReturnValue({
      data: {
        accountInfo: { businessName: 'Acme Health', dbaName: null, taxId: null, address: null },
        terminalLocations: [],
        error: null,
      },
      isLoading: false,
      isError: false,
    });

    render(<PaymentLocationDetailPage />, { wrapper: createWrapper() });
    expect(screen.getByText('Stripe Account Connected')).toBeInTheDocument();
    expect(screen.getByText('Acme Health')).toBeInTheDocument();
  });

  it('renders stripe account error chip when data has an error', () => {
    const loc = makeLocation({
      extension: [{ url: 'https://fhir.ottehr.com/Extension/stripe-account-id', valueString: 'acct_1234567890ab' }],
    });
    mockPaymentLocationsData.mockReturnValue({
      data: [{ location: loc, supportsVirtualVisits: false }],
      isLoading: false,
    });
    mockStripeAccountInfoData.mockReturnValue({
      data: {
        accountInfo: null,
        terminalLocations: [],
        error: 'Stripe account not found',
      },
      isLoading: false,
      isError: false,
    });

    render(<PaymentLocationDetailPage />, { wrapper: createWrapper() });
    expect(screen.getByText('Stripe account not found')).toBeInTheDocument();
  });
});
