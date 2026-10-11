import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChartSection } from '../../src/features/visits/shared/hooks/useChartSection';

vi.mock('src/features/visits/shared/hooks/useChartSection', () => ({
  useChartSection: vi.fn(),
}));
vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ appointment: { start: '2026-10-10T14:00:00.000Z' } }),
}));

import { PrescriptionTable } from '../../src/features/visits/in-person/components/erx/PrescriptionTable';

const mockUseChartSection = vi.mocked(useChartSection);

const withHistory: PrescribedMedicationDTO = {
  resourceId: 'with-history',
  name: 'Amoxicillin 500 MG',
  instructions: 'Take 1 capsule three times daily',
  status: 'active',
  provider: 'practitioner-1',
  added: '2026-10-10T14:00:00.000Z',
  events: [
    {
      code: 'ordered',
      description: 'Prescription ordered',
      recorded: '2026-10-10T14:00:00.000Z',
      practitionerId: 'practitioner-1',
    },
    {
      code: 'accepted',
      description: 'Prescription accepted by Surescripts',
      recorded: '2026-10-10T14:00:09.000Z',
      source: 'Surescripts',
    },
  ],
};
const withoutHistory: PrescribedMedicationDTO = {
  resourceId: 'without-history',
  name: 'Ibuprofen 200 MG',
  status: 'completed',
  added: '2026-10-09T14:00:00.000Z',
};

describe('PrescriptionTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChartSection.mockReturnValue({
      data: {
        prescribedMedications: [withHistory, withoutHistory],
        prescribedMedicationsRequesterPractitioners: [
          { resourceType: 'Practitioner', id: 'practitioner-1', name: [{ family: 'Practitioner', given: ['Dr'] }] },
        ],
      },
      isLoading: false,
      isFetching: false,
      error: null,
    } as any);
  });

  it('prescription with a history, shows it when its row is opened, success', async () => {
    const user = userEvent.setup();
    render(<PrescriptionTable />);

    const row = screen.getByText('Amoxicillin 500 MG').closest('tr') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Show order history' }));

    expect(await screen.findByText('Order history')).toBeInTheDocument();
    expect(screen.getByText('Prescription ordered')).toBeInTheDocument();
    expect(screen.getAllByText('Practitioner, Dr')).toHaveLength(2);
    expect(screen.getByText('Prescription accepted by Surescripts')).toBeInTheDocument();
    expect(screen.getByText('Surescripts')).toBeInTheDocument();
  });

  it('prescription without a history, has nothing to open, success', async () => {
    render(<PrescriptionTable />);

    const row = screen.getByText('Ibuprofen 200 MG').closest('tr') as HTMLElement;

    expect(within(row).queryByRole('button', { name: 'Show order history' })).not.toBeInTheDocument();
  });

  it.each([
    ['ordered', 'Ordered'],
    ['accepted', 'Accepted'],
    ['dispensed', 'Dispensed'],
    ['partiallydispensed', 'Partially dispensed'],
    ['notdispensed', 'Not dispensed'],
    ['transferred', 'Transferred'],
    ['error 900', 'Error'],
    ['Error 900', 'Error'],
    ['Dispensed', 'Dispensed'],
  ])('prescription with the latest event %s, is described as %s, success', (code, label) => {
    mockUseChartSection.mockReturnValue({
      data: {
        prescribedMedications: [
          {
            ...withHistory,
            events: [
              ...(withHistory.events ?? []),
              { code, description: 'Latest', recorded: '2026-10-11T14:00:00.000Z' },
            ],
          },
        ],
      },
      isLoading: false,
      isFetching: false,
      error: null,
    } as any);

    render(<PrescriptionTable />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('prescription with an event that is not known, keeps its status, success', () => {
    mockUseChartSection.mockReturnValue({
      data: {
        prescribedMedications: [
          {
            ...withHistory,
            events: [{ code: 'eventnotification', description: 'Latest', recorded: '2026-10-11T14:00:00.000Z' }],
          },
        ],
      },
      isLoading: false,
      isFetching: false,
      error: null,
    } as any);

    render(<PrescriptionTable />);

    expect(screen.getByText('active')).toBeInTheDocument();
  });
});
