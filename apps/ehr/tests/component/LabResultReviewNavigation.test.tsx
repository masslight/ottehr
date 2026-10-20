import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock calls MUST come before component imports (Vitest hoists them)

const mockNavigate = vi.fn();
let mockUrlParams: Record<string, string> = {};
let mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockUrlParams,
    useSearchParams: () => [mockSearchParams, vi.fn()],
    Link: ({ children }: any) => <a>{children}</a>,
  };
});

const mockUpdateLabOrderResources = vi.fn().mockResolvedValue({});

vi.mock('src/api/api', () => ({
  updateLabOrderResources: (...args: any[]) => mockUpdateLabOrderResources(...args),
  getExternalLabOrders: vi.fn().mockResolvedValue({ data: [], pagination: undefined, patientLabItems: [] }),
  deleteLabOrder: vi.fn(),
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda: { zambda: { execute: vi.fn() } } }),
}));

// The result card itself is fixture-heavy and isn't what routes; stand in for it with the review trigger.
vi.mock('src/features/external-labs/components/details/DetailsWithResults', () => ({
  DetailsWithResults: ({ markTaskAsReviewed }: any) => (
    <button onClick={() => void markTaskAsReviewed({ taskId: 'task-1', diagnosticReportId: 'dr-1' })}>
      Mark as reviewed
    </button>
  ),
}));

import { DiagnosticReportCentricResultDetails } from 'src/features/external-labs/components/details/DiagnosticReportCentricResultDetails';
import { usePatientLabOrders } from 'src/features/external-labs/components/labs-orders/usePatientLabOrders';

const FOLLOW_UP_APPOINTMENT_ID = 'followup-appt';
const ORIGIN_APPOINTMENT_ID = 'origin-appt';
const FOLLOW_UP_ENCOUNTER_ID = 'followup-enc';

const ReviewHarness: React.FC = () => {
  const { markTaskAsReviewed } = usePatientLabOrders({
    searchBy: { field: 'serviceRequestId', value: 'sr-1' },
  });

  return (
    <button
      onClick={() =>
        void markTaskAsReviewed({
          taskId: 'task-1',
          serviceRequestId: 'sr-1',
          diagnosticReportId: 'dr-1',
          // the zambda resolves this from the order's own encounter, so for an order placed on a
          // scheduled follow-up it is the follow-up's appointment, not the one the chart is open on
          appointmentId: FOLLOW_UP_APPOINTMENT_ID,
        })
      }
    >
      Mark as reviewed
    </button>
  );
};

const clickReview = async (): Promise<void> => {
  const { getByRole } = render(<ReviewHarness />);
  getByRole('button', { name: 'Mark as reviewed' }).click();
  await waitFor(() => expect(mockUpdateLabOrderResources).toHaveBeenCalled());
};

describe('marking an external lab result as reviewed', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockUpdateLabOrderResources.mockClear();
    mockUrlParams = {};
    mockSearchParams = new URLSearchParams();
  });

  it('keeps the chart on the origin visit and its selected follow-up encounter', async () => {
    mockUrlParams = { id: ORIGIN_APPOINTMENT_ID };
    mockSearchParams = new URLSearchParams({ encounterId: FOLLOW_UP_ENCOUNTER_ID });

    await clickReview();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        `/in-person/${ORIGIN_APPOINTMENT_ID}/external-lab-orders/?encounterId=${FOLLOW_UP_ENCOUNTER_ID}`
      )
    );
    expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining(FOLLOW_UP_APPOINTMENT_ID));
  });

  it('routes on the appointment in the url when no follow-up encounter is selected', async () => {
    mockUrlParams = { id: ORIGIN_APPOINTMENT_ID };

    await clickReview();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(`/in-person/${ORIGIN_APPOINTMENT_ID}/external-lab-orders/`)
    );
  });

  it("falls back to the order's appointment when rendered outside a visit route", async () => {
    await clickReview();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(`/in-person/${FOLLOW_UP_APPOINTMENT_ID}/external-lab-orders/`)
    );
  });
});

describe('marking a diagnostic-report-centric result as reviewed', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockUpdateLabOrderResources.mockClear();
    mockUrlParams = { id: ORIGIN_APPOINTMENT_ID };
    mockSearchParams = new URLSearchParams();
  });

  const clickReflexReview = async (): Promise<void> => {
    const { getByRole } = render(
      <DiagnosticReportCentricResultDetails
        results={{ testItem: 'Reflex test', resultsDetails: [] } as any}
        loadingOrders={false}
        appointmentId={ORIGIN_APPOINTMENT_ID}
      />
    );
    getByRole('button', { name: 'Mark as reviewed' }).click();
    await waitFor(() => expect(mockUpdateLabOrderResources).toHaveBeenCalled());
  };

  it('keeps the selected follow-up encounter on the lab orders list', async () => {
    mockSearchParams = new URLSearchParams({ encounterId: FOLLOW_UP_ENCOUNTER_ID });

    await clickReflexReview();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        `/in-person/${ORIGIN_APPOINTMENT_ID}/external-lab-orders/?encounterId=${FOLLOW_UP_ENCOUNTER_ID}`
      )
    );
  });

  it('routes to the plain lab orders list on an origin visit', async () => {
    await clickReflexReview();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(`/in-person/${ORIGIN_APPOINTMENT_ID}/external-lab-orders/`)
    );
  });
});
