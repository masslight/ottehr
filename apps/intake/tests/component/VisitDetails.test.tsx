import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { GetVisitDetailsResponse } from 'utils/lib/types/data/telemed/appointments/appointments.types';
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

  test('shows the read of in-house studies and opens the files of external ones', async () => {
    mockUseGetVisitDetails.mockReturnValue({
      data: visitDetails({
        reviewedRadiologyResults: [
          { studyType: '73600 — Ankle, left, 2 views', report: 'No acute fracture.', files: [] },
          {
            studyType: '70450 — CT head',
            report: '',
            files: [{ presignedUrl: 'https://presigned.example/result.pdf', description: 'CT result.pdf' }],
          },
        ],
      }),
      isLoading: false,
      error: null,
    });

    renderVisitDetails();

    expect(screen.getByText('Radiology')).toBeTruthy();
    expect(screen.getByText('73600 — Ankle, left, 2 views')).toBeTruthy();
    expect(screen.getByText('No acute fracture.')).toBeTruthy();
    expect(screen.getByText('70450 — CT head')).toBeTruthy();

    await userEvent.click(screen.getByText('CT result.pdf'));
    expect(mockOpenExternalLink).toHaveBeenCalledWith('https://presigned.example/result.pdf');
  });

  test('hides the section when there are no reviewed radiology results', () => {
    mockUseGetVisitDetails.mockReturnValue({ data: visitDetails({}), isLoading: false, error: null });

    renderVisitDetails();

    expect(screen.queryByText('Radiology')).toBeNull();
  });
});
