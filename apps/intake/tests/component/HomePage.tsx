import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BOOKING_CONFIG } from 'utils/lib/ottehr-config/booking';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import Homepage from '../../src/pages/Homepage';

const mockUseAuth0 = vi.fn();
vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => mockUseAuth0(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockUseOystehrAPIClient = vi.fn();
vi.mock('../../src/telemed/utils', () => ({
  useOystehrAPIClient: () => mockUseOystehrAPIClient(),
  zustandDevtools: vi.fn(),
}));

const mockUseAppointmentsData = vi.fn();
vi.mock('../../src/telemed/features/appointments', async () => {
  const actual = await vi.importActual('../../src/telemed/features/appointments');
  return {
    ...actual,
    useAppointmentsData: (config: any) => mockUseAppointmentsData(config),
    useAppointmentStore: {
      setState: vi.fn(),
    },
    useGetAppointments: () => ({ refetch: vi.fn() }),
  };
});

const mockUseIntakeCommonStore = vi.fn();
vi.mock('../../src/telemed/features/common', async () => {
  const actual = await vi.importActual('../../src/telemed/features/common');
  return {
    ...actual,
    useIntakeCommonStore: (selector: any) => mockUseIntakeCommonStore(selector),
  };
});

const mockDefaultData = {
  isAuthenticated: false,
  isLoading: false,
  user: undefined,
  logout: vi.fn(),
  loginWithRedirect: vi.fn(),
};

const mockAppointmentsData = {
  isAppointmentsFetching: false,
  refetchAppointments: vi.fn(),
  appointments: [],
};

describe('Homepage Authentication and Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth0.mockReturnValue(mockDefaultData);
    mockUseOystehrAPIClient.mockReturnValue(null);
    mockUseAppointmentsData.mockReturnValue(mockAppointmentsData);
    mockUseIntakeCommonStore.mockImplementation((selector: any) => {
      if (typeof selector === 'function') {
        return selector({ supportDialogOpen: false });
      }
      return { supportDialogOpen: false };
    });
    mockNavigate.mockClear();
  });

  test('should render Home page', () => {
    const wrapper = render(
      <MemoryRouter initialEntries={['/home']}>
        <Homepage />
      </MemoryRouter>
    );

    expect(wrapper).toBeTruthy();
  });

  test('should display welcome title correctly', () => {
    render(
      <MemoryRouter initialEntries={['/home']}>
        <Homepage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /Welcome to/i })).toBeDefined();
  });

  test('should display Schedule a Virtual Visit button', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/home']}>
        <Homepage />
      </MemoryRouter>
    );

    const scheduleVirtualButton = screen.getByRole('button', {
      name: BOOKING_CONFIG.homepageOptions.find((option) => option.id === 'schedule-virtual-visit')?.label,
    });
    expect(scheduleVirtualButton).toBeDefined();
    await user.click(scheduleVirtualButton);
    await waitFor(() => {
      // todo: all these paths can be derived from BOOKING_CONFIG
      expect(mockNavigate).toHaveBeenCalledWith('/prebook/virtual');
    });
  });

  test('should display Schedule an In-Person Visit button', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/home']}>
        <Homepage />
      </MemoryRouter>
    );

    const scheduleInPersonVisitButton = screen.getByRole('button', {
      name: BOOKING_CONFIG.homepageOptions.find((option) => option.id === 'schedule-in-person-visit')?.label,
    });
    expect(scheduleInPersonVisitButton).toBeDefined();
    await user.click(scheduleInPersonVisitButton);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringMatching(/\/prebook\/in-person\?bookingOn=.*&scheduleType=.*/)
      );
    });
  });

  test('should display Virtual Visit Check-In button', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/home']}>
        <Homepage />
      </MemoryRouter>
    );

    const virtualVisitCheckInButton = screen.getByRole('button', {
      name: BOOKING_CONFIG.homepageOptions.find((option) => option.id === 'start-virtual-visit')?.label,
    });
    expect(virtualVisitCheckInButton).toBeDefined();
    await user.click(virtualVisitCheckInButton);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/start-virtual');
    });
  });

  test('should display In-Person Check-In button', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/home']}>
        <Homepage />
      </MemoryRouter>
    );

    const inPersonCheckInButton = screen.getByRole('button', { name: /In-Person Check-In/i });
    expect(inPersonCheckInButton).toBeDefined();
    await user.click(inPersonCheckInButton);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/\/walkin\/location\/.*/));
    });
  });

  test('should display Past Visits button', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/home']}>
        <Homepage />
      </MemoryRouter>
    );

    expect(screen.getByText('School/Work Notes and Prescriptions')).toBeDefined();
    const pastVisitsButton = screen.getByRole('button', { name: /Past Visits/i });
    expect(pastVisitsButton).toBeDefined();
    await user.click(pastVisitsButton);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/my-patients');
    });
  });

  test('should display navigation options when not authenticated', () => {
    render(
      <MemoryRouter initialEntries={['/home']}>
        <Homepage />
      </MemoryRouter>
    );

    expect(screen.getByText('Contact Support')).toBeDefined();
  });

  test('should show loading skeleton when appointments are fetching', () => {
    mockUseAppointmentsData.mockReturnValue({
      ...mockAppointmentsData,
      isAppointmentsFetching: true,
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/home']}>
        <Homepage />
      </MemoryRouter>
    );

    const skeleton = container.querySelector('.MuiSkeleton-root');
    expect(skeleton).toBeDefined();
    expect(skeleton).not.toBeNull();
  });

  describe('should show active appointment when user is authenticated and has an active appointment', () => {
    const baseAuthenticatedData = {
      ...mockDefaultData,
      isAuthenticated: true,
      user: { sub: 'test-user' },
    };

    const baseAppointment = {
      id: 'test-appointment-id',
      start: '2025-11-06T10:00:00Z',
      patient: { id: 'patient-123' },
      telemedStatus: 'ready',
    };

    test('should show return to call button when appointment status is booked', () => {
      mockUseAuth0.mockReturnValue({ ...baseAuthenticatedData });
      mockUseOystehrAPIClient.mockReturnValue({ someClient: 'value' });

      const activeAppointment = {
        ...baseAppointment,
        appointmentStatus: 'booked',
      };

      mockUseAppointmentsData.mockReturnValue({
        ...mockAppointmentsData,
        appointments: [activeAppointment],
      });

      render(
        <MemoryRouter initialEntries={['/home']}>
          <Homepage />
        </MemoryRouter>
      );

      expect(screen.getByText('Return to Call')).toBeDefined();
      expect(screen.getByText('Active call')).toBeDefined();
    });

    test('should show continue request button when appointment status is proposed', () => {
      mockUseAuth0.mockReturnValue({ ...baseAuthenticatedData });
      mockUseOystehrAPIClient.mockReturnValue({ someClient: 'value' });

      const proposedAppointment = {
        ...baseAppointment,
        appointmentStatus: 'proposed',
      };

      mockUseAppointmentsData.mockReturnValue({
        ...mockAppointmentsData,
        appointments: [proposedAppointment],
      });

      render(
        <MemoryRouter initialEntries={['/home']}>
          <Homepage />
        </MemoryRouter>
      );

      expect(screen.getByText('Continue Virtual Visit Request')).toBeDefined();
      expect(screen.queryByText('Active call')).toBeNull();
      expect(screen.getByText('Cancel this request')).toBeDefined();
    });
  });
});
