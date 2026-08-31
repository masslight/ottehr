import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Patient } from 'fhir/r4b';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

const renderWithProviders = (): void => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
  render(<ScheduledFollowupParentSelector patient={patient} />, { wrapper });
};

describe('ScheduledFollowupParentSelector', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    getChartDataMock.mockReset();
    useParentEncountersMock.mockReset();
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
});
