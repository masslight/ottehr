import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { BrowserRouter, useNavigate, useParams } from 'react-router-dom';
import { useProgressNoteConfig } from 'src/hooks/useProgressNoteConfig';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dataTestIds } from '../../src/constants/data-test-ids';
import { MissingCard } from '../../src/features/visits/shared/components/review-tab/MissingCard';
import { useGetVitals } from '../../src/features/visits/shared/components/vitals/hooks/useGetVitals';
import { useChartFields } from '../../src/features/visits/shared/hooks/useChartFields';
import { useGetAppointmentAccessibility } from '../../src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useOystehrAPIClient } from '../../src/features/visits/shared/hooks/useOystehrAPIClient';
import { useAiSuggestionNotes } from '../../src/features/visits/shared/stores/appointment/appointment.queries';
import {
  useAppointmentData,
  useChartData,
} from '../../src/features/visits/shared/stores/appointment/appointment.store';
import { useExamObservationsInitializationStore } from '../../src/features/visits/shared/stores/appointment/exam-observations.store';
import {
  holdPendingObservationFields,
  resetPendingObservationFields,
} from '../../src/features/visits/shared/stores/appointment/pending-observation-fields.store';
import { useRosObservationsInitializationStore } from '../../src/features/visits/shared/stores/appointment/ros-observations.store';

vi.mock('../../src/features/visits/shared/hooks/useChartFields', () => ({
  useChartFields: vi.fn(),
}));

vi.mock('../../src/features/visits/shared/hooks/useOystehrAPIClient', () => ({
  useOystehrAPIClient: vi.fn(),
}));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: vi.fn(),
}));

vi.mock('../../src/features/visits/shared/components/vitals/hooks/useGetVitals', () => ({
  useGetVitals: vi.fn(),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useAiSuggestionNotes: vi.fn(),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: vi.fn(),
  useChartData: vi.fn(),
}));

vi.mock('src/hooks/useProgressNoteConfig', () => ({
  useProgressNoteConfig: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
    useParams: vi.fn(),
  };
});

const mockUseAppointmentData = vi.mocked(useAppointmentData);
const mockUseChartData = vi.mocked(useChartData);
const mockUseChartFields = vi.mocked(useChartFields);
const mockUseAiSuggestionNotes = vi.mocked(useAiSuggestionNotes);
const mockUseNavigate = vi.mocked(useNavigate);
const mockUseParams = vi.mocked(useParams);
const mockUseProgressNoteConfig = vi.mocked(useProgressNoteConfig);
const mockUseOystehrAPIClient = vi.mocked(useOystehrAPIClient);
const mockUseGetAppointmentAccessibility = vi.mocked(useGetAppointmentAccessibility);
const mockUseGetVitals = vi.mocked(useGetVitals);

const aiSuggestionNotes = vi.fn();

const createWrapper = (): (({ children }: { children: ReactNode }) => JSX.Element) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('MissingCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });

    // The note review waits on both observation stores having been hydrated from chart data, and
    // on no observation write being in flight.
    useRosObservationsInitializationStore.setState({ hasInitialData: true });
    useExamObservationsInitializationStore.setState({ hasInitialData: true });
    resetPendingObservationFields();

    mockUseAppointmentData.mockReturnValue({
      appointment: { id: 'appointment-123' },
      encounter: { id: 'encounter-123' },
    } as any);
    mockUseParams.mockReturnValue({ id: 'appointment-123' } as any);

    mockUseChartData.mockReturnValue({
      chartData: {
        diagnosis: [{ isPrimary: true }],
        emCode: '99213',
      },
    } as any);

    mockUseChartFields.mockReturnValue({
      data: {
        medicalDecision: { text: 'Medical decision' },
        chiefComplaint: { text: 'Chief complaint' },
        patientInfoConfirmed: { value: false },
      },
      isFetching: false,
      isFetched: true,
    } as any);

    mockUseAiSuggestionNotes.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ suggestions: [] }),
    } as any);

    mockUseProgressNoteConfig.mockReturnValue({
      data: { mdmRequired: true },
    } as any);

    aiSuggestionNotes.mockResolvedValue({ suggestions: [] });
    mockUseOystehrAPIClient.mockReturnValue({ aiSuggestionNotes } as any);
    mockUseGetAppointmentAccessibility.mockReturnValue({ isAppointmentReadOnly: false } as any);
    mockUseGetVitals.mockReturnValue({ data: undefined, isFetched: true } as any);
  });

  const renderComponent = (): void => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MissingCard />
      </Wrapper>
    );
  };

  /** Everything present, so the card is driven only by the note review. */
  const withCompleteNote = (): void => {
    mockUseChartFields.mockReturnValue({
      data: {
        medicalDecision: { text: 'Medical decision' },
        chiefComplaint: { text: 'Chief complaint' },
        patientInfoConfirmed: { value: true },
      },
      isFetching: false,
      isFetched: true,
    } as any);
  };

  it('shows the patient verification link for in-person visits when verification is missing', () => {
    const navigate = vi.fn();
    mockUseNavigate.mockReturnValue(navigate);

    renderComponent();

    const verificationLink = screen.getByTestId(dataTestIds.progressNotePage.patientVerificationLink);

    expect(verificationLink).toBeVisible();
    fireEvent.click(verificationLink);
    expect(navigate).toHaveBeenCalledWith('/in-person/appointment-123/cc-and-intake-notes');
  });

  it('renders the missing card when patient verification is the only missing item', () => {
    mockUseNavigate.mockReturnValue(vi.fn());

    renderComponent();

    expect(screen.getByTestId(dataTestIds.progressNotePage.missingCard)).toBeVisible();
    expect(screen.getByTestId(dataTestIds.progressNotePage.patientVerificationLink)).toBeVisible();
  });

  it('shows the MDM link when MDM is missing and mdmRequired is true', () => {
    mockUseNavigate.mockReturnValue(vi.fn());
    mockUseChartFields.mockReturnValue({
      data: {
        medicalDecision: undefined,
        chiefComplaint: { text: 'Chief complaint' },
        patientInfoConfirmed: { value: true },
      },
      isFetching: false,
      isFetched: true,
    } as any);
    mockUseProgressNoteConfig.mockReturnValue({ data: { mdmRequired: true } } as any);

    renderComponent();

    expect(screen.getByTestId(dataTestIds.progressNotePage.medicalDecisionLink)).toBeVisible();
  });

  it('hides the missing card when MDM is the only missing item and mdmRequired is false', () => {
    mockUseNavigate.mockReturnValue(vi.fn());
    mockUseChartFields.mockReturnValue({
      data: {
        medicalDecision: undefined,
        chiefComplaint: { text: 'Chief complaint' },
        patientInfoConfirmed: { value: true },
      },
      isFetching: false,
      isFetched: true,
    } as any);
    mockUseProgressNoteConfig.mockReturnValue({ data: { mdmRequired: false } } as any);

    renderComponent();

    expect(screen.queryByTestId(dataTestIds.progressNotePage.missingCard)).not.toBeInTheDocument();
    expect(screen.queryByTestId(dataTestIds.progressNotePage.medicalDecisionLink)).not.toBeInTheDocument();
  });

  describe('AI note review', () => {
    it('does not request a review when no prompt is configured', async () => {
      mockUseNavigate.mockReturnValue(vi.fn());
      withCompleteNote();
      mockUseProgressNoteConfig.mockReturnValue({ data: { mdmRequired: true } } as any);

      renderComponent();

      await waitFor(() =>
        expect(screen.queryByTestId(dataTestIds.progressNotePage.missingCard)).not.toBeInTheDocument()
      );
      expect(aiSuggestionNotes).not.toHaveBeenCalled();
    });

    it('renders the returned warnings and sends only the visit identifiers', async () => {
      mockUseNavigate.mockReturnValue(vi.fn());
      withCompleteNote();
      mockUseProgressNoteConfig.mockReturnValue({
        data: { mdmRequired: true, signReviewPrompt: 'Check ROS and Exam' },
      } as any);
      aiSuggestionNotes.mockResolvedValue({
        suggestions: [
          'Please go to ROS and verify 4 systems/1 item each selected',
          'Please go to EXAM and verify 4 systems/1 item each selected',
        ],
      });

      renderComponent();

      expect(await screen.findByText('Please go to ROS and verify 4 systems/1 item each selected')).toBeVisible();
      expect(screen.getByText('Please go to EXAM and verify 4 systems/1 item each selected')).toBeVisible();
      expect(aiSuggestionNotes).toHaveBeenCalledWith({
        type: 'note-review',
        appointmentId: 'appointment-123',
        encounterId: 'encounter-123',
      });
    });

    it('waits for the ROS and exam stores to hydrate before reviewing', async () => {
      mockUseNavigate.mockReturnValue(vi.fn());
      withCompleteNote();
      useRosObservationsInitializationStore.setState({ hasInitialData: false });
      mockUseProgressNoteConfig.mockReturnValue({
        data: { mdmRequired: true, signReviewPrompt: 'Check ROS and Exam' },
      } as any);

      renderComponent();

      await waitFor(() =>
        expect(screen.queryByTestId(dataTestIds.progressNotePage.missingCard)).not.toBeInTheDocument()
      );
      expect(aiSuggestionNotes).not.toHaveBeenCalled();
    });

    it('does not review a read-only appointment', async () => {
      mockUseNavigate.mockReturnValue(vi.fn());
      withCompleteNote();
      mockUseGetAppointmentAccessibility.mockReturnValue({ isAppointmentReadOnly: true } as any);
      mockUseProgressNoteConfig.mockReturnValue({
        data: { mdmRequired: true, signReviewPrompt: 'Check ROS and Exam' },
      } as any);

      renderComponent();

      await waitFor(() =>
        expect(screen.queryByTestId(dataTestIds.progressNotePage.missingCard)).not.toBeInTheDocument()
      );
      expect(aiSuggestionNotes).not.toHaveBeenCalled();
    });

    it('re-reviews when a vital is recorded, so a vitals-based prompt can clear', async () => {
      mockUseNavigate.mockReturnValue(vi.fn());
      withCompleteNote();
      mockUseProgressNoteConfig.mockReturnValue({
        data: { mdmRequired: true, signReviewPrompt: 'Confirm color vision is documented' },
      } as any);
      aiSuggestionNotes.mockResolvedValue({ suggestions: ['Please document Color Vision results prior to signing.'] });

      const { rerender, Wrapper } = (() => {
        const Wrapper = createWrapper();
        const { rerender } = render(
          <Wrapper>
            <MissingCard />
          </Wrapper>
        );
        return { rerender, Wrapper };
      })();

      expect(await screen.findByText('Please document Color Vision results prior to signing.')).toBeVisible();
      expect(aiSuggestionNotes).toHaveBeenCalledTimes(1);

      // Vitals live outside chart data, so they have to participate in the cache key themselves.
      mockUseGetVitals.mockReturnValue({
        data: { 'vital-vision': [{ resourceId: 'obs-1' }] },
        isFetched: true,
      } as any);
      aiSuggestionNotes.mockResolvedValue({ suggestions: [] });
      rerender(
        <Wrapper>
          <MissingCard />
        </Wrapper>
      );

      await waitFor(() => expect(aiSuggestionNotes).toHaveBeenCalledTimes(2));
    });

    it('reviews once per page load rather than on each source settling', async () => {
      mockUseNavigate.mockReturnValue(vi.fn());
      withCompleteNote();
      mockUseProgressNoteConfig.mockReturnValue({
        data: { mdmRequired: true, signReviewPrompt: 'Check ROS and Exam' },
      } as any);
      aiSuggestionNotes.mockResolvedValue({ suggestions: ['Please go to ROS and verify 4 systems'] });

      renderComponent();

      expect(await screen.findByText('Please go to ROS and verify 4 systems')).toBeVisible();
      expect(aiSuggestionNotes).toHaveBeenCalledTimes(1);
    });

    it('waits for chart fields to settle before reviewing', async () => {
      mockUseNavigate.mockReturnValue(vi.fn());
      // First render of the page: the chart query has not resolved, so a review fired now would be
      // keyed on a hash of undefined chart data — and re-fired under a new key once it lands.
      mockUseChartFields.mockReturnValue({ data: undefined, isFetching: true, isFetched: false } as any);
      mockUseProgressNoteConfig.mockReturnValue({
        data: { mdmRequired: true, signReviewPrompt: 'Check ROS and Exam' },
      } as any);

      const Wrapper = createWrapper();
      const { rerender } = render(
        <Wrapper>
          <MissingCard />
        </Wrapper>
      );

      await waitFor(() => expect(screen.getByTestId(dataTestIds.progressNotePage.hpiLink)).toBeVisible());
      expect(aiSuggestionNotes).not.toHaveBeenCalled();

      withCompleteNote();
      rerender(
        <Wrapper>
          <MissingCard />
        </Wrapper>
      );

      // One review, against the settled note.
      await waitFor(() => expect(aiSuggestionNotes).toHaveBeenCalledTimes(1));
    });

    it('does not review while an observation write is in flight', async () => {
      mockUseNavigate.mockReturnValue(vi.fn());
      withCompleteNote();
      mockUseProgressNoteConfig.mockReturnValue({
        data: { mdmRequired: true, signReviewPrompt: 'Check ROS and Exam' },
      } as any);
      // A ROS box was just checked: the store is already updated, but FHIR is not, so a review now
      // would be answered from the pre-save note and then cached under the post-edit hash forever.
      const release = holdPendingObservationFields(['ros-constitutional-fever']);

      renderComponent();

      await waitFor(() =>
        expect(screen.queryByTestId(dataTestIds.progressNotePage.missingCard)).not.toBeInTheDocument()
      );
      expect(aiSuggestionNotes).not.toHaveBeenCalled();

      act(() => release());

      await waitFor(() => expect(aiSuggestionNotes).toHaveBeenCalledTimes(1));
    });

    it('re-reviews when the configured prompt changes', async () => {
      mockUseNavigate.mockReturnValue(vi.fn());
      withCompleteNote();
      mockUseProgressNoteConfig.mockReturnValue({
        data: { mdmRequired: true, signReviewPrompt: 'Check ROS and Exam' },
      } as any);
      aiSuggestionNotes.mockResolvedValue({ suggestions: ['Please go to ROS and verify 4 systems'] });

      const Wrapper = createWrapper();
      const { rerender } = render(
        <Wrapper>
          <MissingCard />
        </Wrapper>
      );

      expect(await screen.findByText('Please go to ROS and verify 4 systems')).toBeVisible();

      // Customer support reworded the prompt; the cached review was produced by the old one.
      mockUseProgressNoteConfig.mockReturnValue({
        data: { mdmRequired: true, signReviewPrompt: 'Confirm the ROS covers 4 systems' },
      } as any);
      rerender(
        <Wrapper>
          <MissingCard />
        </Wrapper>
      );

      await waitFor(() => expect(aiSuggestionNotes).toHaveBeenCalledTimes(2));
    });

    it('survives a malformed suggestions payload', async () => {
      mockUseNavigate.mockReturnValue(vi.fn());
      mockUseProgressNoteConfig.mockReturnValue({
        data: { mdmRequired: true, signReviewPrompt: 'Check ROS and Exam' },
      } as any);
      aiSuggestionNotes.mockResolvedValue({ suggestions: 'not a list' });

      renderComponent();

      // Patient verification is still missing, so the card stays open and must render without throwing.
      expect(await screen.findByTestId(dataTestIds.progressNotePage.patientVerificationLink)).toBeVisible();
    });

    it('reports an unavailable review rather than silently passing the note', async () => {
      mockUseNavigate.mockReturnValue(vi.fn());
      mockUseProgressNoteConfig.mockReturnValue({
        data: { mdmRequired: true, signReviewPrompt: 'Check ROS and Exam' },
      } as any);
      aiSuggestionNotes.mockRejectedValue(new Error('vertex unavailable'));

      renderComponent();

      expect(await screen.findByText('Note review unavailable')).toBeVisible();
    });

    it('reports an unavailable review on an otherwise complete note', async () => {
      // The case the status line exists for: nothing else is missing, so the card would return null
      // and the provider would sign believing the review passed.
      mockUseNavigate.mockReturnValue(vi.fn());
      withCompleteNote();
      mockUseProgressNoteConfig.mockReturnValue({
        data: { mdmRequired: true, signReviewPrompt: 'Check ROS and Exam' },
      } as any);
      aiSuggestionNotes.mockRejectedValue(new Error('vertex unavailable'));

      renderComponent();

      expect(await screen.findByText('Note review unavailable')).toBeVisible();
      expect(screen.getByTestId(dataTestIds.progressNotePage.missingCard)).toBeVisible();
    });
  });
});
