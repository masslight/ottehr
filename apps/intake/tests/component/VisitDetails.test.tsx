import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
  GetVisitDetailsResponse,
  ReviewedRadiologyResult,
} from 'utils/lib/types/data/telemed/appointments/appointments.types';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import VisitDetails from '../../src/pages/VisitDetails';

const mockUseGetVisitDetails = vi.fn();
vi.mock('src/telemed/features/appointments/appointment.queries', () => ({
  useGetVisitDetails: () => mockUseGetVisitDetails(),
}));

vi.mock('src/telemed/utils/getOystehrAPI', () => ({
  useOystehrAPIClient: () => ({}),
}));

const mockOpenExternalLink = vi.fn();
vi.mock('src/telemed/hooks/useOpenExternalLink', () => ({
  useOpenExternalLink: () => mockOpenExternalLink,
}));

vi.mock('src/App', () => ({
  intakeFlowPageRoute: { PastVisits: { path: '/patient/:patientId/visits' } },
}));

const RESULT_FILE = { presignedUrl: 'https://presigned.example/result.pdf', description: 'CT result.pdf' };

const IN_HOUSE_RESULT: ReviewedRadiologyResult = {
  studyType: '73600 — Ankle, left, 2 views',
  report: 'No acute fracture.',
  performedBy: 'Demo Admin, MD',
  files: [],
};

const EXTERNAL_RESULT: ReviewedRadiologyResult = {
  studyType: '70450 — CT head',
  report: '',
  files: [RESULT_FILE],
};

const visitDetails = (overrides: Partial<GetVisitDetailsResponse>): GetVisitDetailsResponse => ({
  files: {},
  medications: [],
  appointmentTime: '2026-10-30T10:00:00.000Z',
  followUps: [],
  reviewedLabResults: [],
  reviewedRadiologyResults: [],
  ...overrides,
});

const renderVisitDetails = (): ReturnType<typeof render> =>
  render(
    <MemoryRouter initialEntries={['/patient/patient-1/visit/visit-1']}>
      <Routes>
        <Route path="/patient/:patientId/visit/:visitId" element={<VisitDetails />} />
      </Routes>
    </MemoryRouter>
  );

describe('VisitDetails radiology results', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('keeps the read of in-house studies hidden until the patient shows it', async () => {
    mockUseGetVisitDetails.mockReturnValue({
      data: visitDetails({ reviewedRadiologyResults: [IN_HOUSE_RESULT] }),
      isLoading: false,
      error: null,
    });

    renderVisitDetails();

    expect(screen.getByText('Radiology')).toBeTruthy();
    expect(screen.getByText(IN_HOUSE_RESULT.studyType)).toBeTruthy();
    expect(screen.queryByText(`Final Read: ${IN_HOUSE_RESULT.report}`)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Show final report' }));
    expect(screen.getByText(`Performed by: ${IN_HOUSE_RESULT.performedBy}`)).toBeTruthy();
    expect(screen.getByText(`Final Read: ${IN_HOUSE_RESULT.report}`)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Hide final report' }));
    await waitFor(() => expect(screen.queryByText(`Final Read: ${IN_HOUSE_RESULT.report}`)).toBeNull());
    expect(screen.getByRole('button', { name: 'Show final report' })).toBeTruthy();
  });

  test('opens the files of external studies, which have no report toggle', async () => {
    mockUseGetVisitDetails.mockReturnValue({
      data: visitDetails({ reviewedRadiologyResults: [EXTERNAL_RESULT] }),
      isLoading: false,
      error: null,
    });

    renderVisitDetails();

    expect(screen.getByText(EXTERNAL_RESULT.studyType)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show final report' })).toBeNull();

    await userEvent.click(screen.getByText(RESULT_FILE.description));
    expect(mockOpenExternalLink).toHaveBeenCalledWith(RESULT_FILE.presignedUrl);
  });

  test('hides the section when there are no reviewed radiology results', () => {
    mockUseGetVisitDetails.mockReturnValue({ data: visitDetails({}), isLoading: false, error: null });

    renderVisitDetails();

    expect(screen.queryByText('Radiology')).toBeNull();
  });
});
