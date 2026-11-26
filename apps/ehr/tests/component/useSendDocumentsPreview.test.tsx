import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { GetDocumentPacketPreviewOutput } from 'utils/lib/types/api/document-packet.types';
import { describe, expect, it, vi } from 'vitest';

const mockFetchPreview = vi.fn();
vi.mock('../../src/features/send-documents/api/documentPacketApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/send-documents/api/documentPacketApi')>()),
  fetchDocumentPacketPreview: (...args: unknown[]) => mockFetchPreview(...args),
}));
vi.mock('../../src/features/visits/shared/hooks/useOystehrAPIClient', () => ({ useOystehrAPIClient: () => ({}) }));
vi.mock('../../src/features/send-documents/hooks/useDocumentPacketStatus', () => ({
  useDocumentPacketStatuses: () => [],
}));
vi.mock('../../src/features/send-documents/hooks/useSendDocumentPacket', () => ({
  useSendDocumentPacket: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('../../src/features/send-documents/hooks/useFaxSender', () => ({
  useFaxSenderFaxNumber: () => ({ data: undefined }),
}));

import { DOCUMENT_PACKET_PREVIEW_QUERY_KEY } from '../../src/features/send-documents/hooks/useDocumentPacketPreview';
import { useSendDocuments } from '../../src/features/send-documents/hooks/useSendDocuments';

const previewFaxingTo = (faxNumber: string): GetDocumentPacketPreviewOutput => ({
  documents: [],
  recipient: { faxNumber },
  hasSavedPcp: true,
});

describe('useSendDocuments preview', () => {
  it('loads a fresh preview each time the dialog opens, so the form is never seeded from the last one', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSendDocuments({ type: 'referral', referralId: 'referral-1' }), { wrapper });

    mockFetchPreview.mockResolvedValueOnce(previewFaxingTo('2125550001'));
    act(() => result.current.open());
    await waitFor(() => expect(result.current.preview?.recipient?.faxNumber).toBe('2125550001'));

    act(() => result.current.close());
    // The recipient is changed and saved while the dialog is closed.
    mockFetchPreview.mockResolvedValueOnce(previewFaxingTo('2125550002'));
    await waitFor(() =>
      expect(queryClient.getQueryCache().find({ queryKey: [DOCUMENT_PACKET_PREVIEW_QUERY_KEY] })?.state.data).toBe(
        undefined
      )
    );
    act(() => result.current.open());

    expect(result.current.preview).toBeUndefined();
    expect(result.current.isLoadingPreview).toBe(true);
    await waitFor(() => expect(result.current.preview?.recipient?.faxNumber).toBe('2125550002'));
  });
});
