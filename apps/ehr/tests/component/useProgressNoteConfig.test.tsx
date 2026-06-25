import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { enqueueSnackbar } from 'notistack';
import { ReactNode } from 'react';
import { adminUpdateProgressNoteConfig, getProgressNoteConfig } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { DEFAULT_PROGRESS_NOTE_CONFIG } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProgressNoteConfig, useUpdateProgressNoteConfig } from '../../src/hooks/useProgressNoteConfig';

vi.mock('src/api/api', () => ({
  getProgressNoteConfig: vi.fn(),
  adminUpdateProgressNoteConfig: vi.fn(),
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: vi.fn(),
}));

vi.mock('notistack', () => ({
  enqueueSnackbar: vi.fn(),
}));

const mockOystehrZambda = {} as any;
const requiredProgressNoteConfig = { ...DEFAULT_PROGRESS_NOTE_CONFIG, mdmRequired: true };
const optionalProgressNoteConfig = { ...DEFAULT_PROGRESS_NOTE_CONFIG, mdmRequired: false };

const wrapper = ({ children }: { children: ReactNode }): JSX.Element => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe('useProgressNoteConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useApiClients).mockReturnValue({ oystehrZambda: mockOystehrZambda } as any);
  });

  it('fetches and returns the progress note config', async () => {
    vi.mocked(getProgressNoteConfig).mockResolvedValue(optionalProgressNoteConfig);

    const { result } = renderHook(() => useProgressNoteConfig(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(optionalProgressNoteConfig);
    expect(getProgressNoteConfig).toHaveBeenCalledWith(mockOystehrZambda);
  });

  it('is disabled (does not fetch) when the zambda client is unavailable', async () => {
    vi.mocked(useApiClients).mockReturnValue({ oystehrZambda: undefined } as any);
    vi.mocked(getProgressNoteConfig).mockResolvedValue(requiredProgressNoteConfig);

    const { result } = renderHook(() => useProgressNoteConfig(), { wrapper });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(getProgressNoteConfig).not.toHaveBeenCalled();
  });
});

describe('useUpdateProgressNoteConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useApiClients).mockReturnValue({ oystehrZambda: mockOystehrZambda } as any);
  });

  it('saves the config, shows a success snackbar, and invalidates the config query', async () => {
    vi.mocked(getProgressNoteConfig).mockResolvedValue(requiredProgressNoteConfig);
    vi.mocked(adminUpdateProgressNoteConfig).mockResolvedValue(undefined);

    const { result } = renderHook(
      () => ({
        query: useProgressNoteConfig(),
        update: useUpdateProgressNoteConfig(),
      }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    expect(getProgressNoteConfig).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.update.mutateAsync(optionalProgressNoteConfig);
    });

    expect(adminUpdateProgressNoteConfig).toHaveBeenCalledWith(mockOystehrZambda, optionalProgressNoteConfig);
    expect(enqueueSnackbar).toHaveBeenCalledWith('Progress note settings updated', { variant: 'success' });
    // onSuccess invalidates the shared query key, triggering a refetch.
    await waitFor(() => expect(getProgressNoteConfig).toHaveBeenCalledTimes(2));
  });

  it('shows an error snackbar when the update fails', async () => {
    vi.mocked(adminUpdateProgressNoteConfig).mockRejectedValue(new Error('failed'));

    const { result } = renderHook(() => useUpdateProgressNoteConfig(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(optionalProgressNoteConfig).catch(() => undefined);
    });

    expect(enqueueSnackbar).toHaveBeenCalledWith('Failed to update progress note settings.', { variant: 'error' });
  });

  it('throws when the zambda client is unavailable', async () => {
    vi.mocked(useApiClients).mockReturnValue({ oystehrZambda: undefined } as any);

    const { result } = renderHook(() => useUpdateProgressNoteConfig(), { wrapper });

    await expect(result.current.mutateAsync(optionalProgressNoteConfig)).rejects.toThrow('oystehr client is undefined');
    expect(adminUpdateProgressNoteConfig).not.toHaveBeenCalled();
  });

  it('does not populate admin-only defaults until config has loaded', async () => {
    let resolveConfig: ((value: typeof requiredProgressNoteConfig) => void) | undefined;
    vi.mocked(getProgressNoteConfig).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveConfig = resolve;
        })
    );

    const { result } = renderHook(() => useProgressNoteConfig(), { wrapper });

    expect(result.current.data).toBeUndefined();
    resolveConfig?.(requiredProgressNoteConfig);
    await waitFor(() => expect(result.current.data).toEqual(requiredProgressNoteConfig));
  });
});
