import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VisitType } from 'config-types';
import { Patient } from 'fhir/r4b';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { SERVICE_CATEGORY_SYSTEM } from 'utils/lib/fhir/constants';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { VisitNoteResponse } from 'utils/lib/types/api/chart-data/get-visit-note.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConvertFromVisit } from '../../src/features/visits/shared/components/patient/AddPatientFollowup';
import ScheduledFollowupParentSelector from '../../src/features/visits/shared/components/patient/ScheduledFollowupParentSelector';
import { emptyVisitNote } from './helpers/emptyVisitNote';

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

const getVisitNoteMock = vi.fn();
vi.mock('../../src/features/visits/shared/hooks/useOystehrAPIClient', () => ({
  useOystehrAPIClient: () => ({ getVisitNote: getVisitNoteMock }),
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
    getVisitNoteMock.mockReset();
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
      // The source visit's note has every copyable field populated.
      getVisitNoteMock.mockResolvedValue(
        emptyVisitNote({
          encounterNotes: {
            chiefComplaint: { resourceId: 'r1', text: 'narrative' },
            historyOfPresentIllness: { resourceId: 'r2', text: 'sore throat' },
            mechanismOfInjury: { resourceId: 'r3', text: 'slip' },
            accident: { resourceId: 'r4', type: ['AA'], date: '2025-01-01' },
          },
          assessment: {
            diagnosis: [{ resourceId: 'd1', code: 'J02.9', display: 'Dx', isPrimary: true }],
            cptCodes: [],
            procedures: [],
          },
          exam: {
            examObservations: [{ resourceId: 'e1', field: 'hr', value: true }],
            rosObservations: [{ resourceId: 'ro1', field: 'general', value: true }],
          },
        } as any)
      );
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
      // The source visit's note is empty.
      getVisitNoteMock.mockResolvedValue(emptyVisitNote());
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
  // OTR-3299: the Add Visit page seeds its Visit type / Service controls from whatever
  // this selector hands over, so assert the derived payload rather than its mere presence.
  describe('prefill derived from the parent visit (OTR-3299)', () => {
    const parentWithAppointment = {
      ...parentEncounterRow,
      appointment: {
        resourceType: 'Appointment',
        id: 'appt-1',
        status: 'fulfilled',
        meta: { tag: [{ code: OTTEHR_MODULE.IP }] },
        appointmentType: { text: 'prebook' },
        serviceCategory: [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code: 'urgent-care' }] }],
      },
    };

    beforeEach(() => {
      getVisitNoteMock.mockResolvedValue(emptyVisitNote());
    });

    const continueToAddVisit = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
      const button = await screen.findByRole('button', { name: /Continue to Add Visit/i });
      await waitFor(() => expect(button).toBeEnabled());
      await user.click(button);
      await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    };

    it('carries the parent visit type and service into navigation state', async () => {
      const user = userEvent.setup();
      mockParentEncounters(parentWithAppointment);
      renderWithProviders();

      await continueToAddVisit(user);

      const [, options] = navigateMock.mock.calls[0];
      expect(options.state.prefill).toEqual({
        visitType: VisitType.InPersonPreBook,
        serviceCategoryCode: 'urgent-care',
      });
    });

    it('sends an empty prefill when the parent encounter has no appointment', async () => {
      const user = userEvent.setup();
      mockParentEncounters(parentEncounterRow);
      renderWithProviders();

      await continueToAddVisit(user);

      const [, options] = navigateMock.mock.calls[0];
      expect(options.state.prefill).toEqual({});
    });
  });

  describe('convert mode', () => {
    // Keyed by encounter so the parent and the visit being converted can differ.
    const visitNotesByEncounter = (byEncounter: Record<string, Partial<VisitNoteResponse>>): void => {
      getVisitNoteMock.mockImplementation(({ encounterId }: { encounterId: string }) =>
        Promise.resolve(emptyVisitNote(byEncounter[encounterId] ?? {}))
      );
    };

    const POPULATED_PARENT = {
      encounterNotes: {
        chiefComplaint: { resourceId: 'r1', text: 'narrative' },
        historyOfPresentIllness: { resourceId: 'r2', text: 'sore throat' },
      },
      assessment: { diagnosis: [{ resourceId: 'd1', display: 'Dx' }], cptCodes: [], procedures: [] },
      exam: { examObservations: [{ resourceId: 'e1', field: 'hr' }], rosObservations: [] },
    } as unknown as Partial<VisitNoteResponse>;

    beforeEach(() => {
      mockParentEncounters(parentEncounterRow);
    });

    it('excludes the visit being converted from the parent options', () => {
      visitNotesByEncounter({});
      renderWithProviders({ convertFrom: CONVERT_FROM });
      expect(useParentEncountersMock).toHaveBeenCalledWith('pat-1', undefined, 'enc-target');
    });

    it('converts in place instead of navigating to Add Visit', async () => {
      const user = userEvent.setup();
      visitNotesByEncounter({ 'enc-1': POPULATED_PARENT });
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

    it('keeps fields the visit already documents copyable, flagging them instead of disabling', async () => {
      const user = userEvent.setup();
      visitNotesByEncounter({
        'enc-1': POPULATED_PARENT,
        // The visit being converted already has a "Chief Complaint" recorded. Note the storage
        // keys are swapped relative to the labels (see copyFollowupFields.ts): the "Chief
        // Complaint" checkbox reads reasonForVisit/historyOfPresentIllness, and "HPI" reads
        // chiefComplaint. Populating historyOfPresentIllness therefore collides with CC only.
        'enc-target': {
          encounterNotes: { historyOfPresentIllness: { resourceId: 'x1', text: 'already here' } },
        } as unknown as Partial<VisitNoteResponse>,
      });
      renderWithProviders({ convertFrom: CONVERT_FROM });

      const cc = await screen.findByRole('checkbox', { name: /Chief Complaint/ });
      await waitFor(() => expect(cc).toBeEnabled());
      expect(cc).toBeChecked();
      // The collision is surfaced on the label rather than blocking the copy.
      expect(screen.getByText('(this visit already has Chief Complaint)')).toBeVisible();

      await user.click(screen.getByRole('button', { name: /Convert to Follow-up/i }));

      await waitFor(() => expect(copyChartDataMock).toHaveBeenCalled());
      expect(copyChartDataMock.mock.calls[0][0].fields).toContain('chiefComplaint');
      expect(copyChartDataMock.mock.calls[0][0].fields).toContain('historyOfPresentIllness');
    });

    it('still carries diagnosis over when the visit already has one', async () => {
      const user = userEvent.setup();
      visitNotesByEncounter({
        'enc-1': POPULATED_PARENT,
        'enc-target': {
          assessment: { diagnosis: [{ resourceId: 'dx-existing', display: 'Existing' }], cptCodes: [], procedures: [] },
        } as unknown as Partial<VisitNoteResponse>,
      });
      renderWithProviders({ convertFrom: CONVERT_FROM });

      await waitFor(() => expect(screen.getByRole('checkbox', { name: /Diagnosis/ })).toBeEnabled());
      await user.click(screen.getByRole('button', { name: /Convert to Follow-up/i }));

      await waitFor(() => expect(convertVisitToFollowUpMock).toHaveBeenCalled());
      expect(convertVisitToFollowUpMock.mock.calls[0][1]).not.toHaveProperty('skipPatientDiagnosis');
    });

    it('never touches the reason for visit', async () => {
      const user = userEvent.setup();
      visitNotesByEncounter({ 'enc-1': POPULATED_PARENT });
      renderWithProviders({ convertFrom: CONVERT_FROM });

      await user.click(await screen.findByRole('button', { name: /Convert to Follow-up/i }));

      await waitFor(() => expect(convertVisitToFollowUpMock).toHaveBeenCalled());
      expect(updatePatientVisitDetailsMock).not.toHaveBeenCalled();
    });

    it('still lands on the converted visit when the copy fails', async () => {
      const user = userEvent.setup();
      visitNotesByEncounter({ 'enc-1': POPULATED_PARENT });
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
      visitNotesByEncounter({ 'enc-1': POPULATED_PARENT });
      convertVisitToFollowUpMock.mockRejectedValue(new Error('conflict'));
      renderWithProviders({ convertFrom: CONVERT_FROM });

      await user.click(await screen.findByRole('button', { name: /Convert to Follow-up/i }));

      await waitFor(() => expect(enqueueSnackbarMock).toHaveBeenCalledWith(expect.any(String), { variant: 'error' }));
      expect(navigateMock).not.toHaveBeenCalled();
      expect(copyChartDataMock).not.toHaveBeenCalled();
    });

    it("stays usable when the converted visit's own chart data fails to load", async () => {
      const user = userEvent.setup();
      getVisitNoteMock.mockImplementation(({ encounterId }: { encounterId: string }) =>
        encounterId === 'enc-target'
          ? Promise.reject(new Error('get-visit-note blew up'))
          : Promise.resolve(emptyVisitNote(POPULATED_PARENT))
      );
      renderWithProviders({ convertFrom: CONVERT_FROM });

      // The spinner clears and the parent's copyable fields still render.
      const cc = await screen.findByRole('checkbox', { name: 'Chief Complaint' });
      expect(cc).toBeEnabled();
      expect(screen.queryByText(/Checking the initial visit/i)).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Convert to Follow-up/i }));

      await waitFor(() => expect(convertVisitToFollowUpMock).toHaveBeenCalled());
    });
  });
});
