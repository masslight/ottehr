import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { adminUpdateProgressNoteConfig, getProgressNoteConfig } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProgressNoteAdminPage from '../../src/features/admin/ProgressNoteAdminPage';

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

// PageContainer pulls in the navigation sidebar chrome; stub it to a passthrough.
vi.mock('src/layout/PageContainer', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const mockOystehrZambda = {} as any;

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

const getMdmSwitch = (): HTMLInputElement =>
  screen.getByRole('checkbox', { name: /Medical Decision Making \(MDM\)/ }) as HTMLInputElement;

describe('ProgressNoteAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useApiClients).mockReturnValue({ oystehrZambda: mockOystehrZambda } as any);
  });

  it('renders the MDM switch checked when mdmRequired is true', async () => {
    vi.mocked(getProgressNoteConfig).mockResolvedValue({ mdmRequired: true });

    render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(getMdmSwitch()).toBeInTheDocument());
    expect(getMdmSwitch().checked).toBe(true);
  });

  it('renders the MDM switch unchecked when mdmRequired is false', async () => {
    vi.mocked(getProgressNoteConfig).mockResolvedValue({ mdmRequired: false });

    render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(getMdmSwitch()).toBeInTheDocument());
    expect(getMdmSwitch().checked).toBe(false);
  });

  it('saves mdmRequired: false when toggling the switch off', async () => {
    vi.mocked(getProgressNoteConfig).mockResolvedValue({ mdmRequired: true });
    vi.mocked(adminUpdateProgressNoteConfig).mockResolvedValue(undefined);

    render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(getMdmSwitch().checked).toBe(true));
    fireEvent.click(getMdmSwitch());

    await waitFor(() => {
      expect(adminUpdateProgressNoteConfig).toHaveBeenCalledWith(mockOystehrZambda, { mdmRequired: false });
    });
  });

  it('saves mdmRequired: true when toggling the switch on', async () => {
    vi.mocked(getProgressNoteConfig).mockResolvedValue({ mdmRequired: false });
    vi.mocked(adminUpdateProgressNoteConfig).mockResolvedValue(undefined);

    render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(getMdmSwitch().checked).toBe(false));
    fireEvent.click(getMdmSwitch());

    await waitFor(() => {
      expect(adminUpdateProgressNoteConfig).toHaveBeenCalledWith(mockOystehrZambda, { mdmRequired: true });
    });
  });

  it('shows an error alert when the settings fail to load', async () => {
    vi.mocked(getProgressNoteConfig).mockRejectedValue(new Error('boom'));

    render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

    await waitFor(() =>
      expect(screen.getByText('Failed to load the current progress note settings.')).toBeInTheDocument()
    );
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
