import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import {
  DocumentPacketJobFailureReason,
  DocumentPacketSource,
  GetDocumentPacketStatusOutput,
} from 'utils/lib/types/api/document-packet.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SendDocumentsFormValues } from '../../src/features/send-documents/model/types';

const mockEnqueueSnackbar = vi.fn();
const mockCloseSnackbar = vi.fn();
vi.mock('notistack', () => ({
  enqueueSnackbar: (...args: unknown[]) => mockEnqueueSnackbar(...args),
  closeSnackbar: (...args: unknown[]) => mockCloseSnackbar(...args),
}));

let mockJobStatus: GetDocumentPacketStatusOutput | undefined;
vi.mock('../../src/features/send-documents/hooks/useDocumentPacketStatus', () => ({
  useDocumentPacketStatuses: (taskIds: string[]) => taskIds.map((taskId) => ({ taskId, data: mockJobStatus })),
}));

vi.mock('../../src/features/send-documents/hooks/useSendDocumentPacket', () => ({
  useSendDocumentPacket: () => ({ mutateAsync: () => Promise.resolve({ taskId: 'task-1' }), isPending: false }),
}));

vi.mock('../../src/features/send-documents/hooks/useDocumentPacketPreview', () => ({
  useDocumentPacketPreview: () => ({ data: undefined, isLoading: false, isError: false }),
}));

vi.mock('../../src/features/send-documents/hooks/useFaxSender', () => ({
  useFaxSenderFaxNumber: () => ({ data: undefined }),
}));

import { useSendDocuments } from '../../src/features/send-documents/hooks/useSendDocuments';

const SOURCE: DocumentPacketSource = {
  type: 'medical-record',
  patientId: 'patient-1',
  dateRange: { from: '2026-01-01T00:00:00.000Z', to: '2026-10-14T23:59:59.999Z' },
};

const VALUES: SendDocumentsFormValues = {
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

const sendAndSettle = async (status: GetDocumentPacketStatusOutput): Promise<void> => {
  mockJobStatus = status;
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useSendDocuments(SOURCE), { wrapper });

  await act(() => result.current.send(VALUES));

  await waitFor(() =>
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ variant: 'error' }))
  );
};

const sendAndFail = (failureReason?: DocumentPacketJobFailureReason): Promise<void> =>
  sendAndSettle({ jobStatus: 'failed', recipients: [], failureReason });

describe('useSendDocuments', () => {
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
