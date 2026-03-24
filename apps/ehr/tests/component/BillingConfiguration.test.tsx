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
  };
});

const mockPaymentLocationsData = vi.fn();

vi.mock('src/rcm/state/payments/payments.queries', () => ({
  usePaymentLocationsQuery: () => mockPaymentLocationsData(),
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehr: null,
    oystehrZambda: null,
  }),
}));

// Mock the ChargeItemList component to keep tests focused
vi.mock('../../src/features/visits/telemed/components/admin/ChargeItemList', () => ({
  default: () => <div data-testid="fee-schedule-mock" />,
}));

import BillingConfiguration from '../../src/features/visits/telemed/components/admin/BillingConfiguration';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLocation(id: string, name: string, address?: Partial<Location['address']>): Location {
  return {
    resourceType: 'Location',
    id,
    status: 'active',
    name,
    address: {
      line: ['100 Oak Ave'],
      city: 'Dallas',
      state: 'TX',
      ...address,
    },
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

describe('BillingConfiguration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders tab labels including Payment Locations', () => {
    mockPaymentLocationsData.mockReturnValue({ data: [], isLoading: false });

    render(<BillingConfiguration billingTab="payment-locations" />, { wrapper: createWrapper() });
    expect(screen.getByRole('tab', { name: /fee schedules/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /charge masters/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /payment locations/i })).toBeInTheDocument();
  });

  it('shows loading spinner while locations are loading', () => {
    mockPaymentLocationsData.mockReturnValue({ data: undefined, isLoading: true });

    render(<BillingConfiguration billingTab="payment-locations" />, { wrapper: createWrapper() });
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows empty state when no payment locations exist', () => {
    mockPaymentLocationsData.mockReturnValue({ data: [], isLoading: false });

    render(<BillingConfiguration billingTab="payment-locations" />, { wrapper: createWrapper() });
    expect(screen.getByText('No payment locations found.')).toBeInTheDocument();
  });

  it('renders payment locations in the table', () => {
    mockPaymentLocationsData.mockReturnValue({
      data: [
        { location: makeLocation('loc-1', 'Main Office'), supportsVirtualVisits: false },
        { location: makeLocation('loc-2', 'Branch Office'), supportsVirtualVisits: true },
      ],
      isLoading: false,
    });

    render(<BillingConfiguration billingTab="payment-locations" />, { wrapper: createWrapper() });
    expect(screen.getByText('Main Office')).toBeInTheDocument();
    expect(screen.getByText('Branch Office')).toBeInTheDocument();
  });

  it('shows Yes/No chips for virtual visit support', () => {
    mockPaymentLocationsData.mockReturnValue({
      data: [
        { location: makeLocation('loc-1', 'Physical'), supportsVirtualVisits: false },
        { location: makeLocation('loc-2', 'Virtual', { state: 'CA' }), supportsVirtualVisits: true },
      ],
      isLoading: false,
    });

    render(<BillingConfiguration billingTab="payment-locations" />, { wrapper: createWrapper() });
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('navigates to location detail page when a row is clicked', async () => {
    const user = userEvent.setup();
    mockPaymentLocationsData.mockReturnValue({
      data: [{ location: makeLocation('loc-1', 'Main Office'), supportsVirtualVisits: false }],
      isLoading: false,
    });

    render(<BillingConfiguration billingTab="payment-locations" />, { wrapper: createWrapper() });
    await user.click(screen.getByText('Main Office'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/billing/payments/locations/loc-1');
  });

  it('filters locations by search text', async () => {
    const user = userEvent.setup();
    mockPaymentLocationsData.mockReturnValue({
      data: [
        { location: makeLocation('loc-1', 'Alpha Clinic'), supportsVirtualVisits: false },
        { location: makeLocation('loc-2', 'Beta Hospital'), supportsVirtualVisits: false },
      ],
      isLoading: false,
    });

    render(<BillingConfiguration billingTab="payment-locations" />, { wrapper: createWrapper() });

    const searchInput = screen.getByLabelText(/search by location name/i);
    await user.type(searchInput, 'Alpha');

    expect(screen.getByText('Alpha Clinic')).toBeInTheDocument();
    expect(screen.queryByText('Beta Hospital')).not.toBeInTheDocument();
  });

  it('navigates to billing sub-tab URL when switching tabs', async () => {
    const user = userEvent.setup();
    mockPaymentLocationsData.mockReturnValue({ data: [], isLoading: false });

    render(<BillingConfiguration billingTab="fee-schedules" />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('tab', { name: /payment locations/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/billing/payment-locations');
  });
});
