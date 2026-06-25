import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter, useNavigate, useParams } from 'react-router-dom';
import { useProgressNoteConfig } from 'src/hooks/useProgressNoteConfig';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dataTestIds } from '../../src/constants/data-test-ids';
import { MissingCard } from '../../src/features/visits/shared/components/review-tab/MissingCard';
import { useChartFields } from '../../src/features/visits/shared/hooks/useChartFields';
import { useAiSuggestionNotes } from '../../src/features/visits/shared/stores/appointment/appointment.queries';
import {
  useAppointmentData,
  useChartData,
} from '../../src/features/visits/shared/stores/appointment/appointment.store';

vi.mock('../../src/features/visits/shared/hooks/useChartFields', () => ({
  useChartFields: vi.fn(),
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

describe('MissingCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });

    mockUseAppointmentData.mockReturnValue({
      appointment: { id: 'appointment-123' },
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
    } as any);

    mockUseAiSuggestionNotes.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ suggestions: [] }),
    } as any);

    mockUseProgressNoteConfig.mockReturnValue({
      data: { mdmRequired: true },
    } as any);
  });

  const renderComponent = (): void => {
    render(
      <BrowserRouter>
        <MissingCard />
      </BrowserRouter>
    );
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
    } as any);
    mockUseProgressNoteConfig.mockReturnValue({ data: { mdmRequired: false } } as any);

    renderComponent();

    expect(screen.queryByTestId(dataTestIds.progressNotePage.missingCard)).not.toBeInTheDocument();
    expect(screen.queryByTestId(dataTestIds.progressNotePage.medicalDecisionLink)).not.toBeInTheDocument();
  });
});
