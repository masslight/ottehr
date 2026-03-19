import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProviderCoding from '../../src/pages/reports/ProviderCoding';

// ============================================================================
// MOCKS
// ============================================================================

const mockGetEncountersReport = vi.fn();

vi.mock('../../src/api/api', () => ({
  getEncountersReport: (...args: unknown[]) => mockGetEncountersReport(...args),
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
        <div key={row.id} data-testid={`row-${row.id}`}>
          {row.providerName} | {row.totalCoded} | {row.level2} | {row.lowComplexity} | {row.mediumComplexity} |{' '}
          {row.highComplexity} | {row.averageCodingLevel} | {row.avgTimeWithPatient}
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
  message: 'Found 4 complete encounters',
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
      attendingProvider: 'Dr. Jane Doe',
      visitType: 'In-Person',
      emCode: '99213',
      providerToDischargedMinutes: 15,
    },
    {
      appointmentId: 'appt-002',
      patientId: 'patient-002',
      patientName: 'Bob Jones',
      dateOfBirth: '1985-06-20',
      visitStatus: 'completed',
      appointmentStart: '2025-03-01T11:00:00.000Z',
      appointmentEnd: '2025-03-01T11:30:00.000Z',
      location: 'Main Clinic',
      attendingProvider: 'Dr. Jane Doe',
      visitType: 'In-Person',
      emCode: '99214',
      providerToDischargedMinutes: 25,
    },
    {
      appointmentId: 'appt-003',
      patientId: 'patient-003',
      patientName: 'Carol White',
      dateOfBirth: '1975-11-05',
      visitStatus: 'completed',
      appointmentStart: '2025-03-01T12:00:00.000Z',
      appointmentEnd: '2025-03-01T12:30:00.000Z',
      location: 'North Branch',
      attendingProvider: 'Dr. John Smith',
      visitType: 'In-Person',
      emCode: '99205',
      providerToDischargedMinutes: 30,
    },
    {
      appointmentId: 'appt-004',
      patientId: 'patient-004',
      patientName: 'Dave Brown',
      dateOfBirth: '2000-04-10',
      visitStatus: 'completed',
      appointmentStart: '2025-03-01T13:00:00.000Z',
      appointmentEnd: '2025-03-01T13:30:00.000Z',
      location: 'Main Clinic',
      attendingProvider: 'Dr. Jane Doe',
      visitType: 'In-Person',
      emCode: '99202',
      providerToDischargedMinutes: 10,
    },
  ],
};

// ============================================================================
// TESTS
// ============================================================================

describe('ProviderCoding (Provider KPIs) page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page title and description', async () => {
    mockGetEncountersReport.mockResolvedValue({ message: '', encounters: [] });
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProviderCoding />
      </Wrapper>
    );

    expect(screen.getByText('Provider KPIs')).toBeDefined();
    expect(screen.getByText(/E&M coding distribution by attending provider/i)).toBeDefined();
  });

  it('shows loading state while fetching data', async () => {
    mockGetEncountersReport.mockReturnValue(new Promise(() => {})); // never resolves
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProviderCoding />
      </Wrapper>
    );

    const grid = screen.getByTestId('data-grid');
    expect(grid.getAttribute('data-loading')).toBe('true');
  });

  it('renders provider rows when data is loaded', async () => {
    mockGetEncountersReport.mockResolvedValue(mockEncounterResponse);
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProviderCoding />
      </Wrapper>
    );

    await waitFor(() => {
      // Two providers: Dr. Jane Doe and Dr. John Smith
      expect(screen.getByTestId('row-Dr. Jane Doe')).toBeDefined();
      expect(screen.getByTestId('row-Dr. John Smith')).toBeDefined();
    });

    expect(screen.getByText(/Dr. Jane Doe/)).toBeDefined();
    expect(screen.getByText(/Dr. John Smith/)).toBeDefined();
  });

  it('correctly aggregates encounters by provider', async () => {
    mockGetEncountersReport.mockResolvedValue(mockEncounterResponse);
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProviderCoding />
      </Wrapper>
    );

    await waitFor(() => {
      const janeDoeRow = screen.getByTestId('row-Dr. Jane Doe');
      expect(janeDoeRow).toBeDefined();
      // Dr. Jane Doe: 99213 (low), 99214 (medium), 99202 (level2)
      // totalCoded=3, level2=1, low=1, medium=1, high=0
      expect(janeDoeRow.textContent).toContain('3'); // totalCoded
    });
  });

  it('shows empty state message when no encounters are returned', async () => {
    mockGetEncountersReport.mockResolvedValue({ message: 'Found 0 complete encounters', encounters: [] });
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProviderCoding />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/No provider coding data found for the selected date range/i)).toBeDefined();
    });
  });

  it('shows error message when the request fails', async () => {
    mockGetEncountersReport.mockRejectedValue(new Error('Network error'));
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProviderCoding />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/Error loading report: Network error/i)).toBeDefined();
    });
  });

  it('shows date range selector with expected options', async () => {
    mockGetEncountersReport.mockResolvedValue({ message: '', encounters: [] });
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProviderCoding />
      </Wrapper>
    );

    expect(screen.getByRole('combobox')).toBeDefined();
  });

  it('shows custom date picker when custom date range is selected', async () => {
    mockGetEncountersReport.mockResolvedValue({ message: '', encounters: [] });
    const user = userEvent.setup();
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProviderCoding />
      </Wrapper>
    );

    const select = screen.getByRole('combobox');
    await user.click(select);

    const customRangeOption = await screen.findByText('Custom Date Range');
    await user.click(customRangeOption);

    await waitFor(() => {
      expect(screen.getByLabelText('Start Date')).toBeDefined();
      expect(screen.getByLabelText('End Date')).toBeDefined();
    });
  });

  it('calls getEncountersReport with encounterStatus complete and includeEmCodes true', async () => {
    mockGetEncountersReport.mockResolvedValue({ message: '', encounters: [] });
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProviderCoding />
      </Wrapper>
    );

    await waitFor(() => {
      expect(mockGetEncountersReport).toHaveBeenCalled();
    });

    const callArgs = mockGetEncountersReport.mock.calls[0];
    // Second argument is the params object
    expect(callArgs[1]).toMatchObject({
      encounterStatus: 'complete',
      includeEmCodes: true,
    });
  });

  it('skips encounters without E&M codes in aggregation', async () => {
    const responseWithMissing = {
      message: 'Found 2 encounters',
      encounters: [
        {
          appointmentId: 'appt-010',
          patientId: 'patient-010',
          patientName: 'Eve Green',
          dateOfBirth: '1992-03-22',
          visitStatus: 'completed',
          appointmentStart: '2025-03-01T10:00:00.000Z',
          appointmentEnd: '2025-03-01T10:30:00.000Z',
          attendingProvider: 'Dr. No Code',
          emCode: undefined,
        },
        {
          appointmentId: 'appt-011',
          patientId: 'patient-011',
          patientName: 'Frank Blue',
          dateOfBirth: '1988-07-14',
          visitStatus: 'completed',
          appointmentStart: '2025-03-01T11:00:00.000Z',
          appointmentEnd: '2025-03-01T11:30:00.000Z',
          attendingProvider: 'Dr. Has Code',
          emCode: '99213',
          providerToDischargedMinutes: 20,
        },
      ],
    };
    mockGetEncountersReport.mockResolvedValue(responseWithMissing);
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProviderCoding />
      </Wrapper>
    );

    await waitFor(() => {
      // Only Dr. Has Code should appear since Dr. No Code has no E&M code
      expect(screen.getByTestId('row-Dr. Has Code')).toBeDefined();
      expect(screen.queryByTestId('row-Dr. No Code')).toBeNull();
    });
  });
});

// ============================================================================
// AGGREGATION UNIT TESTS
// ============================================================================

import { IncompleteEncounterItem } from 'utils';

const LEVEL2_CODES = ['99202', '99212'];
const LOW_CODES = ['99203', '99213'];
const MEDIUM_CODES = ['99204', '99214'];
const HIGH_CODES = ['99205', '99215'];

interface ProviderCodingRow {
  id: string;
  providerName: string;
  totalCoded: number;
  level2: number;
  lowComplexity: number;
  mediumComplexity: number;
  highComplexity: number;
  averageCodingLevel: number | null;
  avgTimeWithPatient: number | null;
}

function aggregateByProvider(encounters: IncompleteEncounterItem[]): ProviderCodingRow[] {
  const providerMap = new Map<
    string,
    { level2: number; low: number; medium: number; high: number; otherCoded: number; durations: number[] }
  >();

  for (const encounter of encounters) {
    if (!encounter.emCode) continue;

    const provider = encounter.attendingProvider || 'Unknown';
    if (!providerMap.has(provider)) {
      providerMap.set(provider, { level2: 0, low: 0, medium: 0, high: 0, otherCoded: 0, durations: [] });
    }
    const stats = providerMap.get(provider)!;

    if (LEVEL2_CODES.includes(encounter.emCode)) {
      stats.level2++;
    } else if (LOW_CODES.includes(encounter.emCode)) {
      stats.low++;
    } else if (MEDIUM_CODES.includes(encounter.emCode)) {
      stats.medium++;
    } else if (HIGH_CODES.includes(encounter.emCode)) {
      stats.high++;
    } else {
      stats.otherCoded++;
    }

    if (encounter.providerToDischargedMinutes != null) {
      stats.durations.push(encounter.providerToDischargedMinutes);
    }
  }

  const rows: ProviderCodingRow[] = [];
  for (const [providerName, stats] of providerMap.entries()) {
    const trackedTotal = stats.level2 + stats.low + stats.medium + stats.high;
    const averageCodingLevel =
      trackedTotal > 0 ? (stats.level2 * 2 + stats.low * 3 + stats.medium * 4 + stats.high * 5) / trackedTotal : null;

    const avgTimeWithPatient =
      stats.durations.length > 0 ? stats.durations.reduce((sum, d) => sum + d, 0) / stats.durations.length : null;

    rows.push({
      id: providerName,
      providerName,
      totalCoded: trackedTotal + stats.otherCoded,
      level2: stats.level2,
      lowComplexity: stats.low,
      mediumComplexity: stats.medium,
      highComplexity: stats.high,
      averageCodingLevel,
      avgTimeWithPatient,
    });
  }

  return rows.sort((a, b) => a.providerName.localeCompare(b.providerName));
}

describe('aggregateByProvider', () => {
  it('returns empty array for empty input', () => {
    expect(aggregateByProvider([])).toEqual([]);
  });

  it('skips encounters without E&M codes', () => {
    const encounters: IncompleteEncounterItem[] = [
      {
        appointmentId: '1',
        patientId: 'p1',
        patientName: 'Test',
        dateOfBirth: '2000-01-01',
        visitStatus: 'completed',
        appointmentStart: '2025-01-01T00:00:00Z',
        appointmentEnd: '2025-01-01T00:30:00Z',
        attendingProvider: 'Dr. A',
        // no emCode
      },
    ];
    expect(aggregateByProvider(encounters)).toEqual([]);
  });

  it('correctly categorizes Level 2 codes (99202, 99212)', () => {
    const encounters: IncompleteEncounterItem[] = [
      {
        appointmentId: '1',
        patientId: 'p1',
        patientName: 'Test',
        dateOfBirth: '2000-01-01',
        visitStatus: 'completed',
        appointmentStart: '2025-01-01T00:00:00Z',
        appointmentEnd: '2025-01-01T00:30:00Z',
        attendingProvider: 'Dr. A',
        emCode: '99202',
      },
      {
        appointmentId: '2',
        patientId: 'p2',
        patientName: 'Test2',
        dateOfBirth: '2000-01-01',
        visitStatus: 'completed',
        appointmentStart: '2025-01-01T01:00:00Z',
        appointmentEnd: '2025-01-01T01:30:00Z',
        attendingProvider: 'Dr. A',
        emCode: '99212',
      },
    ];
    const result = aggregateByProvider(encounters);
    expect(result).toHaveLength(1);
    expect(result[0].level2).toBe(2);
    expect(result[0].totalCoded).toBe(2);
  });

  it('correctly categorizes Low codes (99203, 99213)', () => {
    const encounters: IncompleteEncounterItem[] = [
      {
        appointmentId: '1',
        patientId: 'p1',
        patientName: 'Test',
        dateOfBirth: '2000-01-01',
        visitStatus: 'completed',
        appointmentStart: '2025-01-01T00:00:00Z',
        appointmentEnd: '2025-01-01T00:30:00Z',
        attendingProvider: 'Dr. A',
        emCode: '99203',
      },
      {
        appointmentId: '2',
        patientId: 'p2',
        patientName: 'Test2',
        dateOfBirth: '2000-01-01',
        visitStatus: 'completed',
        appointmentStart: '2025-01-01T01:00:00Z',
        appointmentEnd: '2025-01-01T01:30:00Z',
        attendingProvider: 'Dr. A',
        emCode: '99213',
      },
    ];
    const result = aggregateByProvider(encounters);
    expect(result).toHaveLength(1);
    expect(result[0].lowComplexity).toBe(2);
  });

  it('correctly categorizes Medium codes (99204, 99214)', () => {
    const encounters: IncompleteEncounterItem[] = [
      {
        appointmentId: '1',
        patientId: 'p1',
        patientName: 'Test',
        dateOfBirth: '2000-01-01',
        visitStatus: 'completed',
        appointmentStart: '2025-01-01T00:00:00Z',
        appointmentEnd: '2025-01-01T00:30:00Z',
        attendingProvider: 'Dr. A',
        emCode: '99204',
      },
    ];
    const result = aggregateByProvider(encounters);
    expect(result[0].mediumComplexity).toBe(1);
  });

  it('correctly categorizes High codes (99205, 99215)', () => {
    const encounters: IncompleteEncounterItem[] = [
      {
        appointmentId: '1',
        patientId: 'p1',
        patientName: 'Test',
        dateOfBirth: '2000-01-01',
        visitStatus: 'completed',
        appointmentStart: '2025-01-01T00:00:00Z',
        appointmentEnd: '2025-01-01T00:30:00Z',
        attendingProvider: 'Dr. A',
        emCode: '99205',
      },
    ];
    const result = aggregateByProvider(encounters);
    expect(result[0].highComplexity).toBe(1);
  });

  it('calculates correct weighted average coding level', () => {
    const encounters: IncompleteEncounterItem[] = [
      {
        appointmentId: '1',
        patientId: 'p1',
        patientName: 'T',
        dateOfBirth: '2000-01-01',
        visitStatus: 'completed',
        appointmentStart: '2025-01-01T00:00:00Z',
        appointmentEnd: '2025-01-01T00:30:00Z',
        attendingProvider: 'Dr. A',
        emCode: '99213', // low = 3
      },
      {
        appointmentId: '2',
        patientId: 'p2',
        patientName: 'T',
        dateOfBirth: '2000-01-01',
        visitStatus: 'completed',
        appointmentStart: '2025-01-01T01:00:00Z',
        appointmentEnd: '2025-01-01T01:30:00Z',
        attendingProvider: 'Dr. A',
        emCode: '99215', // high = 5
      },
    ];
    const result = aggregateByProvider(encounters);
    // (3 + 5) / 2 = 4
    expect(result[0].averageCodingLevel).toBe(4);
  });

  it('calculates correct weighted average with Level 2 codes', () => {
    const encounters: IncompleteEncounterItem[] = [
      {
        appointmentId: '1',
        patientId: 'p1',
        patientName: 'T',
        dateOfBirth: '2000-01-01',
        visitStatus: 'completed',
        appointmentStart: '2025-01-01T00:00:00Z',
        appointmentEnd: '2025-01-01T00:30:00Z',
        attendingProvider: 'Dr. A',
        emCode: '99202', // level2 = 2
      },
      {
        appointmentId: '2',
        patientId: 'p2',
        patientName: 'T',
        dateOfBirth: '2000-01-01',
        visitStatus: 'completed',
        appointmentStart: '2025-01-01T01:00:00Z',
        appointmentEnd: '2025-01-01T01:30:00Z',
        attendingProvider: 'Dr. A',
        emCode: '99214', // medium = 4
      },
    ];
    const result = aggregateByProvider(encounters);
    // (2 + 4) / 2 = 3
    expect(result[0].averageCodingLevel).toBe(3);
  });

  it('returns null averageCodingLevel when all codes are unrecognized', () => {
    const encounters: IncompleteEncounterItem[] = [
      {
        appointmentId: '1',
        patientId: 'p1',
        patientName: 'T',
        dateOfBirth: '2000-01-01',
        visitStatus: 'completed',
        appointmentStart: '2025-01-01T00:00:00Z',
        appointmentEnd: '2025-01-01T00:30:00Z',
        attendingProvider: 'Dr. A',
        emCode: '99201', // not in any category
      },
    ];
    const result = aggregateByProvider(encounters);
    expect(result[0].averageCodingLevel).toBeNull();
    expect(result[0].totalCoded).toBe(1); // still counted as otherCoded
  });

  it('calculates correct average time with patient', () => {
    const encounters: IncompleteEncounterItem[] = [
      {
        appointmentId: '1',
        patientId: 'p1',
        patientName: 'T',
        dateOfBirth: '2000-01-01',
        visitStatus: 'completed',
        appointmentStart: '2025-01-01T00:00:00Z',
        appointmentEnd: '2025-01-01T00:30:00Z',
        attendingProvider: 'Dr. A',
        emCode: '99213',
        providerToDischargedMinutes: 10,
      },
      {
        appointmentId: '2',
        patientId: 'p2',
        patientName: 'T',
        dateOfBirth: '2000-01-01',
        visitStatus: 'completed',
        appointmentStart: '2025-01-01T01:00:00Z',
        appointmentEnd: '2025-01-01T01:30:00Z',
        attendingProvider: 'Dr. A',
        emCode: '99214',
        providerToDischargedMinutes: 30,
      },
    ];
    const result = aggregateByProvider(encounters);
    // (10 + 30) / 2 = 20
    expect(result[0].avgTimeWithPatient).toBe(20);
  });

  it('returns null avgTimeWithPatient when no durations are available', () => {
    const encounters: IncompleteEncounterItem[] = [
      {
        appointmentId: '1',
        patientId: 'p1',
        patientName: 'T',
        dateOfBirth: '2000-01-01',
        visitStatus: 'completed',
        appointmentStart: '2025-01-01T00:00:00Z',
        appointmentEnd: '2025-01-01T00:30:00Z',
        attendingProvider: 'Dr. A',
        emCode: '99213',
        providerToDischargedMinutes: null,
      },
    ];
    const result = aggregateByProvider(encounters);
    expect(result[0].avgTimeWithPatient).toBeNull();
  });

  it('aggregates multiple providers and sorts alphabetically', () => {
    const encounters: IncompleteEncounterItem[] = [
      {
        appointmentId: '1',
        patientId: 'p1',
        patientName: 'T',
        dateOfBirth: '2000-01-01',
        visitStatus: 'completed',
        appointmentStart: '2025-01-01T00:00:00Z',
        appointmentEnd: '2025-01-01T00:30:00Z',
        attendingProvider: 'Dr. Zeta',
        emCode: '99213',
      },
      {
        appointmentId: '2',
        patientId: 'p2',
        patientName: 'T',
        dateOfBirth: '2000-01-01',
        visitStatus: 'completed',
        appointmentStart: '2025-01-01T01:00:00Z',
        appointmentEnd: '2025-01-01T01:30:00Z',
        attendingProvider: 'Dr. Alpha',
        emCode: '99214',
      },
    ];
    const result = aggregateByProvider(encounters);
    expect(result).toHaveLength(2);
    expect(result[0].providerName).toBe('Dr. Alpha');
    expect(result[1].providerName).toBe('Dr. Zeta');
  });

  it('uses "Unknown" for encounters with no attendingProvider', () => {
    const encounters: IncompleteEncounterItem[] = [
      {
        appointmentId: '1',
        patientId: 'p1',
        patientName: 'T',
        dateOfBirth: '2000-01-01',
        visitStatus: 'completed',
        appointmentStart: '2025-01-01T00:00:00Z',
        appointmentEnd: '2025-01-01T00:30:00Z',
        emCode: '99213',
      },
    ];
    const result = aggregateByProvider(encounters);
    expect(result[0].providerName).toBe('Unknown');
  });
});
