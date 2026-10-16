import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { FaxJobFailureReason, FaxPacketSource, GetFaxPacketStatusOutput } from 'utils/lib/types/api/fax.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FaxFormValues } from '../../src/features/fax/model/types';

const mockEnqueueSnackbar = vi.fn();
vi.mock('notistack', () => ({
  enqueueSnackbar: (...args: unknown[]) => mockEnqueueSnackbar(...args),
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

const SOURCE: FaxPacketSource = { type: 'medical-record', patientId: 'patient-1' };

const VALUES: FaxFormValues = {
  recipients: [
    { name: '', credential: '', organization: '', faxNumber: '(212) 555-1234', phoneNumber: '', saveAsPcp: false },
  ],
};

const sendAndFail = async (failureReason?: FaxJobFailureReason): Promise<void> => {
  mockJobStatus = { jobStatus: 'failed', recipients: [], failureReason };
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useSendFax(SOURCE), { wrapper });

  await act(() => result.current.send(VALUES));

  await waitFor(() => expect(mockEnqueueSnackbar).toHaveBeenCalledTimes(1));
};

describe('useSendFax', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJobStatus = undefined;
  });

  it('explains a failure caused by the packet size limit', async () => {
    await sendAndFail('too-large');

    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      'The fax packet exceeds the maximum size of 20 MB. Please send fewer documents or reduce their size and try again.',
      { variant: 'error' }
    );
  });

  it('shows the generic failure when no reason was recorded', async () => {
    await sendAndFail();

    expect(mockEnqueueSnackbar).toHaveBeenCalledWith('The fax could not be processed. Please try again.', {
      variant: 'error',
    });
  });
});
