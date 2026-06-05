import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { adminUpdateProgressNoteConfig, getProgressNoteConfig } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { DEFAULT_PROGRESS_NOTE_CONFIG } from 'utils';
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
const getSaveButton = (): HTMLButtonElement => screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
const getDiscardButton = (): HTMLButtonElement =>
  screen.getByRole('button', { name: 'Discard changes' }) as HTMLButtonElement;
const getMdmDefaultField = (): HTMLTextAreaElement =>
  screen.getByLabelText('Default Medical Decision Making content') as HTMLTextAreaElement;

describe('ProgressNoteAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useApiClients).mockReturnValue({ oystehrZambda: mockOystehrZambda } as any);
  });

  it('renders the MDM switch checked when mdmRequired is true', async () => {
    vi.mocked(getProgressNoteConfig).mockResolvedValue(DEFAULT_PROGRESS_NOTE_CONFIG);

    render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(getMdmSwitch()).toBeInTheDocument());
    expect(getMdmSwitch().checked).toBe(true);
  });

  it('renders the MDM switch unchecked when mdmRequired is false', async () => {
    vi.mocked(getProgressNoteConfig).mockResolvedValue({ ...DEFAULT_PROGRESS_NOTE_CONFIG, mdmRequired: false });

    render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(getMdmSwitch()).toBeInTheDocument());
    expect(getMdmSwitch().checked).toBe(false);
  });

  it('saves mdmRequired: false when toggling the switch off', async () => {
    vi.mocked(getProgressNoteConfig).mockResolvedValue(DEFAULT_PROGRESS_NOTE_CONFIG);
    vi.mocked(adminUpdateProgressNoteConfig).mockResolvedValue(undefined);

    render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(getMdmSwitch().checked).toBe(true));
    fireEvent.click(getMdmSwitch());
    fireEvent.click(getSaveButton());

    await waitFor(() => {
      expect(adminUpdateProgressNoteConfig).toHaveBeenCalledWith(mockOystehrZambda, {
        ...DEFAULT_PROGRESS_NOTE_CONFIG,
        mdmRequired: false,
      });
    });
  });

  it('saves mdmRequired: true when toggling the switch on', async () => {
    vi.mocked(getProgressNoteConfig).mockResolvedValue({ ...DEFAULT_PROGRESS_NOTE_CONFIG, mdmRequired: false });
    vi.mocked(adminUpdateProgressNoteConfig).mockResolvedValue(undefined);

    render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(getMdmSwitch().checked).toBe(false));
    fireEvent.click(getMdmSwitch());
    fireEvent.click(getSaveButton());

    await waitFor(() => {
      expect(adminUpdateProgressNoteConfig).toHaveBeenCalledWith(mockOystehrZambda, DEFAULT_PROGRESS_NOTE_CONFIG);
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

  it('saves edited default text fields in the admin update payload', async () => {
    vi.mocked(getProgressNoteConfig).mockResolvedValue(DEFAULT_PROGRESS_NOTE_CONFIG);
    vi.mocked(adminUpdateProgressNoteConfig).mockResolvedValue(undefined);

    render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(getMdmDefaultField()).toBeInTheDocument());
    fireEvent.change(getMdmDefaultField(), {
      target: { value: 'Updated default MDM text.' },
    });
    fireEvent.click(getSaveButton());

    await waitFor(() => {
      expect(adminUpdateProgressNoteConfig).toHaveBeenCalledWith(mockOystehrZambda, {
        ...DEFAULT_PROGRESS_NOTE_CONFIG,
        medicalDecisionDefaultText: 'Updated default MDM text.',
      });
    });
  });

  it('shows validation errors and does not submit when a required text field is blank', async () => {
    vi.mocked(getProgressNoteConfig).mockResolvedValue(DEFAULT_PROGRESS_NOTE_CONFIG);
    vi.mocked(adminUpdateProgressNoteConfig).mockResolvedValue(undefined);

    render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(getMdmDefaultField()).toBeInTheDocument());
    fireEvent.change(getMdmDefaultField(), {
      target: { value: '   ' },
    });
    fireEvent.click(getSaveButton());

    await waitFor(() => {
      expect(screen.getByText('Medical Decision Making default text is required')).toBeInTheDocument();
    });
    expect(adminUpdateProgressNoteConfig).not.toHaveBeenCalled();
  });

  it('discards unsaved edits without submitting the form', async () => {
    vi.mocked(getProgressNoteConfig).mockResolvedValue(DEFAULT_PROGRESS_NOTE_CONFIG);
    vi.mocked(adminUpdateProgressNoteConfig).mockResolvedValue(undefined);

    render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(getMdmDefaultField()).toBeInTheDocument());
    fireEvent.change(getMdmDefaultField(), {
      target: { value: 'Unsaved draft text.' },
    });
    fireEvent.click(getDiscardButton());

    await waitFor(() => {
      expect(getMdmDefaultField().value).toBe(DEFAULT_PROGRESS_NOTE_CONFIG.medicalDecisionDefaultText);
    });
    expect(adminUpdateProgressNoteConfig).not.toHaveBeenCalled();
  });
});
