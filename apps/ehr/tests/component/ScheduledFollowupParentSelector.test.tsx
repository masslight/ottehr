import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Patient } from 'fhir/r4b';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConvertFromVisit } from '../../src/features/visits/shared/components/patient/AddPatientFollowup';
import ScheduledFollowupParentSelector from '../../src/features/visits/shared/components/patient/ScheduledFollowupParentSelector';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const useParentEncountersMock = vi.fn();
vi.mock('../../src/features/visits/shared/components/patient/useParentEncounters', () => ({
  useParentEncounters: (...args: unknown[]) => useParentEncountersMock(...args),
}));

const getChartDataMock = vi.fn();
vi.mock('../../src/features/visits/shared/hooks/useOystehrAPIClient', () => ({
  useOystehrAPIClient: () => ({ getChartData: getChartDataMock }),
}));

const convertVisitToFollowUpMock = vi.fn();
const updatePatientVisitDetailsMock = vi.fn();
vi.mock('../../src/api/api', () => ({
  convertVisitToFollowUp: (...args: unknown[]) => convertVisitToFollowUpMock(...args),
  updatePatientVisitDetails: (...args: unknown[]) => updatePatientVisitDetailsMock(...args),
}));

const oystehrZambda = { id: 'zambda-client' };
vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda }),
}));

const copyChartDataMock = vi.fn();
vi.mock('../../src/features/visits/shared/components/patient/useCopyChartDataToFollowup', () => ({
  useCopyChartDataToFollowup: () => ({ mutateAsync: copyChartDataMock }),
}));

const enqueueSnackbarMock = vi.fn();
vi.mock('notistack', () => ({
  enqueueSnackbar: (...args: unknown[]) => enqueueSnackbarMock(...args),
}));

const patient: Patient = {
  resourceType: 'Patient',
  id: 'pat-1',
  name: [{ given: ['Test'], family: 'Patient' }],
  birthDate: '1990-01-01',
  gender: 'female',
  telecom: [{ system: 'phone', value: '+15555550100' }],
};

const parentEncounterRow = {
  id: 'enc-1',
  encounter: { id: 'enc-1', resourceType: 'Encounter', status: 'finished' },
  location: undefined,
  dateTime: '2025-01-01T10:00:00Z',
  typeLabel: 'In-person',
};

const mockParentEncounters = (selected: typeof parentEncounterRow | undefined): void => {
  useParentEncountersMock.mockReturnValue({
    previousEncounters: [parentEncounterRow],
    selectedParentEncounter: selected,
    setSelectedParentEncounter: vi.fn(),
  });
};

const CONVERT_FROM: ConvertFromVisit = { appointmentId: 'appt-9', encounterId: 'enc-target' };

const renderWithProviders = (props: { convertFrom?: ConvertFromVisit } = {}): void => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
  render(<ScheduledFollowupParentSelector patient={patient} {...props} />, { wrapper });
};

describe('ScheduledFollowupParentSelector', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    getChartDataMock.mockReset();
    useParentEncountersMock.mockReset();
    convertVisitToFollowUpMock.mockReset();
    convertVisitToFollowUpMock.mockResolvedValue({ encounterId: 'enc-target', diagnosesCarriedOver: 0 });
    updatePatientVisitDetailsMock.mockReset();
    updatePatientVisitDetailsMock.mockResolvedValue(undefined);
    copyChartDataMock.mockReset();
    copyChartDataMock.mockResolvedValue(undefined);
    enqueueSnackbarMock.mockReset();
  });

  it('does NOT render the copy section before a parent visit is selected', () => {
    mockParentEncounters(undefined);
    renderWithProviders();
    expect(screen.queryByText('Copy from previous visit')).not.toBeInTheDocument();
  });

  describe('with a selected parent visit and populated chart data', () => {
    beforeEach(() => {
      mockParentEncounters(parentEncounterRow);
      // Both get-chart-data calls (scoped + unscoped) return populated source data.
      getChartDataMock.mockImplementation((params: { requestedFields?: unknown }) => {
        if (params.requestedFields) {
          return Promise.resolve({
            chiefComplaint: { resourceId: 'r1', text: 'narrative' },
            historyOfPresentIllness: { resourceId: 'r2', text: 'sore throat' },
            mechanismOfInjury: { resourceId: 'r3', text: 'slip' },
            accident: { resourceId: 'r4', date: '2025-01-01' },
          });
        }
        return Promise.resolve({
          diagnosis: [{ resourceId: 'd1', display: 'Dx' }],
          examObservations: [{ resourceId: 'e1', field: 'hr' }],
          rosObservations: [{ resourceId: 'ro1', field: 'general' }],
        });
      });
    });

    it('renders the copy section with all 6 checkboxes enabled and checked', async () => {
      renderWithProviders();
      await waitFor(() => expect(screen.getByText('Copy from previous visit')).toBeVisible());

      const labels = [
        'Chief Complaint',
        'HPI',
        'Mechanism of Injury (includes date of injury)',
        'Diagnosis',
        'Exam observations',
        'ROS observations',
      ];
      for (const label of labels) {
        const checkbox = await screen.findByRole('checkbox', { name: label });
        expect(checkbox).toBeEnabled();
        expect(checkbox).toBeChecked();
      }
    });

    it('passes followUpOptions WITHOUT skipPatientDiagnosis when diagnosis checkbox stays checked', async () => {
      const user = userEvent.setup();
      renderWithProviders();
      await screen.findByRole('checkbox', { name: 'Diagnosis' });

      await user.click(screen.getByRole('button', { name: /Continue to Add Visit/i }));

      await waitFor(() => expect(navigateMock).toHaveBeenCalled());
      const [, options] = navigateMock.mock.calls[0];
      expect(options.state.followUpOptions).toEqual({ parentEncounterId: 'enc-1' });
      // All 5 client-copyable fields included (diagnosis goes through followUpOptions, not here)
      expect(options.state.clientCopyFields).toEqual([
        'chiefComplaint',
        'historyOfPresentIllness',
        'mechanismOfInjury',
        'examObservations',
        'rosObservations',
      ]);
    });

    it('sets skipPatientDiagnosis: true when the diagnosis checkbox is unchecked', async () => {
      const user = userEvent.setup();
      renderWithProviders();
      const diagnosis = await screen.findByRole('checkbox', { name: 'Diagnosis' });
      await user.click(diagnosis);
      expect(diagnosis).not.toBeChecked();

      await user.click(screen.getByRole('button', { name: /Continue to Add Visit/i }));

      await waitFor(() => expect(navigateMock).toHaveBeenCalled());
      const [, options] = navigateMock.mock.calls[0];
      expect(options.state.followUpOptions).toEqual({
        parentEncounterId: 'enc-1',
        skipPatientDiagnosis: true,
      });
    });

    it('excludes unchecked client-side fields from clientCopyFields', async () => {
      const user = userEvent.setup();
      renderWithProviders();
      const hpi = await screen.findByRole('checkbox', { name: 'HPI' });
      await user.click(hpi);
      expect(hpi).not.toBeChecked();

      await user.click(screen.getByRole('button', { name: /Continue to Add Visit/i }));

      await waitFor(() => expect(navigateMock).toHaveBeenCalled());
      const [, options] = navigateMock.mock.calls[0];
      expect(options.state.clientCopyFields).not.toContain('historyOfPresentIllness');
      expect(options.state.clientCopyFields).toContain('chiefComplaint');
    });
  });

  describe('with empty chart data', () => {
    beforeEach(() => {
      mockParentEncounters(parentEncounterRow);
      // get-chart-data initializes requested fields to [] and unscoped call returns nothing.
      getChartDataMock.mockResolvedValue({});
    });

    it('disables empty-source checkboxes and excludes them from copy', async () => {
      const user = userEvent.setup();
      renderWithProviders();
      const cc = await screen.findByRole('checkbox', { name: 'Chief Complaint' });
      await waitFor(() => expect(cc).toBeDisabled());

      await user.click(screen.getByRole('button', { name: /Continue to Add Visit/i }));

      await waitFor(() => expect(navigateMock).toHaveBeenCalled());
      const [, options] = navigateMock.mock.calls[0];
      expect(options.state.clientCopyFields).toEqual([]);
      // diagnosis is empty too → server-side skipPatientDiagnosis must be set
      expect(options.state.followUpOptions).toEqual({
        parentEncounterId: 'enc-1',
        skipPatientDiagnosis: true,
      });
    });
  });

  describe('convert mode', () => {
    // Keyed by encounter so the parent and the visit being converted can differ.
    const chartDataByEncounter = (
      byEncounter: Record<string, { scoped?: Record<string, unknown>; unscoped?: Record<string, unknown> }>
    ): void => {
      getChartDataMock.mockImplementation((params: { encounterId: string; requestedFields?: unknown }) => {
        const entry = byEncounter[params.encounterId] ?? {};
        return Promise.resolve((params.requestedFields ? entry.scoped : entry.unscoped) ?? {});
      });
    };

    const POPULATED_PARENT = {
      scoped: {
        chiefComplaint: { resourceId: 'r1', text: 'narrative' },
        historyOfPresentIllness: { resourceId: 'r2', text: 'sore throat' },
      },
      unscoped: {
        diagnosis: [{ resourceId: 'd1', display: 'Dx' }],
        examObservations: [{ resourceId: 'e1', field: 'hr' }],
      },
    };

    beforeEach(() => {
      mockParentEncounters(parentEncounterRow);
    });

    it('excludes the visit being converted from the parent options', () => {
      chartDataByEncounter({});
      renderWithProviders({ convertFrom: CONVERT_FROM });
      expect(useParentEncountersMock).toHaveBeenCalledWith('pat-1', undefined, 'enc-target');
    });

    it('converts in place instead of navigating to Add Visit', async () => {
      const user = userEvent.setup();
      chartDataByEncounter({ 'enc-1': POPULATED_PARENT });
      renderWithProviders({ convertFrom: CONVERT_FROM });

      await user.click(await screen.findByRole('button', { name: /Convert to Follow-up/i }));

      await waitFor(() => expect(convertVisitToFollowUpMock).toHaveBeenCalled());
      expect(convertVisitToFollowUpMock).toHaveBeenCalledWith(oystehrZambda, {
        encounterId: 'enc-target',
        parentEncounterId: 'enc-1',
      });
      // The visit keeps its own encounter — the copy targets it, not a freshly created one.
      expect(copyChartDataMock).toHaveBeenCalledWith({
        sourceEncounterId: 'enc-1',
        targetEncounterId: 'enc-target',
        fields: ['chiefComplaint', 'historyOfPresentIllness', 'examObservations'],
      });
      await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/visit/appt-9'));
    });

    it('disables fields the visit already documents and leaves them out of the copy', async () => {
      const user = userEvent.setup();
      chartDataByEncounter({
        'enc-1': POPULATED_PARENT,
        // The visit being converted already has a "Chief Complaint" recorded. Note the storage
        // keys are swapped relative to the labels (see copyFollowupFields.ts): the "Chief
        // Complaint" checkbox reads reasonForVisit/historyOfPresentIllness, and "HPI" reads
        // chiefComplaint. Populating historyOfPresentIllness therefore collides with CC only.
        'enc-target': { scoped: { historyOfPresentIllness: { resourceId: 'x1', text: 'already here' } } },
      });
      renderWithProviders({ convertFrom: CONVERT_FROM });

      const cc = await screen.findByRole('checkbox', { name: 'Chief Complaint' });
      await waitFor(() => expect(cc).toBeDisabled());
      expect(await screen.findByRole('checkbox', { name: 'HPI' })).toBeEnabled();

      await user.click(screen.getByRole('button', { name: /Convert to Follow-up/i }));

      await waitFor(() => expect(copyChartDataMock).toHaveBeenCalled());
      expect(copyChartDataMock.mock.calls[0][0].fields).not.toContain('chiefComplaint');
      expect(copyChartDataMock.mock.calls[0][0].fields).toContain('historyOfPresentIllness');
    });

    it('skips diagnosis carry-over when the visit already has a diagnosis', async () => {
      const user = userEvent.setup();
      chartDataByEncounter({
        'enc-1': POPULATED_PARENT,
        'enc-target': { unscoped: { diagnosis: [{ resourceId: 'dx-existing', display: 'Existing' }] } },
      });
      renderWithProviders({ convertFrom: CONVERT_FROM });

      await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Diagnosis' })).toBeDisabled());
      await user.click(screen.getByRole('button', { name: /Convert to Follow-up/i }));

      await waitFor(() => expect(convertVisitToFollowUpMock).toHaveBeenCalled());
      expect(convertVisitToFollowUpMock.mock.calls[0][1]).toMatchObject({ skipPatientDiagnosis: true });
    });

    it('pre-fills an off-list reason as "Other" free text and leaves it untouched by default', async () => {
      const user = userEvent.setup();
      chartDataByEncounter({ 'enc-1': POPULATED_PARENT });
      renderWithProviders({ convertFrom: { ...CONVERT_FROM, reasonForVisit: 'Sore throat' } });

      expect(await screen.findByDisplayValue('Sore throat')).toBeVisible();

      await user.click(screen.getByRole('button', { name: /Convert to Follow-up/i }));

      await waitFor(() => expect(convertVisitToFollowUpMock).toHaveBeenCalled());
      // Unchanged reason must not trigger a write.
      expect(updatePatientVisitDetailsMock).not.toHaveBeenCalled();
    });

    it('persists the reason through update-visit-details when it is changed', async () => {
      const user = userEvent.setup();
      chartDataByEncounter({ 'enc-1': POPULATED_PARENT });
      renderWithProviders({ convertFrom: { ...CONVERT_FROM, reasonForVisit: 'Sore throat' } });

      await user.click(await screen.findByRole('combobox', { name: /Reason for visit/i }));
      await user.click(await screen.findByRole('option', { name: 'Dressing Change' }));
      await user.click(screen.getByRole('button', { name: /Convert to Follow-up/i }));

      await waitFor(() => expect(updatePatientVisitDetailsMock).toHaveBeenCalled());
      expect(updatePatientVisitDetailsMock).toHaveBeenCalledWith(oystehrZambda, {
        appointmentId: 'appt-9',
        bookingDetails: { reasonForVisit: 'Dressing Change' },
      });
    });

    it('still lands on the converted visit when the copy fails', async () => {
      const user = userEvent.setup();
      chartDataByEncounter({ 'enc-1': POPULATED_PARENT });
      copyChartDataMock.mockRejectedValue(new Error('save-chart-data blew up'));
      renderWithProviders({ convertFrom: CONVERT_FROM });

      await user.click(await screen.findByRole('button', { name: /Convert to Follow-up/i }));

      await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/visit/appt-9'));
      expect(enqueueSnackbarMock).toHaveBeenCalledWith(expect.stringContaining('could not be copied'), {
        variant: 'warning',
      });
    });

    it('does not navigate away when the conversion itself fails', async () => {
      const user = userEvent.setup();
      chartDataByEncounter({ 'enc-1': POPULATED_PARENT });
      convertVisitToFollowUpMock.mockRejectedValue(new Error('conflict'));
      renderWithProviders({ convertFrom: CONVERT_FROM });

      await user.click(await screen.findByRole('button', { name: /Convert to Follow-up/i }));

      await waitFor(() => expect(enqueueSnackbarMock).toHaveBeenCalledWith(expect.any(String), { variant: 'error' }));
      expect(navigateMock).not.toHaveBeenCalled();
      expect(copyChartDataMock).not.toHaveBeenCalled();
    });
  });
});
