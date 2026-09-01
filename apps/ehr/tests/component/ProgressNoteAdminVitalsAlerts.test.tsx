import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
import { VitalsAlertConfig } from 'utils/lib/types/api/vitals-alert-config/vitals-alert-config.types';
import { DEFAULT_PROGRESS_NOTE_CONFIG } from 'utils/lib/utils/progress-note-config';
import { DEFAULT_VITALS_ALERT_CONFIG } from 'utils/lib/utils/vitals-alert-config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProgressNoteAdminPage from '../../src/features/admin/ProgressNoteAdminPage';

// The alert levels are edited inside the progress note settings form and saved by its shared Save
// button, so these render the whole page.
vi.mock('src/api/api', () => ({
  getProgressNoteConfig: vi.fn(),
  adminUpdateProgressNoteConfig: vi.fn(),
  getVitalsAlertConfig: vi.fn(),
  adminUpdateVitalsAlertConfig: vi.fn(),
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: vi.fn(),
}));

vi.mock('notistack', () => ({
  enqueueSnackbar: vi.fn(),
}));

const mockOystehrZambda = {} as any;

const createWrapper =
  () =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}
    >
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );

const cloneDefault = (): VitalsAlertConfig => JSON.parse(JSON.stringify(DEFAULT_VITALS_ALERT_CONFIG));

const renderSection = async (): Promise<void> => {
  render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });
  await waitFor(() => expect(screen.getByTestId(dataTestIds.vitalsAlertConfig.addAgeRangeButton)).toBeInTheDocument());
};

/** The page's single shared Save button. */
const getSaveButton = (): HTMLButtonElement =>
  screen.getByTestId(dataTestIds.progressNoteAdmin.saveButton) as HTMLButtonElement;

/** Removal is confirmed through a dialog that spells out which range absorbs the deleted span. */
const removeAgeRange = async (index: number): Promise<void> => {
  fireEvent.click(screen.getByTestId(dataTestIds.vitalsAlertConfig.removeAgeRangeButton(index)));
  await waitFor(() =>
    expect(screen.getByTestId(dataTestIds.vitalsAlertConfig.removeAgeRangeDescription)).toBeInTheDocument()
  );
  fireEvent.click(screen.getByTestId(dataTestIds.dialog.proceedButton));
  await waitFor(() =>
    expect(screen.queryByTestId(dataTestIds.vitalsAlertConfig.removeAgeRangeDescription)).not.toBeInTheDocument()
  );
};

/** Collapsed accordions unmount their tables, so a vital has to be expanded before its inputs exist. */
const expandVital = async (vital: string): Promise<void> => {
  const accordion = screen.getByTestId(dataTestIds.vitalsAlertConfig.vitalAccordion(vital));
  fireEvent.click(within(accordion).getAllByRole('button')[0]);
  await waitFor(() => expect(within(accordion).getByRole('table')).toBeInTheDocument());
};

const heartRateAdultInput = (): HTMLInputElement =>
  screen
    .getByTestId(dataTestIds.vitalsAlertConfig.thresholdInput('vital-heartbeat', '18+y', 'abnormalHigh'))
    .querySelector('input') as HTMLInputElement;

/** Expands heart rate and returns its adult abnormal-high input. */
const openHeartRateAdultInput = async (): Promise<HTMLInputElement> => {
  await expandVital('vital-heartbeat');
  return heartRateAdultInput();
};

describe('ProgressNoteAdminPage - vital alert levels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useApiClients).mockReturnValue({ oystehrZambda: mockOystehrZambda } as any);
    vi.mocked(getProgressNoteConfig).mockResolvedValue(DEFAULT_PROGRESS_NOTE_CONFIG);
    vi.mocked(adminUpdateProgressNoteConfig).mockResolvedValue(undefined);
    vi.mocked(getVitalsAlertConfig).mockResolvedValue(DEFAULT_VITALS_ALERT_CONFIG);
    vi.mocked(adminUpdateVitalsAlertConfig).mockResolvedValue(undefined);
  });

  it('renders one row per configured age range and the loaded threshold values', async () => {
    await renderSection();

    expect(screen.getByTestId(dataTestIds.vitalsAlertConfig.ageRangeRow(0))).toBeInTheDocument();
    expect(
      screen.getByTestId(dataTestIds.vitalsAlertConfig.ageRangeRow(DEFAULT_VITALS_ALERT_CONFIG.ageRanges.length - 1))
    ).toBeInTheDocument();
    expect((await openHeartRateAdultInput()).value).toBe('100');
  });

  it('renders an accordion for every configurable vital', async () => {
    await renderSection();

    expect(screen.getByTestId(dataTestIds.vitalsAlertConfig.vitalAccordion('vital-weight'))).toBeInTheDocument();
    expect(screen.getByTestId(dataTestIds.vitalsAlertConfig.vitalAccordion('vital-height'))).toBeInTheDocument();
    expect(screen.getByTestId(dataTestIds.vitalsAlertConfig.vitalAccordion('vital-temperature'))).toBeInTheDocument();
    expect(screen.getByTestId(dataTestIds.vitalsAlertConfig.vitalAccordion('vital-heartbeat'))).toBeInTheDocument();
    expect(
      screen.getByTestId(dataTestIds.vitalsAlertConfig.vitalAccordion('vital-respiration-rate'))
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(dataTestIds.vitalsAlertConfig.vitalAccordion('vital-blood-pressure'))
    ).toBeInTheDocument();
    expect(screen.getByTestId(dataTestIds.vitalsAlertConfig.vitalAccordion('vital-oxygen-sat'))).toBeInTheDocument();
  });

  it('uses the shared AccordionCard, so it matches the vitals cards on the Vitals screen', async () => {
    await renderSection();

    const accordion = screen.getByTestId(dataTestIds.vitalsAlertConfig.vitalAccordion('vital-heartbeat'));
    // AccordionCard's toggle icon; a plain MUI Accordion renders ExpandMoreIcon.
    expect(accordion.querySelector('[data-testid="ArrowDropDownCircleOutlinedIcon"]')).toBeInTheDocument();
    expect(within(accordion).getByText('Heart rate (bpm)')).toBeInTheDocument();
  });

  it('keeps Save disabled until something changes', async () => {
    await renderSection();

    expect(getSaveButton()).toBeDisabled();
    fireEvent.change(await openHeartRateAdultInput(), { target: { value: '95' } });
    expect(getSaveButton()).not.toBeDisabled();
  });

  it('submits the edited threshold', async () => {
    await renderSection();

    fireEvent.change(await openHeartRateAdultInput(), { target: { value: '95' } });
    fireEvent.click(getSaveButton());

    await waitFor(() => expect(adminUpdateVitalsAlertConfig).toHaveBeenCalled());
    const [, payload] = vi.mocked(adminUpdateVitalsAlertConfig).mock.calls[0];
    expect(payload.config.thresholds['vital-heartbeat']['18+y'].abnormalHigh).toBe(95);
  });

  it('clears a level when the input is emptied, turning that alert off', async () => {
    await renderSection();

    fireEvent.change(await openHeartRateAdultInput(), { target: { value: '' } });
    fireEvent.click(getSaveButton());

    await waitFor(() => expect(adminUpdateVitalsAlertConfig).toHaveBeenCalled());
    const [, payload] = vi.mocked(adminUpdateVitalsAlertConfig).mock.calls[0];
    expect(payload.config.thresholds['vital-heartbeat']['18+y'].abnormalHigh).toBeUndefined();
  });

  it('surfaces a validation error and does not submit when levels are out of order', async () => {
    await renderSection();

    // Abnormal high below the abnormal low of 57.
    fireEvent.change(await openHeartRateAdultInput(), { target: { value: '40' } });
    fireEvent.click(getSaveButton());

    // Appears in the summary alert and as the field's helper text.
    await waitFor(() => expect(screen.getAllByText(/must be greater than or equal to/i).length).toBeGreaterThan(0));
    expect(screen.getByTestId(dataTestIds.vitalsAlertConfig.errorSummary)).toHaveTextContent(
      /must be greater than or equal to/i
    );
    expect(adminUpdateVitalsAlertConfig).not.toHaveBeenCalled();
  });

  it('surfaces a threshold error from a collapsed vital and opens that accordion', async () => {
    // SpO2 levels are out of order, putting the error in a vital that was never expanded.
    const config = cloneDefault();
    config.thresholds['vital-oxygen-sat']['18+y'] = { abnormalLow: 95, abnormalHigh: 90 };
    vi.mocked(getVitalsAlertConfig).mockResolvedValue(config);

    await renderSection();

    // Dirty the form elsewhere so Save is enabled.
    fireEvent.change(await openHeartRateAdultInput(), { target: { value: '99' } });
    fireEvent.click(getSaveButton());

    const summary = await waitFor(() => screen.getByTestId(dataTestIds.vitalsAlertConfig.errorSummary));
    expect(summary).toHaveTextContent(/SpO2/);
    expect(summary).toHaveTextContent(/18 yr and older/);
    expect(adminUpdateVitalsAlertConfig).not.toHaveBeenCalled();

    const spo2 = screen.getByTestId(dataTestIds.vitalsAlertConfig.vitalAccordion('vital-oxygen-sat'));
    await waitFor(() => expect(within(spo2).getByRole('table')).toBeInTheDocument());
  });

  it('shows the end-age unit that will actually be saved for an open-ended range', async () => {
    const config = cloneDefault();
    config.ageRanges = [{ id: 'only', minAge: { unit: 'months', value: 0 } }] as typeof config.ageRanges;
    config.thresholds = Object.fromEntries(
      Object.keys(config.thresholds).map((vital) => [vital, { only: { abnormalLow: 1, abnormalHigh: 2 } }])
    ) as unknown as typeof config.thresholds;
    vi.mocked(getVitalsAlertConfig).mockResolvedValue(config);

    await renderSection();

    const row = screen.getByTestId(dataTestIds.vitalsAlertConfig.ageRangeRow(0));
    const unitSelects = within(row).getAllByRole('combobox');
    expect(unitSelects[0]).toHaveTextContent('months');
    expect(unitSelects[1]).toHaveTextContent('months');
  });

  it('adds an age range without altering the existing one, leaving the boundary to the admin', async () => {
    await renderSection();

    const rangeCountBefore = DEFAULT_VITALS_ALERT_CONFIG.ageRanges.length;
    const lastBefore = DEFAULT_VITALS_ALERT_CONFIG.ageRanges[rangeCountBefore - 1];

    fireEvent.click(screen.getByTestId(dataTestIds.vitalsAlertConfig.addAgeRangeButton));

    await waitFor(() =>
      expect(screen.getByTestId(dataTestIds.vitalsAlertConfig.ageRangeRow(rangeCountBefore))).toBeInTheDocument()
    );

    const lastRow = screen.getByTestId(dataTestIds.vitalsAlertConfig.ageRangeRow(rangeCountBefore - 1));
    const lastRowInputs = within(lastRow).getAllByRole('spinbutton') as HTMLInputElement[];
    expect(lastRowInputs[0].value).toBe(String(lastBefore.minAge.value));
    expect(lastRowInputs[1].value).toBe('');

    // The new row has no start age yet.
    fireEvent.click(getSaveButton());
    await waitFor(() =>
      expect(screen.getByTestId(dataTestIds.vitalsAlertConfig.errorSummary)).toHaveTextContent(
        /Age range 15: Start age is required/i
      )
    );
    expect(adminUpdateVitalsAlertConfig).not.toHaveBeenCalled();

    // With a start age set, the remaining problem is two open-ended ranges.
    const newRow = screen.getByTestId(dataTestIds.vitalsAlertConfig.ageRangeRow(rangeCountBefore));
    fireEvent.change(within(newRow).getAllByRole('spinbutton')[0], { target: { value: '21' } });
    fireEvent.click(getSaveButton());
    await waitFor(() =>
      expect(screen.getByTestId(dataTestIds.vitalsAlertConfig.errorSummary)).toHaveTextContent(
        /Only the last age range may be open-ended/i
      )
    );
    expect(adminUpdateVitalsAlertConfig).not.toHaveBeenCalled();

    fireEvent.change(lastRowInputs[1], { target: { value: '21' } });

    fireEvent.click(getSaveButton());
    await waitFor(() => expect(adminUpdateVitalsAlertConfig).toHaveBeenCalled());
    const [, payload] = vi.mocked(adminUpdateVitalsAlertConfig).mock.calls[0];
    expect(payload.config.ageRanges).toHaveLength(rangeCountBefore + 1);
    expect(payload.config.thresholds['vital-weight'][payload.config.ageRanges[rangeCountBefore].id]).toEqual({});
  });

  it('removes the first age range, leaving a gap rather than pulling the next range down', async () => {
    await renderSection();

    const before = DEFAULT_VITALS_ALERT_CONFIG.ageRanges;
    await removeAgeRange(0);

    const payloadConfig = await (async () => {
      fireEvent.click(getSaveButton());
      await waitFor(() => expect(adminUpdateVitalsAlertConfig).toHaveBeenCalled());
      return vi.mocked(adminUpdateVitalsAlertConfig).mock.calls[0][1].config;
    })();

    expect(payloadConfig.ageRanges).toHaveLength(before.length - 1);
    expect(payloadConfig.thresholds['vital-weight'][before[0].id]).toBeUndefined();
    expect(payloadConfig.ageRanges[0].minAge).toEqual(before[1].minAge);
  });

  it('removes a middle age range without extending the previous one', async () => {
    await renderSection();

    const before = DEFAULT_VITALS_ALERT_CONFIG.ageRanges;
    await removeAgeRange(1);

    fireEvent.click(getSaveButton());
    await waitFor(() => expect(adminUpdateVitalsAlertConfig).toHaveBeenCalled());
    const [, payload] = vi.mocked(adminUpdateVitalsAlertConfig).mock.calls[0];

    expect(payload.config.ageRanges).toHaveLength(before.length - 1);
    expect(payload.config.ageRanges[0].maxAge).toEqual(before[0].maxAge);
  });

  it('allows a save that leaves a gap between age ranges', async () => {
    await renderSection();

    // Leaves 3-4mo unconfigured.
    const secondRow = screen.getByTestId(dataTestIds.vitalsAlertConfig.ageRangeRow(1));
    const secondRowInputs = within(secondRow).getAllByRole('spinbutton') as HTMLInputElement[];
    fireEvent.change(secondRowInputs[0], { target: { value: '4' } });

    fireEvent.click(getSaveButton());

    await waitFor(() => expect(adminUpdateVitalsAlertConfig).toHaveBeenCalled());
    const [, payload] = vi.mocked(adminUpdateVitalsAlertConfig).mock.calls[0];
    expect(payload.config.ageRanges[1].minAge).toEqual({ unit: 'months', value: 4 });
  });

  it('blocks a save where two age ranges overlap', async () => {
    await renderSection();

    // A 4-month-old would match both ranges.
    const firstRow = screen.getByTestId(dataTestIds.vitalsAlertConfig.ageRangeRow(0));
    const firstRowInputs = within(firstRow).getAllByRole('spinbutton') as HTMLInputElement[];
    fireEvent.change(firstRowInputs[1], { target: { value: '5' } });

    fireEvent.click(getSaveButton());

    await waitFor(() =>
      expect(screen.getByTestId(dataTestIds.vitalsAlertConfig.errorSummary)).toHaveTextContent(/must not overlap/i)
    );
    expect(adminUpdateVitalsAlertConfig).not.toHaveBeenCalled();
  });

  it('shows an error alert when the config fails to load', async () => {
    vi.mocked(getVitalsAlertConfig).mockRejectedValue(new Error('boom'));

    render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Failed to load the current vital alert levels.')).toBeInTheDocument());
    expect(screen.queryByTestId(dataTestIds.vitalsAlertConfig.addAgeRangeButton)).not.toBeInTheDocument();
  });
});
