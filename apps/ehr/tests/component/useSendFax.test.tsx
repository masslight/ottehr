import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { FaxJobFailureReason, FaxPacketSource, GetFaxPacketStatusOutput } from 'utils/lib/types/api/fax.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FaxFormValues } from '../../src/features/fax/model/types';

const mockEnqueueSnackbar = vi.fn();
const mockCloseSnackbar = vi.fn();
vi.mock('notistack', () => ({
  enqueueSnackbar: (...args: unknown[]) => mockEnqueueSnackbar(...args),
  closeSnackbar: (...args: unknown[]) => mockCloseSnackbar(...args),
}));

let mockJobStatus: GetFaxPacketStatusOutput | undefined;
vi.mock('../../src/features/fax/hooks/useFaxPacketStatus', () => ({
  useFaxPacketStatuses: (taskIds: string[]) => taskIds.map((taskId) => ({ taskId, data: mockJobStatus })),
}));

vi.mock('../../src/features/fax/hooks/useSendFaxPacket', () => ({
  useSendFaxPacket: () => ({ mutateAsync: () => Promise.resolve({ taskId: 'task-1' }), isPending: false }),
}));

vi.mock('../../src/features/fax/hooks/useFaxPacketPreview', () => ({
  useFaxPacketPreview: () => ({ data: undefined, isLoading: false, isError: false }),
}));

vi.mock('../../src/features/fax/hooks/useFaxSender', () => ({
  useFaxSenderFaxNumber: () => ({ data: undefined }),
}));

import { useSendFax } from '../../src/features/fax/hooks/useSendFax';

const SOURCE: FaxPacketSource = {
  type: 'medical-record',
  patientId: 'patient-1',
  dateRange: { from: '2026-01-01T00:00:00.000Z', to: '2026-10-14T23:59:59.999Z' },
};

const VALUES: FaxFormValues = {
  recipients: [
    {
      name: '',
      credential: '',
      organization: '',
      channel: 'fax',
      faxNumber: '(212) 555-1234',
      email: '',
      phoneNumber: '',
      saveAsPcp: false,
    },
  ],
};

const sendAndSettle = async (status: GetFaxPacketStatusOutput): Promise<void> => {
  mockJobStatus = status;
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useSendFax(SOURCE), { wrapper });

  await act(() => result.current.send(VALUES));

  await waitFor(() =>
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ variant: 'error' }))
  );
};

const sendAndFail = (failureReason?: FaxJobFailureReason): Promise<void> =>
  sendAndSettle({ jobStatus: 'failed', recipients: [], failureReason });

describe('useSendFax', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJobStatus = undefined;
  });

  it('explains a failure caused by the packet size limit', async () => {
    await sendAndFail('too-large');

    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      'The documents exceed the maximum size of 20 MB. Please send fewer documents or reduce their size and try again.',
      { variant: 'error' }
    );
  });

  it('shows the generic failure when no reason was recorded', async () => {
    await sendAndFail();

    expect(mockEnqueueSnackbar).toHaveBeenCalledWith('The documents could not be sent. Please try again.', {
      variant: 'error',
    });
  });

  it('keeps a recipient failure on screen until the user dismisses it', async () => {
    await sendAndSettle({
      jobStatus: 'completed',
      recipients: [{ name: 'Olivia Green', faxNumber: '+12125551234', status: 'failed' }],
    });

    const [message, options] = mockEnqueueSnackbar.mock.calls.find(([, opts]) => opts?.variant === 'error')!;
    expect(message).toBe('Could not send to Olivia Green ((212) 555-1234)');
    expect(options.persist).toBe(true);

    render(<>{options.action('snackbar-1')}</>);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(mockCloseSnackbar).toHaveBeenCalledWith('snackbar-1');
  });
});
