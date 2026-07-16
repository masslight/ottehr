import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { FaxLogEntry } from 'utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetFaxLogs = vi.fn<(...args: any[]) => Promise<any>>();

vi.mock('src/api/api', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    getFaxLogs: (...args: any[]) => mockGetFaxLogs(...args),
  };
});

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehr: {} as any, oystehrZambda: {} as any }),
}));

const mockSendFax = vi.fn<(...args: any[]) => Promise<void>>();

vi.mock('src/features/visits/shared/hooks/useOystehrAPIClient', () => ({
  useOystehrAPIClient: () => ({ sendFax: (...args: any[]) => mockSendFax(...args) }),
}));

vi.mock('notistack', async () => {
  const actual = (await vi.importActual('notistack')) as any;
  return { ...actual, enqueueSnackbar: vi.fn() };
});

import { FaxLogsTable } from '../../src/features/fax-logs/FaxLogsTable';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
};

const sentLog: FaxLogEntry = {
  communicationId: 'comm-1',
  status: 'sent',
  sentAt: '2024-07-29T15:00:00.000Z',
  faxNumber: '+11112223333',
  patientId: 'patient-1',
  patientName: 'Black, Oliver',
  recipientName: 'Dr. Green',
  appointmentId: 'e2e6b8f0-0000-0000-0000-000000000001',
  visitDate: '2024-07-29T14:30:00.000Z',
};

const failedLog: FaxLogEntry = {
  ...sentLog,
  communicationId: 'comm-2',
  status: 'failed',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FaxLogsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFaxLogs.mockResolvedValue({ logs: [sentLog, failedLog], totalCount: 2 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders fax log rows with patient, visit, recipient, fax number and status', async () => {
    render(<FaxLogsTable />, { wrapper: createWrapper() });

    expect(await screen.findAllByText('Black, Oliver')).toHaveLength(2);
    expect(screen.getAllByText('Dr. Green')).toHaveLength(2);
    expect(screen.getAllByText('(111) 222-3333')).toHaveLength(2);
    expect(screen.getAllByText('07/29/2024')).toHaveLength(2);
    expect(screen.getByText('sent')).toBeVisible();
    expect(screen.getByText('failed')).toBeVisible();

    // only the failed fax offers a retry
    expect(screen.getAllByRole('button', { name: 'Try again' })).toHaveLength(1);
  });

  it('uses the original fax number as the recipient display when no name was captured', async () => {
    mockGetFaxLogs.mockResolvedValue({ logs: [{ ...sentLog, recipientName: undefined }], totalCount: 1 });

    render(<FaxLogsTable />, { wrapper: createWrapper() });

    expect(await screen.findAllByText('(111) 222-3333')).toHaveLength(2);
  });

  it('applies patient and visit searches independently when both are entered before the debounce expires', async () => {
    render(<FaxLogsTable />, { wrapper: createWrapper() });
    await screen.findAllByText('Dr. Green');

    vi.useFakeTimers();
    fireEvent.change(screen.getByRole('textbox', { name: 'Patient' }), { target: { value: 'Black' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Visit ID' }), {
      target: { value: sentLog.appointmentId },
    });
    await act(async () => vi.advanceTimersByTime(800));
    vi.useRealTimers();

    await waitFor(() =>
      expect(mockGetFaxLogs).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ patientName: 'Black', visitId: sentLog.appointmentId })
      )
    );
  });

  it('hides the patient search and column when scoped to a patient', async () => {
    render(<FaxLogsTable patientId="patient-1" />, { wrapper: createWrapper() });

    await screen.findAllByText('Dr. Green');
    expect(screen.queryByText('Patient')).toBeNull();
    expect(screen.queryByText('Black, Oliver')).toBeNull();
    expect(mockGetFaxLogs).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ patientId: 'patient-1' }));
  });

  it('resends a failed fax to the original recipient from the Resend Fax dialog', async () => {
    mockSendFax.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<FaxLogsTable />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Resend Fax')).toBeVisible();
    expect(screen.getByText('Resend fax to Dr. Green to the fax number: (111) 222-3333.')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Resend' }));

    await waitFor(() =>
      expect(mockSendFax).toHaveBeenCalledWith({
        appointmentId: sentLog.appointmentId,
        faxNumber: '1112223333',
      })
    );
  });

  it('shows an empty state when there are no faxes', async () => {
    mockGetFaxLogs.mockResolvedValue({ logs: [], totalCount: 0 });
    render(<FaxLogsTable />, { wrapper: createWrapper() });

    expect(await screen.findByText('No faxes found')).toBeVisible();
  });

  it('shows an error message instead of an empty log when loading fails', async () => {
    mockGetFaxLogs.mockRejectedValue(new Error('service unavailable'));
    render(<FaxLogsTable />, { wrapper: createWrapper() });

    expect(await screen.findByText('Failed to load fax logs. Please try again later.')).toBeVisible();
    expect(screen.queryByText('No faxes found')).toBeNull();
  });
});
