import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import type { VitalsBMIObservationDTO } from 'utils';
import { VitalFieldNames } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dataTestIds } from '../../src/constants/data-test-ids';
import VitalsBMICard from '../../src/features/visits/shared/components/vitals/bmi/VitalsBMICard';
import { useGetAppointmentAccessibility } from '../../src/features/visits/shared/hooks/useGetAppointmentAccessibility';

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: vi.fn(),
}));

vi.mock('../../src/features/visits/shared/components/vitals/components/VitalsHistoryContainer', () => ({
  default: ({
    currentEncounterObs,
    historicalObs,
    historyElementCreator,
  }: {
    currentEncounterObs: VitalsBMIObservationDTO[];
    historicalObs: VitalsBMIObservationDTO[];
    historyElementCreator: (entry: VitalsBMIObservationDTO) => React.ReactNode;
  }) => (
    <div
      data-testid="vitals-history-container"
      data-current-count={String(currentEncounterObs.length)}
      data-historical-count={String(historicalObs.length)}
    >
      {[...currentEncounterObs, ...historicalObs].map((obs) => (
        <React.Fragment key={obs.resourceId}>{historyElementCreator(obs)}</React.Fragment>
      ))}
    </div>
  ),
}));

vi.mock('../../src/features/visits/shared/components/vitals/components/VitalsHistoryEntry', () => ({
  default: ({
    historyEntry,
    onDelete,
  }: {
    historyEntry: VitalsBMIObservationDTO;
    onDelete?: (entity: VitalsBMIObservationDTO) => Promise<void>;
  }) => (
    <div data-testid={`bmi-history-entry-${historyEntry.resourceId}`}>
      {onDelete && (
        <button aria-label={`delete-${historyEntry.resourceId}`} onClick={() => onDelete(historyEntry)}>
          Delete
        </button>
      )}
    </div>
  ),
  getObservationValueElements: () => [],
}));

const mockUseGetAppointmentAccessibility = vi.mocked(useGetAppointmentAccessibility);

const makeBMIObservation = (value: number, resourceId = 'bmi-obs-1'): VitalsBMIObservationDTO => ({
  field: VitalFieldNames.VitalBMI,
  value,
  resourceId,
  authorId: 'practitioner-1',
  authorName: 'Dr. Smith',
  lastUpdated: '2024-01-15T10:00:00Z',
});

describe('VitalsBMICard', () => {
  beforeEach(() => {
    mockUseGetAppointmentAccessibility.mockReturnValue({ isAppointmentReadOnly: false } as any);
  });

  describe('info message', () => {
    it('is visible when no BMI data exists', () => {
      render(<VitalsBMICard current={[]} historical={[]} onDelete={vi.fn()} />);
      expect(screen.getByTestId(dataTestIds.vitalsPage.bmiInfoMessage)).toBeVisible();
    });

    it('remains visible after BMI is saved (persistent reminder to add new readings)', () => {
      render(<VitalsBMICard current={[makeBMIObservation(24.3)]} historical={[]} onDelete={vi.fn()} />);
      expect(screen.getByTestId(dataTestIds.vitalsPage.bmiInfoMessage)).toBeVisible();
    });

    it('prompts the user to add and save Weight and Height', () => {
      render(<VitalsBMICard current={[]} historical={[]} onDelete={vi.fn()} />);
      expect(screen.getByText(/Please add and save Weight and Height to calculate BMI/)).toBeInTheDocument();
    });

    it('explains that BMI is saved automatically', () => {
      render(<VitalsBMICard current={[]} historical={[]} onDelete={vi.fn()} />);
      expect(screen.getByText(/BMI will be saved automatically/)).toBeInTheDocument();
    });

    it('shows the weight-declined warning when the patient refused weight', () => {
      render(<VitalsBMICard current={[]} historical={[]} onDelete={vi.fn()} isWeightRefused />);
      const warning = screen.getByTestId(dataTestIds.vitalsPage.bmiWeightRefusedWarning);
      expect(warning).toBeVisible();
      expect(warning).toHaveTextContent('BMI not calculated, weight declined by patient');
    });

    it('keeps the add-Weight-and-Height prompt alongside the weight-declined warning', () => {
      render(<VitalsBMICard current={[]} historical={[]} onDelete={vi.fn()} isWeightRefused />);
      expect(screen.getByText(/Please add and save Weight and Height to calculate BMI/)).toBeInTheDocument();
      expect(screen.getByText(/BMI not calculated, weight declined by patient/)).toBeInTheDocument();
    });

    it('does not show the weight-declined warning when weight was not refused', () => {
      render(<VitalsBMICard current={[]} historical={[]} onDelete={vi.fn()} />);
      expect(screen.queryByTestId(dataTestIds.vitalsPage.bmiWeightRefusedWarning)).not.toBeInTheDocument();
    });
  });

  describe('header label', () => {
    it('shows "BMI (kg/m2)" when no current BMI reading exists', () => {
      render(<VitalsBMICard current={[]} historical={[]} onDelete={vi.fn()} />);
      expect(screen.getByText('BMI (kg/m2)')).toBeInTheDocument();
    });

    it('appends the BMI value to the header when a current reading exists', () => {
      render(<VitalsBMICard current={[makeBMIObservation(24.3)]} historical={[]} onDelete={vi.fn()} />);
      expect(screen.getByText('BMI (kg/m2) 24.3')).toBeInTheDocument();
    });

    it('displays BMI to exactly 1 decimal place', () => {
      render(<VitalsBMICard current={[makeBMIObservation(22.9)]} historical={[]} onDelete={vi.fn()} />);
      expect(screen.getByText('BMI (kg/m2) 22.9')).toBeInTheDocument();
    });

    it('shows a trailing zero for integer BMI values', () => {
      render(<VitalsBMICard current={[makeBMIObservation(25)]} historical={[]} onDelete={vi.fn()} />);
      expect(screen.getByText('BMI (kg/m2) 25.0')).toBeInTheDocument();
    });

    it('uses the most recent (first) entry when multiple current readings exist', () => {
      const older = makeBMIObservation(21.0, 'bmi-obs-2');
      render(<VitalsBMICard current={[makeBMIObservation(24.3), older]} historical={[]} onDelete={vi.fn()} />);
      expect(screen.getByText('BMI (kg/m2) 24.3')).toBeInTheDocument();
    });
  });

  describe('read-only — no editable fields or save controls', () => {
    it('renders no text input fields', () => {
      render(<VitalsBMICard current={[]} historical={[]} onDelete={vi.fn()} />);
      expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    });

    it('renders no numeric input fields', () => {
      render(<VitalsBMICard current={[]} historical={[]} onDelete={vi.fn()} />);
      expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
    });
  });

  describe('history container', () => {
    it('renders the history container', () => {
      render(<VitalsBMICard current={[]} historical={[]} onDelete={vi.fn()} />);
      expect(screen.getByTestId('vitals-history-container')).toBeInTheDocument();
    });

    it('passes current observations to the history container', () => {
      render(<VitalsBMICard current={[makeBMIObservation(24.3)]} historical={[]} onDelete={vi.fn()} />);
      expect(screen.getByTestId('vitals-history-container')).toHaveAttribute('data-current-count', '1');
    });

    it('passes historical observations to the history container', () => {
      const historical = [makeBMIObservation(22.1, 'h-1'), makeBMIObservation(21.8, 'h-2')];
      render(<VitalsBMICard current={[]} historical={historical} onDelete={vi.fn()} />);
      expect(screen.getByTestId('vitals-history-container')).toHaveAttribute('data-historical-count', '2');
    });

    it('passes empty arrays when no data exists', () => {
      render(<VitalsBMICard current={[]} historical={[]} onDelete={vi.fn()} />);
      const container = screen.getByTestId('vitals-history-container');
      expect(container).toHaveAttribute('data-current-count', '0');
      expect(container).toHaveAttribute('data-historical-count', '0');
    });
  });

  describe('delete button', () => {
    it('shows a delete button for current encounter BMI observations when not read-only', () => {
      const current = [makeBMIObservation(24.3, 'bmi-current')];
      render(<VitalsBMICard current={current} historical={[]} onDelete={vi.fn()} />);
      expect(screen.getByRole('button', { name: 'delete-bmi-current' })).toBeInTheDocument();
    });

    it('does not show a delete button for historical BMI observations', () => {
      const historical = [makeBMIObservation(22.1, 'bmi-hist')];
      render(<VitalsBMICard current={[]} historical={historical} onDelete={vi.fn()} />);
      expect(screen.queryByRole('button', { name: 'delete-bmi-hist' })).not.toBeInTheDocument();
    });

    it('does not show a delete button when the appointment is read-only', () => {
      mockUseGetAppointmentAccessibility.mockReturnValue({ isAppointmentReadOnly: true } as any);
      const current = [makeBMIObservation(24.3, 'bmi-current')];
      render(<VitalsBMICard current={current} historical={[]} onDelete={vi.fn()} />);
      expect(screen.queryByRole('button', { name: 'delete-bmi-current' })).not.toBeInTheDocument();
    });

    it('calls onDelete with the correct observation when the delete button is clicked', () => {
      const obs = makeBMIObservation(24.3, 'bmi-current');
      const onDelete = vi.fn().mockResolvedValue(undefined);
      render(<VitalsBMICard current={[obs]} historical={[]} onDelete={onDelete} />);
      fireEvent.click(screen.getByRole('button', { name: 'delete-bmi-current' }));
      expect(onDelete).toHaveBeenCalledWith(obs);
    });

    it('renders a history entry for each current and historical observation', () => {
      const current = [makeBMIObservation(24.3, 'bmi-c1')];
      const historical = [makeBMIObservation(22.1, 'bmi-h1')];
      render(<VitalsBMICard current={current} historical={historical} onDelete={vi.fn()} />);
      expect(screen.getByTestId('bmi-history-entry-bmi-c1')).toBeInTheDocument();
      expect(screen.getByTestId('bmi-history-entry-bmi-h1')).toBeInTheDocument();
    });
  });
});
