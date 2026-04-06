import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dataTestIds } from '../../src/constants/data-test-ids';
import { MissingCard } from '../../src/features/visits/shared/components/review-tab/MissingCard';

vi.mock('../../src/features/visits/shared/hooks/useChartFields', () => ({
  useChartFields: vi.fn(),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useAiSuggestionNotes: vi.fn(),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: vi.fn(),
  useAppTelemedLocalStore: { setState: vi.fn() },
  useChartData: vi.fn(),
}));

vi.mock('../../src/features/visits/shared/stores/contexts/useAppFlags', () => ({
  useAppFlags: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

import { useNavigate } from 'react-router-dom';
import { useChartFields } from '../../src/features/visits/shared/hooks/useChartFields';
import { useAiSuggestionNotes } from '../../src/features/visits/shared/stores/appointment/appointment.queries';
import {
  useAppointmentData,
  useChartData,
} from '../../src/features/visits/shared/stores/appointment/appointment.store';
import { useAppFlags } from '../../src/features/visits/shared/stores/contexts/useAppFlags';

const mockUseAppointmentData = vi.mocked(useAppointmentData);
const mockUseChartData = vi.mocked(useChartData);
const mockUseChartFields = vi.mocked(useChartFields);
const mockUseAiSuggestionNotes = vi.mocked(useAiSuggestionNotes);
const mockUseAppFlags = vi.mocked(useAppFlags);
const mockUseNavigate = vi.mocked(useNavigate);

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
    mockUseAppFlags.mockReturnValue({ isInPerson: true } as any);

    renderComponent();

    const verificationLink = screen.getByTestId(dataTestIds.progressNotePage.patientVerificationLink);

    expect(verificationLink).toBeVisible();
    fireEvent.click(verificationLink);
    expect(navigate).toHaveBeenCalledWith('/in-person/appointment-123/cc-and-intake-notes');
  });

  it('does not render a missing card for telemed when the only missing item is patient verification', () => {
    mockUseNavigate.mockReturnValue(vi.fn());
    mockUseAppFlags.mockReturnValue({ isInPerson: false } as any);

    renderComponent();

    expect(screen.queryByTestId(dataTestIds.progressNotePage.missingCard)).not.toBeInTheDocument();
  });
});
