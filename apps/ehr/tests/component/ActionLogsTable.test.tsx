import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ActionLogEntry } from 'utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetActionLogs = vi.fn<(...args: any[]) => Promise<any>>();
const mockRetryActionLog = vi.fn<(...args: any[]) => Promise<any>>();

vi.mock('src/api/api', async (importOriginal) => ({
  ...((await importOriginal()) as any),
  getActionLogs: (...args: any[]) => mockGetActionLogs(...args),
  retryActionLog: (...args: any[]) => mockRetryActionLog(...args),
}));
vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehr: {} as any, oystehrZambda: {} as any }),
}));
vi.mock('notistack', async () => ({
  ...((await vi.importActual('notistack')) as any),
  enqueueSnackbar: vi.fn(),
}));

import { ActionLogsTable } from '../../src/features/action-logs/ActionLogsTable';

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
};

const sentLog: ActionLogEntry = {
  attemptId: 'e2e6b8f0-0000-0000-0000-000000000010',
  channel: 'fax',
  status: 'sent',
  attemptedAt: '2024-07-29T15:00:00.000Z',
  recipientAddress: '+11112223333',
  patientId: 'patient-1',
  patientName: 'Black, Oliver',
  recipientName: 'Dr. Green',
  appointmentId: 'e2e6b8f0-0000-0000-0000-000000000001',
  visitDate: '2024-07-29T14:30:00.000Z',
};
const failedLog: ActionLogEntry = {
  ...sentLog,
  attemptId: 'e2e6b8f0-0000-0000-0000-000000000011',
  status: 'failed',
};

describe('ActionLogsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActionLogs.mockResolvedValue({ logs: [sentLog, failedLog], totalCount: 2 });
    mockRetryActionLog.mockResolvedValue({ attemptId: 'e2e6b8f0-0000-0000-0000-000000000012' });
  });
  afterEach(() => vi.useRealTimers());

  it('renders fax details and only offers retry for failed attempts', async () => {
    render(<ActionLogsTable channel="fax" />, { wrapper: createWrapper() });
    expect(await screen.findAllByText('Black, Oliver')).toHaveLength(2);
    expect(screen.getAllByText('(111) 222-3333')).toHaveLength(2);
    expect(screen.getByText('sent')).toBeVisible();
    expect(screen.getByText('failed')).toBeVisible();
    expect(screen.getAllByRole('button', { name: 'Try again' })).toHaveLength(1);
  });

  it('applies patient and visit searches independently', async () => {
    render(<ActionLogsTable channel="fax" />, { wrapper: createWrapper() });
    await screen.findAllByText('Dr. Green');
    vi.useFakeTimers();
    fireEvent.change(screen.getByRole('textbox', { name: 'Patient' }), { target: { value: 'Black' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Visit ID' }), {
      target: { value: sentLog.appointmentId },
    });
    await act(async () => vi.advanceTimersByTime(800));
    vi.useRealTimers();
    await waitFor(() =>
      expect(mockGetActionLogs).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ channel: 'fax', patientName: 'Black', visitId: sentLog.appointmentId })
      )
    );
  });

  it('hides patient controls when scoped to a patient', async () => {
    render(<ActionLogsTable channel="fax" patientId="patient-1" />, { wrapper: createWrapper() });
    await screen.findAllByText('Dr. Green');
    expect(screen.queryByText('Patient')).toBeNull();
    expect(screen.queryByText('Black, Oliver')).toBeNull();
  });

  it('retries by attempt id and original address', async () => {
    const user = userEvent.setup();
    render(<ActionLogsTable channel="fax" />, { wrapper: createWrapper() });
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Resend Fax')).toBeVisible();
    expect(screen.getByText('Resend fax to Dr. Green to the original fax number: (111) 222-3333.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Resend' }));
    await waitFor(() =>
      expect(mockRetryActionLog).toHaveBeenCalledWith(expect.anything(), { attemptId: failedLog.attemptId })
    );
  });

  it('prevents duplicate retry submissions while the first request is pending', async () => {
    let resolveRetry: ((value: { attemptId: string }) => void) | undefined;
    mockRetryActionLog.mockReturnValue(
      new Promise((resolve) => {
        resolveRetry = resolve;
      })
    );
    const user = userEvent.setup();
    render(<ActionLogsTable channel="fax" />, { wrapper: createWrapper() });
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    const resend = screen.getByRole('button', { name: 'Resend' });

    fireEvent.click(resend);
    fireEvent.click(resend);

    expect(mockRetryActionLog).toHaveBeenCalledTimes(1);
    expect(resend).toBeDisabled();
    resolveRetry?.({ attemptId: 'e2e6b8f0-0000-0000-0000-000000000012' });
    await waitFor(() => expect(screen.queryByText('Resend Fax')).toBeNull());
  });

  it('renders email addresses without phone formatting', async () => {
    mockGetActionLogs.mockResolvedValue({
      logs: [{ ...sentLog, channel: 'email', recipientAddress: 'patient@example.com' }],
      totalCount: 1,
    });
    render(<ActionLogsTable channel="email" />, { wrapper: createWrapper() });
    expect(await screen.findByText('patient@example.com')).toBeVisible();
    expect(screen.getByText('Email Address')).toBeVisible();
  });

  it('renders empty and error states', async () => {
    mockGetActionLogs.mockResolvedValueOnce({ logs: [], totalCount: 0 });
    const first = render(<ActionLogsTable channel="fax" />, { wrapper: createWrapper() });
    expect(await screen.findByText('No faxes found')).toBeVisible();
    first.unmount();

    mockGetActionLogs.mockRejectedValueOnce(new Error('service unavailable'));
    render(<ActionLogsTable channel="fax" />, { wrapper: createWrapper() });
    expect(await screen.findByText('Failed to load fax logs. Please try again later.')).toBeVisible();
  });
});
