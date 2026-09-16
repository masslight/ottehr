import { render, screen } from '@testing-library/react';
import { MedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { describe, expect, it, vi } from 'vitest';
import { MedicationsContainer } from '../../src/features/visits/shared/components/review-tab/components/MedicationsContainer';

let mockChartData: { medications?: MedicationDTO[] } = {};

vi.mock('../../src/features/visits/shared/hooks/useVisitNote', () => ({
  useVisitNote: () => ({ data: { history: { medications: mockChartData.medications ?? [] } } }),
}));

const medication = (name: string, status: MedicationDTO['status']): MedicationDTO => ({
  resourceId: `${name}-id`,
  id: name,
  name,
  type: 'scheduled',
  status,
  intakeInfo: {},
});

describe('Review & Sign medications section', () => {
  it('lists the medications the patient is still taking', () => {
    mockChartData = { medications: [medication('Ibuprofen 200 mg', 'active')] };

    render(<MedicationsContainer />);

    expect(screen.getByText(/Ibuprofen 200 mg/)).toBeInTheDocument();
  });

  // A medication removed in a later encounter is patched to 'completed' rather than deleted, so it
  // keeps coming back in the patient-scoped history section for every encounter of that patient.
  it('omits medications that were removed from the chart', () => {
    mockChartData = {
      medications: [medication('Ibuprofen 200 mg', 'active'), medication('Acetaminophen 500 mg', 'completed')],
    };

    render(<MedicationsContainer />);

    expect(screen.getByText(/Ibuprofen 200 mg/)).toBeInTheDocument();
    expect(screen.queryByText(/Acetaminophen 500 mg/)).not.toBeInTheDocument();
  });

  it('reads as no current medications when every medication was removed', () => {
    mockChartData = { medications: [medication('Acetaminophen 500 mg', 'completed')] };

    render(<MedicationsContainer />);

    expect(screen.getByText('No current medications')).toBeInTheDocument();
    expect(screen.queryByText(/Acetaminophen 500 mg/)).not.toBeInTheDocument();
  });
});
