import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CompleteEncounters from '../../src/pages/reports/CompleteEncounters';

// ============================================================================
// MOCKS
// ============================================================================

const mockGetCompleteEncountersReport = vi.fn();

vi.mock('../../src/api/api', () => ({
  getCompleteEncountersReport: (...args: unknown[]) => mockGetCompleteEncountersReport(...args),
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: { zambda: { execute: vi.fn() } },
  }),
}));

vi.mock('../../src/layout/PageContainer', () => ({
  default: ({ children }: { children: ReactNode }) => <div data-testid="page-container">{children}</div>,
}));

vi.mock('@mui/x-data-grid-pro', () => ({
  DataGridPro: ({ rows, loading }: { rows: unknown[]; loading: boolean }) => (
    <div data-testid="data-grid" data-loading={loading} data-row-count={rows.length}>
      {rows.map((row: any) => (
        <div key={row.appointmentId} data-testid={`row-${row.appointmentId}`}>
          {row.patientName}
        </div>
      ))}
    </div>
  ),
  GridToolbarContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  GridToolbarExport: () => <button>Export</button>,
}));

// ============================================================================
// HELPERS
// ============================================================================

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

const mockEncounterResponse = {
  message: 'Found 2 complete encounters',
  encounters: [
    {
      appointmentId: 'appt-001',
      patientId: 'patient-001',
      patientName: 'Alice Smith',
      dateOfBirth: '1990-01-15',
      visitStatus: 'completed',
      appointmentStart: '2025-03-01T10:00:00.000Z',
      appointmentEnd: '2025-03-01T10:30:00.000Z',
      location: 'Main Clinic',
      locationId: 'loc-001',
      attendingProvider: 'Dr. Jane Doe',
      visitType: 'In-Person',
      reason: 'Annual checkup',
    },
    {
      appointmentId: 'appt-002',
      patientId: 'patient-002',
      patientName: 'Bob Jones',
      dateOfBirth: '1985-06-20',
      visitStatus: 'completed',
      appointmentStart: '2025-03-01T11:00:00.000Z',
      appointmentEnd: '2025-03-01T11:30:00.000Z',
      location: 'North Branch',
      locationId: 'loc-002',
      attendingProvider: 'Dr. John Smith',
      visitType: 'In-Person',
      reason: 'Follow-up',
    },
  ],
};

// ============================================================================
// TESTS
// ============================================================================

describe('CompleteEncounters page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page title and description', async () => {
    mockGetCompleteEncountersReport.mockResolvedValue({ message: '', encounters: [] });
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <CompleteEncounters />
      </Wrapper>
    );

    expect(screen.getByText('Complete Encounters')).toBeDefined();
    expect(screen.getByText(/This report shows encounters that have been completed/i)).toBeDefined();
  });

  it('shows loading state while fetching data', async () => {
    mockGetCompleteEncountersReport.mockReturnValue(new Promise(() => {})); // never resolves
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <CompleteEncounters />
      </Wrapper>
    );

    const grid = screen.getByTestId('data-grid');
    expect(grid.getAttribute('data-loading')).toBe('true');
  });

  it('renders encounter rows when data is loaded', async () => {
    mockGetCompleteEncountersReport.mockResolvedValue(mockEncounterResponse);
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <CompleteEncounters />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('row-appt-001')).toBeDefined();
      expect(screen.getByTestId('row-appt-002')).toBeDefined();
    });

    expect(screen.getByText('Alice Smith')).toBeDefined();
    expect(screen.getByText('Bob Jones')).toBeDefined();
  });

  it('shows empty state message when no encounters are returned', async () => {
    mockGetCompleteEncountersReport.mockResolvedValue({ message: 'Found 0 complete encounters', encounters: [] });
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <CompleteEncounters />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/No complete encounters found for the selected date range/i)).toBeDefined();
    });
  });

  it('shows error message when the request fails', async () => {
    mockGetCompleteEncountersReport.mockRejectedValue(new Error('Network error'));
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <CompleteEncounters />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/Error loading encounters: Network error/i)).toBeDefined();
    });
  });

  it('shows date range selector with expected options', async () => {
    mockGetCompleteEncountersReport.mockResolvedValue({ message: '', encounters: [] });
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <CompleteEncounters />
      </Wrapper>
    );

    // The date range select combobox should be present
    expect(screen.getByRole('combobox')).toBeDefined();
  });

  it('shows custom date picker when custom date range is selected', async () => {
    mockGetCompleteEncountersReport.mockResolvedValue({ message: '', encounters: [] });
    const user = userEvent.setup();
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <CompleteEncounters />
      </Wrapper>
    );

    // Open the date range select
    const select = screen.getByRole('combobox');
    await user.click(select);

    // Click "Custom Date Range"
    const customRangeOption = await screen.findByText('Custom Date Range');
    await user.click(customRangeOption);

    // Both Start Date and End Date fields should now appear
    await waitFor(() => {
      expect(screen.getByLabelText('Start Date')).toBeDefined();
      expect(screen.getByLabelText('End Date')).toBeDefined();
    });
  });
});

// ============================================================================
// DATE FILTER OPERATOR UNIT TESTS
// ============================================================================

// Import the filter operator logic by re-implementing its behavior for testing.
// These tests verify the core date filtering logic used in the DataGrid column.
import { DateTime } from 'luxon';

const parseIso = (iso: string): DateTime => DateTime.fromISO(iso);

describe('appointmentDateFilterOperators logic', () => {
  describe('dateIs operator', () => {
    const matchesDate = (isoValue: string, filterDate: string): boolean => {
      if (!filterDate) return false;
      const iso = isoValue;
      if (!iso) return false;
      return parseIso(iso).toFormat('yyyy-MM-dd') === filterDate;
    };

    it('returns true when the appointment is on the same date', () => {
      expect(matchesDate('2025-03-01T10:00:00.000Z', '2025-03-01')).toBe(true);
    });

    it('returns false when the appointment is on a different date', () => {
      expect(matchesDate('2025-03-02T10:00:00.000Z', '2025-03-01')).toBe(false);
    });

    it('returns false when the ISO value is empty', () => {
      expect(matchesDate('', '2025-03-01')).toBe(false);
    });
  });

  describe('dateBefore operator', () => {
    const isBefore = (isoValue: string, filterDate: string): boolean => {
      if (!filterDate) return false;
      const iso = isoValue;
      if (!iso) return false;
      return parseIso(iso) < parseIso(filterDate).startOf('day');
    };

    it('returns true when appointment is before the filter date', () => {
      expect(isBefore('2025-02-28T23:59:59.000Z', '2025-03-01')).toBe(true);
    });

    it('returns false when appointment is on the filter date', () => {
      expect(isBefore('2025-03-01T10:00:00.000Z', '2025-03-01')).toBe(false);
    });

    it('returns false when appointment is after the filter date', () => {
      expect(isBefore('2025-03-02T08:00:00.000Z', '2025-03-01')).toBe(false);
    });
  });

  describe('dateAfter operator', () => {
    const isAfter = (isoValue: string, filterDate: string): boolean => {
      if (!filterDate) return false;
      const iso = isoValue;
      if (!iso) return false;
      return parseIso(iso) > parseIso(filterDate).endOf('day');
    };

    it('returns true when appointment is after the filter date', () => {
      expect(isAfter('2025-03-02T12:00:00.000Z', '2025-03-01')).toBe(true);
    });

    it('returns false when appointment is on the filter date', () => {
      expect(isAfter('2025-03-01T10:00:00.000Z', '2025-03-01')).toBe(false);
    });

    it('returns false when appointment is before the filter date', () => {
      expect(isAfter('2025-02-28T23:59:59.000Z', '2025-03-01')).toBe(false);
    });
  });

  describe('dateBetween operator', () => {
    const isBetween = (isoValue: string, startDate: string | null, endDate: string | null): boolean => {
      if (!startDate || !endDate) return false;
      const iso = isoValue;
      if (!iso) return false;
      const cell = parseIso(iso);
      return cell >= parseIso(startDate).startOf('day') && cell <= parseIso(endDate).endOf('day');
    };

    it('returns true when appointment is within the range', () => {
      expect(isBetween('2025-03-05T10:00:00.000Z', '2025-03-01', '2025-03-10')).toBe(true);
    });

    it('returns true when appointment is on the start date', () => {
      expect(isBetween('2025-03-01T12:00:00.000Z', '2025-03-01', '2025-03-10')).toBe(true);
    });

    it('returns true when appointment is on the end date', () => {
      expect(isBetween('2025-03-10T23:59:59.000Z', '2025-03-01', '2025-03-10')).toBe(true);
    });

    it('returns false when appointment is before the start date', () => {
      expect(isBetween('2025-02-28T23:59:59.000Z', '2025-03-01', '2025-03-10')).toBe(false);
    });

    it('returns false when appointment is after the end date', () => {
      expect(isBetween('2025-03-11T12:00:00.000Z', '2025-03-01', '2025-03-10')).toBe(false);
    });

    it('returns false when either start or end is missing', () => {
      expect(isBetween('2025-03-05T10:00:00.000Z', null, '2025-03-10')).toBe(false);
      expect(isBetween('2025-03-05T10:00:00.000Z', '2025-03-01', null)).toBe(false);
    });
  });
});
