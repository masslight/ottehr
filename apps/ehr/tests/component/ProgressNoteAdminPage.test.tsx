import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import {
  adminUpdateProgressNoteConfig,
  adminUpdateVitalsAlertConfig,
  getProgressNoteConfig,
  getVitalsAlertConfig,
} from 'src/api/api';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useApiClients } from 'src/hooks/useAppClients';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { RoleType } from 'utils/lib/types/api/user.types';
import { DEFAULT_PROGRESS_NOTE_CONFIG } from 'utils/lib/utils/progress-note-config';
import { DEFAULT_VITALS_ALERT_CONFIG } from 'utils/lib/utils/vitals-alert-config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProgressNoteAdminPage from '../../src/features/admin/ProgressNoteAdminPage';

vi.mock('src/api/api', () => ({
  getProgressNoteConfig: vi.fn(),
  adminUpdateProgressNoteConfig: vi.fn(),
  // The page also mounts the vital alert levels section, which reads its own config.
  getVitalsAlertConfig: vi.fn(),
  adminUpdateVitalsAlertConfig: vi.fn(),
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: vi.fn(),
}));

vi.mock('src/hooks/useEvolveUser', () => ({
  default: vi.fn(),
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

/**
 * The prompt is customer-support-only, so a save from anyone else must leave the field out rather
 * than round-trip the value the form loaded — the server reads absence as "keep the stored prompt".
 */
const { signReviewPrompt: _signReviewPrompt, ...requiredConfigWithoutPrompt } = requiredProgressNoteConfig;

const asUser = (...roles: RoleType[]): void => {
  vi.mocked(useEvolveUser).mockReturnValue({
    hasRole: (requested: RoleType[]) => requested.some((role) => roles.includes(role)),
  } as any);
};

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
// Targeted by test id because the page has a single shared Save / Discard pair.
const getSaveButton = (): HTMLButtonElement =>
  screen.getByTestId(dataTestIds.progressNoteAdmin.saveButton) as HTMLButtonElement;
const getDiscardButton = (): HTMLButtonElement =>
  screen.getByTestId(dataTestIds.progressNoteAdmin.discardButton) as HTMLButtonElement;
const getMdmDefaultField = (): HTMLTextAreaElement =>
  screen.getByLabelText('Default Medical Decision Making content') as HTMLTextAreaElement;

describe('ProgressNoteAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useApiClients).mockReturnValue({ oystehrZambda: mockOystehrZambda } as any);
    vi.mocked(getVitalsAlertConfig).mockResolvedValue(DEFAULT_VITALS_ALERT_CONFIG);
    vi.mocked(adminUpdateVitalsAlertConfig).mockResolvedValue(undefined);
    asUser(RoleType.Administrator);
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
        ...requiredConfigWithoutPrompt,
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
      expect(adminUpdateProgressNoteConfig).toHaveBeenCalledWith(mockOystehrZambda, requiredConfigWithoutPrompt);
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
        ...requiredConfigWithoutPrompt,
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

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Vital measurement unit input order' })).toBeInTheDocument()
    );
    const unitOrderSelect = screen.getByRole('combobox', { name: 'Vital measurement unit input order' });

    // Before: the select reflects the loaded config's default order.
    expect(unitOrderSelect).toHaveTextContent('Metric / Imperial');

    fireEvent.mouseDown(unitOrderSelect);
    fireEvent.click(await screen.findByRole('option', { name: 'Imperial / Metric' }));

    // After: the select reflects the newly chosen order before we submit.
    expect(unitOrderSelect).toHaveTextContent('Imperial / Metric');

    fireEvent.click(getSaveButton());

    await waitFor(() => {
      expect(adminUpdateProgressNoteConfig).toHaveBeenCalledWith(mockOystehrZambda, {
        ...requiredConfigWithoutPrompt,
        vitalsUnitInputOrder: 'imperial-metric',
      });
    });
  });

  it('does not offer the note review prompt to a non-customer-support user', async () => {
    vi.mocked(getProgressNoteConfig).mockResolvedValue({
      ...requiredProgressNoteConfig,
      signReviewPrompt: 'Confirm at least 4 ROS systems are documented.',
    });

    render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(getMdmDefaultField()).toBeInTheDocument());
    expect(screen.queryByLabelText('Note review requirements')).not.toBeInTheDocument();
  });

  it('omits the stored prompt from a non-customer-support save', async () => {
    // The stale-prompt case: customer support edited the prompt after this form loaded. Submitting
    // the loaded copy would either revert their edit or be rejected outright.
    vi.mocked(getProgressNoteConfig).mockResolvedValue({
      ...requiredProgressNoteConfig,
      signReviewPrompt: 'Confirm at least 4 ROS systems are documented.',
    });
    vi.mocked(adminUpdateProgressNoteConfig).mockResolvedValue(undefined);

    render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(getMdmDefaultField()).toBeInTheDocument());
    fireEvent.change(getMdmDefaultField(), { target: { value: 'Updated default MDM text.' } });
    fireEvent.click(getSaveButton());

    await waitFor(() => {
      expect(adminUpdateProgressNoteConfig).toHaveBeenCalledWith(mockOystehrZambda, {
        ...requiredConfigWithoutPrompt,
        medicalDecisionDefaultText: 'Updated default MDM text.',
      });
    });
  });

  it('saves the prompt edited by customer support', async () => {
    asUser(RoleType.CustomerSupport);
    vi.mocked(getProgressNoteConfig).mockResolvedValue(requiredProgressNoteConfig);
    vi.mocked(adminUpdateProgressNoteConfig).mockResolvedValue(undefined);

    render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

    const promptField = await screen.findByLabelText('Note review requirements');
    fireEvent.change(promptField, { target: { value: 'Confirm at least 4 ROS systems are documented.' } });
    fireEvent.click(getSaveButton());

    await waitFor(() => {
      expect(adminUpdateProgressNoteConfig).toHaveBeenCalledWith(mockOystehrZambda, {
        ...requiredProgressNoteConfig,
        signReviewPrompt: 'Confirm at least 4 ROS systems are documented.',
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

  it('keeps the progress note settings editable when the vital alert levels fail to load', async () => {
    vi.mocked(getProgressNoteConfig).mockResolvedValue(requiredProgressNoteConfig);
    vi.mocked(getVitalsAlertConfig).mockRejectedValue(new Error('boom'));
    vi.mocked(adminUpdateProgressNoteConfig).mockResolvedValue(undefined);

    render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Failed to load the current vital alert levels.')).toBeInTheDocument());
    await waitFor(() => expect(getMdmSwitch()).toBeInTheDocument());

    fireEvent.click(getMdmSwitch());
    fireEvent.click(getSaveButton());

    await waitFor(() =>
      expect(adminUpdateProgressNoteConfig).toHaveBeenCalledWith(mockOystehrZambda, {
        ...requiredConfigWithoutPrompt,
        mdmRequired: false,
      })
    );
  });

  it('keeps the vital alert levels editable when the progress note settings fail to load', async () => {
    vi.mocked(getProgressNoteConfig).mockRejectedValue(new Error('boom'));
    vi.mocked(getVitalsAlertConfig).mockResolvedValue(DEFAULT_VITALS_ALERT_CONFIG);

    render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

    await waitFor(() =>
      expect(screen.getByText('Failed to load the current progress note settings.')).toBeInTheDocument()
    );
    expect(screen.getByTestId(dataTestIds.vitalsAlertConfig.addAgeRangeButton)).toBeInTheDocument();
  });

  it('submits trimmed text, so the saved baseline matches what the server stores', async () => {
    vi.mocked(getProgressNoteConfig).mockResolvedValue(requiredProgressNoteConfig);
    vi.mocked(adminUpdateProgressNoteConfig).mockResolvedValue(undefined);

    render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(getMdmDefaultField()).toBeInTheDocument());
    fireEvent.change(getMdmDefaultField(), { target: { value: '   Padded MDM text.   ' } });
    fireEvent.click(getSaveButton());

    await waitFor(() => expect(adminUpdateProgressNoteConfig).toHaveBeenCalled());
    const [, payload] = vi.mocked(adminUpdateProgressNoteConfig).mock.calls[0];
    expect(payload.medicalDecisionDefaultText).toBe('Padded MDM text.');
  });

  describe('shared Save / Discard across both config sections', () => {
    const getVitalThresholdInput = async (): Promise<HTMLInputElement> => {
      const accordion = screen.getByTestId(dataTestIds.vitalsAlertConfig.vitalAccordion('vital-heartbeat'));
      fireEvent.click(within(accordion).getAllByRole('button')[0]);
      await waitFor(() => expect(within(accordion).getByRole('table')).toBeInTheDocument());
      return screen
        .getByTestId(dataTestIds.vitalsAlertConfig.thresholdInput('vital-heartbeat', '18+y', 'abnormalHigh'))
        .querySelector('input') as HTMLInputElement;
    };

    it('renders both config sections inside a single Paper with one Save and one Discard', async () => {
      vi.mocked(getProgressNoteConfig).mockResolvedValue(requiredProgressNoteConfig);

      const { container } = render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

      await waitFor(() => expect(getMdmSwitch()).toBeInTheDocument());
      expect(container.querySelectorAll('.MuiPaper-root form, form.MuiPaper-root')).toHaveLength(1);
      expect(screen.getByTestId(dataTestIds.vitalsAlertConfig.section)).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Save' })).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: 'Discard changes' })).toHaveLength(1);
    });

    it('enables the shared Save when only the vital alert levels change', async () => {
      vi.mocked(getProgressNoteConfig).mockResolvedValue(requiredProgressNoteConfig);

      render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });
      await waitFor(() => expect(getMdmSwitch()).toBeInTheDocument());
      expect(getSaveButton()).toBeDisabled();

      fireEvent.change(await getVitalThresholdInput(), { target: { value: '95' } });

      expect(getSaveButton()).not.toBeDisabled();
    });

    it('saves only the section that changed', async () => {
      vi.mocked(getProgressNoteConfig).mockResolvedValue(requiredProgressNoteConfig);

      render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });
      await waitFor(() => expect(getMdmSwitch()).toBeInTheDocument());

      fireEvent.change(await getVitalThresholdInput(), { target: { value: '95' } });
      fireEvent.click(getSaveButton());

      await waitFor(() => expect(adminUpdateVitalsAlertConfig).toHaveBeenCalledTimes(1));
      expect(adminUpdateProgressNoteConfig).not.toHaveBeenCalled();
    });

    it('saves both sections from one click when both changed', async () => {
      vi.mocked(getProgressNoteConfig).mockResolvedValue(requiredProgressNoteConfig);

      render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });
      await waitFor(() => expect(getMdmSwitch()).toBeInTheDocument());

      fireEvent.click(getMdmSwitch());
      fireEvent.change(await getVitalThresholdInput(), { target: { value: '95' } });
      fireEvent.click(getSaveButton());

      await waitFor(() => expect(adminUpdateProgressNoteConfig).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(adminUpdateVitalsAlertConfig).toHaveBeenCalledTimes(1));
    });

    it('saves neither section when the other one is invalid', async () => {
      vi.mocked(getProgressNoteConfig).mockResolvedValue(requiredProgressNoteConfig);

      render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });
      await waitFor(() => expect(getMdmDefaultField()).toBeInTheDocument());

      fireEvent.change(getMdmDefaultField(), { target: { value: 'Updated default MDM text.' } });
      fireEvent.change(await getVitalThresholdInput(), { target: { value: '40' } });
      fireEvent.click(getSaveButton());

      // Reported in the section's summary alert and as the field's helper text.
      await waitFor(() =>
        expect(screen.getByTestId(dataTestIds.vitalsAlertConfig.errorSummary)).toHaveTextContent(
          /must be greater than or equal to/i
        )
      );
      // The valid half must not be written on its own.
      expect(adminUpdateProgressNoteConfig).not.toHaveBeenCalled();
      expect(adminUpdateVitalsAlertConfig).not.toHaveBeenCalled();
    });

    it('discards edits in both sections', async () => {
      vi.mocked(getProgressNoteConfig).mockResolvedValue(requiredProgressNoteConfig);

      render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });
      await waitFor(() => expect(getMdmSwitch()).toBeInTheDocument());

      fireEvent.click(getMdmSwitch());
      const thresholdInput = await getVitalThresholdInput();
      fireEvent.change(thresholdInput, { target: { value: '95' } });
      expect(getSaveButton()).not.toBeDisabled();

      fireEvent.click(getDiscardButton());

      await waitFor(() => expect(getMdmSwitch().checked).toBe(true));
      expect(thresholdInput.value).toBe('100');
      expect(getSaveButton()).toBeDisabled();
      expect(adminUpdateProgressNoteConfig).not.toHaveBeenCalled();
      expect(adminUpdateVitalsAlertConfig).not.toHaveBeenCalled();
    });
  });
});
