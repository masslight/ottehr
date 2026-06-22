import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { WalkinLanding } from '../../src/pages/WalkinLanding';

// Mock useNavigate so we can assert on path args; useParams + useSearchParams stay live.
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockUseServiceCategories = vi.fn();
vi.mock('../../src/hooks/useServiceCategories', () => ({
  useServiceCategories: () => mockUseServiceCategories(),
}));

vi.mock('../../src/hooks/useUCZambdaClient', () => ({
  useUCZambdaClient: () => ({}) as unknown,
}));

const mockGetWalkinAvailability = vi.fn();
const mockCreateSlot = vi.fn();
vi.mock('../../src/api', () => ({
  ottehrApi: {
    getWalkinAvailability: (...args: unknown[]) => mockGetWalkinAvailability(...args),
    createSlot: (...args: unknown[]) => mockCreateSlot(...args),
  },
}));

// Branding imports drag in SVGs jsdom can't resolve — stub the bits we use.
vi.mock('../../src/branding/welcomeTitle', () => ({ getWelcomeTitle: () => 'Welcome' }));
vi.mock('../../src/branding/primaryIconVisibility', () => ({
  getPrimaryIconContainerProps: () => ({}),
  PRIMARY_ICON_PAGE: { WALKIN_LANDING: 'walkin' },
}));

const makeCategory = (code: string, visitTypes: Array<'prebook' | 'walk-in'> = ['walk-in']): any => ({
  category: { code, display: code, system: 'https://example.com/sc' },
  visitTypes,
  serviceModes: ['in-person'],
  reasonsForVisit: { default: [] },
});

const renderAt = (path: string, scheduleParamPattern = '/walkin/schedule/:id'): ReturnType<typeof render> => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={scheduleParamPattern} element={children as JSX.Element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(<WalkinLanding />, { wrapper });
};

describe('WalkinLanding — service-category routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWalkinAvailability.mockResolvedValue({
      walkinOpen: true,
      scheduleId: 'sched-1',
      serviceMode: 'in-person',
      scheduleOwnerName: 'Test Clinic',
    });
    mockCreateSlot.mockResolvedValue({ id: 'slot-1' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('URL carries serviceCategory → no redirect, slot uses the URL category', async () => {
    const user = userEvent.setup();
    mockUseServiceCategories.mockReturnValue({ serviceCategories: [], isLoading: false });

    renderAt('/walkin/schedule/sched-1?serviceCategory=urgent-care');

    await waitFor(() => expect(screen.queryByText('Welcome')).not.toBeNull());
    expect(mockNavigate).not.toHaveBeenCalledWith(
      expect.stringContaining('/select-service-category'),
      expect.anything()
    );

    const submitButton = screen.getByRole('button', { name: /continue|check.?in|next/i });
    await user.click(submitButton);

    await waitFor(() => expect(mockCreateSlot).toHaveBeenCalled());
    const createSlotArg = mockCreateSlot.mock.calls[0][0];
    expect(createSlotArg.serviceCategoryCode).toBe('urgent-care');
  });

  test('0 walk-in-capable categories → no redirect, slot has no serviceCategoryCode', async () => {
    const user = userEvent.setup();
    mockUseServiceCategories.mockReturnValue({
      serviceCategories: [makeCategory('massage-90', ['prebook'])],
      isLoading: false,
    });

    renderAt('/walkin/schedule/sched-1');

    await waitFor(() => expect(screen.queryByText('Welcome')).not.toBeNull());
    expect(mockNavigate).not.toHaveBeenCalledWith(
      expect.stringContaining('/select-service-category'),
      expect.anything()
    );

    const submitButton = screen.getByRole('button', { name: /continue|check.?in|next/i });
    await user.click(submitButton);

    await waitFor(() => expect(mockCreateSlot).toHaveBeenCalled());
    const createSlotArg = mockCreateSlot.mock.calls[0][0];
    expect(createSlotArg.serviceCategoryCode).toBeUndefined();
  });

  test('exactly one walk-in-capable category → no redirect, auto-select at slot creation', async () => {
    const user = userEvent.setup();
    mockUseServiceCategories.mockReturnValue({
      serviceCategories: [makeCategory('urgent-care')],
      isLoading: false,
    });

    renderAt('/walkin/schedule/sched-1');

    await waitFor(() => expect(screen.queryByText('Welcome')).not.toBeNull());
    expect(mockNavigate).not.toHaveBeenCalledWith(
      expect.stringContaining('/select-service-category'),
      expect.anything()
    );

    const submitButton = screen.getByRole('button', { name: /continue|check.?in|next/i });
    await user.click(submitButton);

    await waitFor(() => expect(mockCreateSlot).toHaveBeenCalled());
    const createSlotArg = mockCreateSlot.mock.calls[0][0];
    // URL never gained the param, but the slot creation carries the only walk-in option.
    expect(createSlotArg.serviceCategoryCode).toBe('urgent-care');
  });

  test('2+ walk-in-capable categories on /walkin/schedule → redirect to schedule picker', async () => {
    mockUseServiceCategories.mockReturnValue({
      serviceCategories: [makeCategory('urgent-care'), makeCategory('workers-comp')],
      isLoading: false,
    });

    renderAt('/walkin/schedule/sched-1');

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringMatching(/^\/walkin\/schedule\/sched-1\/select-service-category/),
        expect.objectContaining({ replace: true })
      );
    });
    // Form must not render during the redirect tick — otherwise a fast click
    // creates a slot without a category.
    expect(screen.queryByRole('button', { name: /continue|check.?in|next/i })).toBeNull();
    expect(mockCreateSlot).not.toHaveBeenCalled();
  });

  test('2+ walk-in-capable categories on /walkin/location → redirect to location picker', async () => {
    mockUseServiceCategories.mockReturnValue({
      serviceCategories: [makeCategory('urgent-care'), makeCategory('workers-comp')],
      isLoading: false,
    });

    renderAt('/walkin/location/Downtown_Clinic', '/walkin/location/:name');

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringMatching(/^\/walkin\/location\/Downtown_Clinic\/select-service-category/),
        expect.objectContaining({ replace: true })
      );
    });
    expect(screen.queryByRole('button', { name: /continue|check.?in|next/i })).toBeNull();
    expect(mockCreateSlot).not.toHaveBeenCalled();
  });

  test('closed location with 2+ walk-in-capable categories → no redirect, closed message renders', async () => {
    // Closed deeplinks must skip the picker — otherwise the patient picks a
    // category just to discover the location is unavailable on the next page.
    mockGetWalkinAvailability.mockResolvedValueOnce({
      walkinOpen: false,
      scheduleId: 'sched-1',
      scheduleOwnerName: 'Test Clinic',
    });
    mockUseServiceCategories.mockReturnValue({
      serviceCategories: [makeCategory('urgent-care'), makeCategory('workers-comp')],
      isLoading: false,
    });

    renderAt('/walkin/schedule/sched-1');

    await waitFor(() =>
      expect(mockNavigate).not.toHaveBeenCalledWith(
        expect.stringContaining('/select-service-category'),
        expect.anything()
      )
    );
    expect(mockCreateSlot).not.toHaveBeenCalled();
  });
});
