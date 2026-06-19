import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
const requiredProgressNoteConfig = { ...DEFAULT_PROGRESS_NOTE_CONFIG, mdmRequired: true };
const optionalProgressNoteConfig = { ...DEFAULT_PROGRESS_NOTE_CONFIG, mdmRequired: false };

const createTestQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const createWrapper =
  (queryClient = createTestQueryClient()) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );

const getMdmSwitch = (): HTMLInputElement =>
  screen.getByRole('checkbox', { name: 'MDM required for sign and close' }) as HTMLInputElement;
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
    vi.mocked(getProgressNoteConfig).mockResolvedValue(requiredProgressNoteConfig);

    render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(getMdmSwitch()).toBeInTheDocument());
    expect(getMdmSwitch().checked).toBe(true);
  });

  it('renders the MDM switch unchecked when mdmRequired is false', async () => {
    vi.mocked(getProgressNoteConfig).mockResolvedValue(optionalProgressNoteConfig);

    render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(getMdmSwitch()).toBeInTheDocument());
    expect(getMdmSwitch().checked).toBe(false);
  });

  it('saves mdmRequired: false when toggling the switch off', async () => {
    vi.mocked(getProgressNoteConfig).mockResolvedValue(requiredProgressNoteConfig);
    vi.mocked(adminUpdateProgressNoteConfig).mockResolvedValue(undefined);

    render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(getMdmSwitch().checked).toBe(true));
    fireEvent.click(getMdmSwitch());
    fireEvent.click(getSaveButton());

    await waitFor(() => {
      expect(adminUpdateProgressNoteConfig).toHaveBeenCalledWith(mockOystehrZambda, {
        ...requiredProgressNoteConfig,
        mdmRequired: false,
      });
    });
  });

  it('saves mdmRequired: true when toggling the switch on', async () => {
    vi.mocked(getProgressNoteConfig).mockResolvedValue(optionalProgressNoteConfig);
    vi.mocked(adminUpdateProgressNoteConfig).mockResolvedValue(undefined);

    render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(getMdmSwitch().checked).toBe(false));
    fireEvent.click(getMdmSwitch());
    fireEvent.click(getSaveButton());

    await waitFor(() => {
      expect(adminUpdateProgressNoteConfig).toHaveBeenCalledWith(mockOystehrZambda, requiredProgressNoteConfig);
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
    vi.mocked(getProgressNoteConfig).mockResolvedValue(requiredProgressNoteConfig);
    vi.mocked(adminUpdateProgressNoteConfig).mockResolvedValue(undefined);

    render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(getMdmDefaultField()).toBeInTheDocument());
    fireEvent.change(getMdmDefaultField(), {
      target: { value: 'Updated default MDM text.' },
    });
    fireEvent.click(getSaveButton());

    await waitFor(() => {
      expect(adminUpdateProgressNoteConfig).toHaveBeenCalledWith(mockOystehrZambda, {
        ...requiredProgressNoteConfig,
        medicalDecisionDefaultText: 'Updated default MDM text.',
      });
    });
  });

  it('shows validation errors and does not submit when a required text field is blank', async () => {
    vi.mocked(getProgressNoteConfig).mockResolvedValue(requiredProgressNoteConfig);
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

  it('renders the configured vitals unit input order', async () => {
    vi.mocked(getProgressNoteConfig).mockResolvedValue({
      ...requiredProgressNoteConfig,
      vitalsUnitInputOrder: 'imperial-metric',
    });

    render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByLabelText('Vital measurement unit input order')).toBeInTheDocument());
    expect(screen.getByText('Imperial / Metric')).toBeInTheDocument();
  });

  it('saves the selected vitals unit input order', async () => {
    vi.mocked(getProgressNoteConfig).mockResolvedValue(requiredProgressNoteConfig);
    vi.mocked(adminUpdateProgressNoteConfig).mockResolvedValue(undefined);

    render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByLabelText('Vital measurement unit input order')).toBeInTheDocument());

    fireEvent.mouseDown(screen.getByLabelText('Vital measurement unit input order'));
    fireEvent.click(await screen.findByRole('option', { name: 'Imperial / Metric' }));
    fireEvent.click(getSaveButton());

    await waitFor(() => {
      expect(adminUpdateProgressNoteConfig).toHaveBeenCalledWith(mockOystehrZambda, {
        ...requiredProgressNoteConfig,
        vitalsUnitInputOrder: 'imperial-metric',
      });
    });
  });

  it('discards unsaved edits without submitting the form', async () => {
    vi.mocked(getProgressNoteConfig).mockResolvedValue(requiredProgressNoteConfig);
    vi.mocked(adminUpdateProgressNoteConfig).mockResolvedValue(undefined);

    render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(getMdmDefaultField()).toBeInTheDocument());
    fireEvent.change(getMdmDefaultField(), {
      target: { value: 'Unsaved draft text.' },
    });
    fireEvent.click(getDiscardButton());

    await waitFor(() => {
      expect(getMdmDefaultField().value).toBe(requiredProgressNoteConfig.medicalDecisionDefaultText);
    });
    expect(adminUpdateProgressNoteConfig).not.toHaveBeenCalled();
  });

  it('preserves unsaved edits when the config query refreshes', async () => {
    vi.mocked(getProgressNoteConfig).mockResolvedValue(requiredProgressNoteConfig);

    const queryClient = createTestQueryClient();
    render(<ProgressNoteAdminPage />, { wrapper: createWrapper(queryClient) });

    await waitFor(() => expect(getMdmDefaultField()).toBeInTheDocument());
    fireEvent.change(getMdmDefaultField(), {
      target: { value: 'Unsaved draft text.' },
    });

    await act(async () => {
      queryClient.setQueryData(['progress-note-config'], {
        ...requiredProgressNoteConfig,
        medicalDecisionDefaultText: 'Background refresh text.',
      });
    });

    expect(getMdmDefaultField().value).toBe('Unsaved draft text.');
    expect(getSaveButton()).not.toBeDisabled();
  });
});
