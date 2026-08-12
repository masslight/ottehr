import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiClient: undefined as { sendFax: ReturnType<typeof vi.fn> } | undefined,
  enqueueSnackbar: vi.fn(),
}));

vi.mock('notistack', () => ({ enqueueSnackbar: mocks.enqueueSnackbar }));
vi.mock('src/features/visits/shared/hooks/useOystehrAPIClient', () => ({
  useOystehrAPIClient: () => mocks.apiClient,
}));

import { useSendFax } from '../../src/hooks/useSendFax';

const input = {
  target: { type: 'medical-record' as const, patientId: 'patient-1' },
  recipients: [{ faxNumber: '2125551234' }],
};

describe('useSendFax', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiClient = { sendFax: vi.fn() };
  });

  it('reports a successful single fax', async () => {
    mocks.apiClient!.sendFax.mockResolvedValue({ attemptIds: ['attempt-1'], failureCount: 0 });
    const { result } = renderHook(() => useSendFax());

    await act(() => result.current(input));

    expect(mocks.apiClient!.sendFax).toHaveBeenCalledWith(input);
    expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('Fax sent.', { variant: 'success' });
  });

  it('reports a partial multi-fax result', async () => {
    mocks.apiClient!.sendFax.mockResolvedValue({ attemptIds: ['attempt-1', 'attempt-2'], failureCount: 1 });
    const { result } = renderHook(() => useSendFax());

    await act(() => result.current(input));

    expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('2 of 3 faxes sent; the rest failed.', {
      variant: 'warning',
    });
  });

  it('surfaces and rethrows an API failure so the dialog stays open', async () => {
    mocks.apiClient!.sendFax.mockRejectedValue(new Error('Provider unavailable'));
    const { result } = renderHook(() => useSendFax());

    await expect(act(() => result.current(input))).rejects.toThrow('Provider unavailable');
    expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('Provider unavailable', { variant: 'error' });
  });

  it('rejects when the API client is unavailable', async () => {
    mocks.apiClient = undefined;
    const { result } = renderHook(() => useSendFax());

    await expect(act(() => result.current(input))).rejects.toThrow('api client not defined');
    expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('Could not initialize the API client. Please try again.', {
      variant: 'error',
    });
  });
});
